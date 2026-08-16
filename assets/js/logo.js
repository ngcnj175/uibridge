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
//   "full"    — plain shape geometry only → fill/stroke override works, even
//                for multi-shape logos (outline is stacked over every shape)
//   "display" — embeds text, raster images, or gradients/patterns whose
//                appearance depends on internal styling → render as-is
function classifyCapability(svg) {
  if (svg.querySelector("text, tspan")) return "display";
  if (svg.querySelector("image")) return "display";
  if (svg.querySelector("linearGradient, radialGradient, pattern")) return "display";
  const shapes = svg.querySelectorAll("path, polygon, polyline, rect, circle, ellipse, line");
  return shapes.length > 0 ? "full" : "display";
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

  // Each outline layer fills its glyph body with the same color as its
  // stroke, so the band the next layer covers is solid — no background
  // shows through when stroke widths are large.
  const layers = [];
  if (stroke2.enabled) {
    const w = (stroke1.enabled ? stroke1.width : 0) * 2 + stroke2.width * 2;
    const c = escapeXml(stroke2.color);
    layers.push(`<text ${common} fill="${c}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round">${label}</text>`);
  }
  if (stroke1.enabled) {
    const w = stroke1.width * 2;
    const c = escapeXml(stroke1.color);
    layers.push(`<text ${common} fill="${c}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round">${label}</text>`);
  }
  layers.push(`<text ${common} fill="${escapeXml(fill)}">${label}</text>`);

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${approxW} ${approxH}" preserveAspectRatio="xMidYMid meet">`
    + `<defs>${filterMarkup}</defs>`
    + `<g${filterAttr}>${layers.join("")}</g>`
    + `</svg>`;
}

const SHAPE_SELECTOR = "path, polygon, polyline, rect, circle, ellipse, line";

// SVG-upload mode: reuse the sanitized markup. When capability is "full",
// wrap the whole scene in stacked "outline groups" — each group re-draws
// every primitive shape with a thicker stroke — then place the colored
// original on top. Works for single- or multi-shape SVGs.
function renderUploadedSvg(logo) {
  const { source, fill, stroke1, stroke2, shadow, capability } = logo;
  const raw = source.markup;
  if (!raw) return renderText({ ...logo, source: { ...source, value: "(SVGなし)" } });

  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") return raw;

  const cap = capability || source.capability || "display";

  if (cap === "full") {
    const shapes = Array.from(svg.querySelectorAll(SHAPE_SELECTOR));
    if (shapes.length > 0) {
      // Snapshot the whole current children so clones preserve any wrapping
      // <g transform="…"> the shapes live under.
      const original = Array.from(svg.childNodes);

      const buildOutlineLayer = (color, width) => {
        const layer = doc.createElementNS(SVG_NS, "g");
        // fill + stroke both set to outline color → no cavity between layers.
        layer.setAttribute("fill", color);
        layer.setAttribute("stroke", color);
        layer.setAttribute("stroke-width", String(width));
        layer.setAttribute("stroke-linejoin", "round");
        layer.setAttribute("stroke-linecap", "round");
        for (const n of original) {
          const c = n.cloneNode(true);
          if (c.nodeType === 1) stripFillStroke(c);
          layer.appendChild(c);
        }
        return layer;
      };

      // Wipe svg children, then stack: stroke2 → stroke1 → colored fill layer.
      for (const n of original) svg.removeChild(n);

      if (stroke2.enabled) {
        const w = (stroke1.enabled ? stroke1.width : 0) * 2 + stroke2.width * 2;
        svg.appendChild(buildOutlineLayer(stroke2.color, w));
      }
      if (stroke1.enabled) {
        svg.appendChild(buildOutlineLayer(stroke1.color, stroke1.width * 2));
      }

      const fillLayer = doc.createElementNS(SVG_NS, "g");
      fillLayer.setAttribute("fill", fill);
      fillLayer.setAttribute("stroke", "none");
      for (const n of original) {
        const c = n.cloneNode(true);
        if (c.nodeType === 1) stripFillStroke(c);
        fillLayer.appendChild(c);
      }
      svg.appendChild(fillLayer);
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

// Remove per-element fill/stroke so the layer's group-level fill/stroke
// wins. Recurses into groups.
function stripFillStroke(node) {
  if (node.nodeType !== 1) return;
  node.removeAttribute("fill");
  node.removeAttribute("stroke");
  node.removeAttribute("stroke-width");
  // style="fill:…" also needs cleaning.
  const style = node.getAttribute("style");
  if (style) {
    const cleaned = style
      .replace(/(^|;)\s*fill\s*:[^;]*/gi, "$1")
      .replace(/(^|;)\s*stroke\s*:[^;]*/gi, "$1")
      .replace(/(^|;)\s*stroke-width\s*:[^;]*/gi, "$1")
      .replace(/;;+/g, ";").replace(/^;|;$/g, "");
    if (cleaned) node.setAttribute("style", cleaned);
    else node.removeAttribute("style");
  }
  for (const child of Array.from(node.childNodes)) stripFillStroke(child);
}

export function renderLogoSvg(logo) {
  if (!logo) return "";
  if (logo.source && logo.source.type === "svg") return renderUploadedSvg(logo);
  return renderText(logo);
}
