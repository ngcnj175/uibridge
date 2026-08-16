// UIBridge — logo rendering + SVG upload sanitizer.
// Renderer emits inline SVG so text-mode and svg-mode share the same
// stacked-outline approach (paint stroke2 → stroke1 → fill from bottom up).

const SVG_NS = "http://www.w3.org/2000/svg";

// --- Sanitizer ---------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "svg", "g", "defs", "title", "desc",
  "path", "polygon", "polyline", "rect", "circle", "ellipse", "line",
  "linearGradient", "radialGradient", "stop",
  "clipPath", "mask", "use",
  "text", "tspan", "image",
  "style",
]);

// Attributes safe to keep on any element. `href`/`xlink:href` are gated
// further below (only local fragment refs and data: images allowed).
const ALLOWED_ATTRS = new Set([
  "id", "class", "style",
  "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height",
  "fill", "fill-opacity", "fill-rule",
  "stroke", "stroke-opacity", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
  "opacity", "transform", "clip-path", "mask",
  "viewbox", "preserveaspectratio", "xmlns",
  "gradientunits", "gradienttransform", "spreadmethod",
  "offset", "stop-color", "stop-opacity",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor",
]);

const HREF_ATTRS = ["href", "xlink:href"];

function isSafeHref(v) {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  if (s.startsWith("#")) return true;                      // local fragment
  if (s.startsWith("data:image/")) return true;            // inline raster
  return false;
}

function stripDangerous(root) {
  // Walk depth-first, mutating in place.
  const toRemove = [];
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) { toRemove.push(node); return; }

    // <style> content: strip @import and url(http…) references.
    if (tag === "style") {
      const txt = node.textContent || "";
      node.textContent = txt
        .replace(/@import[^;]*;?/gi, "")
        .replace(/url\(\s*['"]?(?!#|data:image\/)[^)]*\)/gi, "none");
    }

    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) { node.removeAttribute(attr.name); continue; }
      if (HREF_ATTRS.includes(name)) {
        if (!isSafeHref(attr.value)) node.removeAttribute(attr.name);
        continue;
      }
      // Allow xmlns:* passthrough; drop anything else not on the list.
      if (name.startsWith("xmlns")) continue;
      if (!ALLOWED_ATTRS.has(name)) node.removeAttribute(attr.name);
      // Reject javascript: inside style="…url(javascript:…)".
      else if (/javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
    }

    for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(root);
  for (const n of toRemove) n.remove();
}

// Ensure a usable viewBox. Returns null if size cannot be determined.
function normalizeViewBox(svg) {
  if (svg.getAttribute("viewBox")) return svg.getAttribute("viewBox");
  const w = parseFloat(svg.getAttribute("width"));
  const h = parseFloat(svg.getAttribute("height"));
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    const vb = `0 0 ${w} ${h}`;
    svg.setAttribute("viewBox", vb);
    return vb;
  }
  return null;
}

// Classify what edits are safe to apply to the uploaded SVG.
//   "full"    — single path/shape, single color → fill/stroke override works
//   "display" — multiple shapes/groups, gradients, or <text> → show as-is
function classifyCapability(svg) {
  if (svg.querySelector("text, tspan")) return "display";
  if (svg.querySelector("image")) return "display";
  if (svg.querySelector("linearGradient, radialGradient, pattern")) return "display";
  const shapes = svg.querySelectorAll("path, polygon, polyline, rect, circle, ellipse");
  if (shapes.length === 1) return "full";
  return "display";
}

export const SVG_LIMITS = {
  maxBytes: 100 * 1024,
  maxChars: 50_000,
};

// Parse + sanitize + normalize. Throws on hard failure with a UI message.
export function sanitizeSvg(text) {
  if (typeof text !== "string") throw new Error("SVG が読み取れません");
  if (text.length > SVG_LIMITS.maxChars) throw new Error("SVG が大きすぎます (文字数上限)");
  // DOCTYPE / ENTITY guard — remove before parsing to sidestep XXE-ish shapes.
  const cleaned = text.replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!ENTITY[\s\S]*?>/gi, "");

  const doc = new DOMParser().parseFromString(cleaned, "image/svg+xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("SVG の構文エラー");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") throw new Error("SVG ではありません");

  stripDangerous(svg);
  const vb = normalizeViewBox(svg);
  if (!vb) throw new Error("SVG に viewBox / サイズがありません");

  // Force a predictable outer shape; we control width/height via CSS.
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("xmlns", SVG_NS);

  const capability = classifyCapability(svg);
  const markup = new XMLSerializer().serializeToString(svg);
  return { markup, capability, viewBox: vb };
}

// --- Renderer ----------------------------------------------------------

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function shadowFilter(id, sh) {
  if (!sh || !sh.enabled) return "";
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">`
    + `<feDropShadow dx="${sh.x}" dy="${sh.y}" stdDeviation="${sh.blur / 2}" flood-color="${escapeXml(sh.color)}"/>`
    + `</filter>`;
}

// Text mode: three stacked <text> elements — wide stroke, inner stroke, fill.
function renderText(logo) {
  const {
    source, fontFamily, fontSize, fontWeight, italic, letterSpacing,
    fill, stroke1, stroke2, shadow,
  } = logo;

  // Rough box sized off font metrics; viewBox lets it scale to any container.
  const pad = Math.max(20, (stroke1.enabled ? stroke1.width : 0) + (stroke2.enabled ? stroke2.width : 0) + 12);
  const approxW = Math.max(120, (source.value || " ").length * fontSize * 0.62 + pad * 2);
  const approxH = fontSize * 1.35 + pad * 2;

  const common = `x="50%" y="50%" text-anchor="middle" dominant-baseline="central" `
    + `font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" `
    + `font-style="${italic ? "italic" : "normal"}" letter-spacing="${letterSpacing}"`;
  const label = escapeXml(source.value || "");

  const filterId = "logo-shadow";
  const filterMarkup = shadowFilter(filterId, shadow);
  const filterAttr = shadow && shadow.enabled ? ` filter="url(#${filterId})"` : "";

  const layers = [];
  if (stroke2.enabled) {
    const w = (stroke1.enabled ? stroke1.width : 0) * 2 + stroke2.width * 2;
    layers.push(`<text ${common} fill="none" stroke="${escapeXml(stroke2.color)}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke">${label}</text>`);
  }
  if (stroke1.enabled) {
    const w = stroke1.width * 2;
    layers.push(`<text ${common} fill="none" stroke="${escapeXml(stroke1.color)}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke">${label}</text>`);
  }
  layers.push(`<text ${common} fill="${escapeXml(fill)}">${label}</text>`);

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${approxW} ${approxH}" preserveAspectRatio="xMidYMid meet">`
    + `<defs>${filterMarkup}</defs>`
    + `<g${filterAttr}>${layers.join("")}</g>`
    + `</svg>`;
}

// SVG-upload mode: reuse the sanitized markup. When capability is "full",
// override the single shape's fill/stroke; otherwise render as-is.
function renderUploadedSvg(logo) {
  const { source, fill, stroke1, stroke2, shadow, capability } = logo;
  const raw = source.markup;
  if (!raw) return renderText({ ...logo, source: { ...source, value: "(SVGなし)" } });

  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") return raw;

  const cap = capability || source.capability || "display";

  if (cap === "full") {
    const shape = svg.querySelector("path, polygon, polyline, rect, circle, ellipse");
    if (shape) {
      // Build stacked clones for stroke2 → stroke1, then colored fill on top.
      const parent = shape.parentNode;
      const clones = [];
      if (stroke2.enabled) {
        const c = shape.cloneNode(true);
        const w = (stroke1.enabled ? stroke1.width : 0) * 2 + stroke2.width * 2;
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", stroke2.color);
        c.setAttribute("stroke-width", String(w));
        c.setAttribute("stroke-linejoin", "round");
        c.setAttribute("paint-order", "stroke");
        clones.push(c);
      }
      if (stroke1.enabled) {
        const c = shape.cloneNode(true);
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", stroke1.color);
        c.setAttribute("stroke-width", String(stroke1.width * 2));
        c.setAttribute("stroke-linejoin", "round");
        c.setAttribute("paint-order", "stroke");
        clones.push(c);
      }
      shape.setAttribute("fill", fill);
      shape.removeAttribute("stroke");
      for (const c of clones) parent.insertBefore(c, shape);
    }
  }

  if (shadow && shadow.enabled) {
    const defs = svg.querySelector("defs") || (() => {
      const d = doc.createElementNS(SVG_NS, "defs");
      svg.insertBefore(d, svg.firstChild);
      return d;
    })();
    defs.insertAdjacentHTML("beforeend", shadowFilter("logo-shadow", shadow));
    svg.setAttribute("filter", "url(#logo-shadow)");
  }

  return new XMLSerializer().serializeToString(svg);
}

export function renderLogoSvg(logo) {
  if (!logo) return "";
  if (logo.source && logo.source.type === "svg") return renderUploadedSvg(logo);
  return renderText(logo);
}
