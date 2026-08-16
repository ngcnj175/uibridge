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

export const RASTER_LIMITS = {
  maxBytes: 200 * 1024,
  maxPixels: 2048,
};

const RASTER_MIME_RE = /^image\/(png|gif|webp)$/i;

// Accept a File (from an <input type=file>) and resolve to a paint-safe
// data URL + intrinsic dimensions. Throws with a UI message on rejection.
// PNG / GIF / WebP only — JPEG has no alpha channel so outline detection
// via <feMorphology in="SourceAlpha"> would just outline the whole rect.
export async function sanitizeRaster(file) {
  if (!file || !RASTER_MIME_RE.test(file.type)) {
    throw new Error("PNG / GIF / WebP のみ対応");
  }
  if (file.size > RASTER_LIMITS.maxBytes) {
    throw new Error(`画像が大きすぎます (${Math.round(RASTER_LIMITS.maxBytes / 1024)}KB以下)`);
  }
  const markup = await fileToDataUrl(file);
  const { width, height } = await loadImageSize(markup);
  if (width > RASTER_LIMITS.maxPixels || height > RASTER_LIMITS.maxPixels) {
    throw new Error(`ピクセルサイズが大きすぎます (${RASTER_LIMITS.maxPixels}px以下)`);
  }
  return { markup, width, height, capability: "full" };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("読み込み失敗"));
    r.readAsDataURL(file);
  });
}

function loadImageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("画像として読み込めません"));
    img.src = dataUrl;
  });
}

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

// Convert CSS-style gradient angle (0° = to top, 90° = to right) into a
// pair of endpoints inside the unit square used by SVG's objectBoundingBox.
function gradientEndpoints(angle) {
  const rad = (angle * Math.PI) / 180;
  const vx = Math.sin(rad);
  const vy = -Math.cos(rad);
  return {
    x1: 0.5 - vx * 0.5,
    y1: 0.5 - vy * 0.5,
    x2: 0.5 + vx * 0.5,
    y2: 0.5 + vy * 0.5,
  };
}

// Build a <linearGradient> definition for a paint object. Returns the
// markup string and the paint reference ("url(#id)").
function paintToMarkup(paint, id) {
  if (!paint || paint.type !== "gradient") {
    const color = paint ? paint.color : "#000";
    return { def: "", ref: escapeXml(color) };
  }
  const ep = gradientEndpoints(paint.angle || 0);
  const stops = (paint.stops || [])
    .map((s) => `<stop offset="${s.position}%" stop-color="${escapeXml(s.color)}"/>`)
    .join("");
  const def = `<linearGradient id="${id}" x1="${ep.x1}" y1="${ep.y1}" x2="${ep.x2}" y2="${ep.y2}">${stops}</linearGradient>`;
  return { def, ref: `url(#${id})` };
}

function shadowFilter(id, sh) {
  if (!sh || !sh.enabled) return "";
  // "sharp" style forces blur=0 → hard silhouette shadow.
  const blur = sh.style === "sharp" ? 0 : sh.blur;
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">`
    + `<feDropShadow dx="${sh.x}" dy="${sh.y}" stdDeviation="${blur / 2}" flood-color="${escapeXml(sh.color)}"/>`
    + `</filter>`;
}

// Text mode: three stacked <text> elements — wide stroke, inner stroke, fill.
function renderText(logo) {
  const {
    source, fontFamily, fontSize, fontWeight, italic, letterSpacing,
    fill, stroke1, stroke2, shadow,
  } = logo;

  // Rough box sized off font metrics; viewBox lets it scale to any container.
  const pad = Math.max(20, outwardPadding(stroke1, stroke2, null) + 12);
  const approxW = Math.max(120, (source.value || " ").length * fontSize * 0.62 + pad * 2);
  const approxH = fontSize * 1.35 + pad * 2;

  const common = `x="50%" y="50%" text-anchor="middle" dominant-baseline="central" `
    + `font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" `
    + `font-style="${italic ? "italic" : "normal"}" letter-spacing="${letterSpacing}"`;
  const label = escapeXml(source.value || "");

  const filterId = "logo-shadow";
  const filterMarkup = shadowFilter(filterId, shadow);
  const filterAttr = shadow && shadow.enabled ? ` filter="url(#${filterId})"` : "";

  // Paints (solid or linear gradient) are turned into <linearGradient> defs
  // when needed and referenced by url(#id) on the corresponding text layer.
  const fillPaint = paintToMarkup(fill, "logo-fill");
  const s1Paint = paintToMarkup(stroke1.paint, "logo-stroke1");
  const s2Paint = paintToMarkup(stroke2.paint, "logo-stroke2");

  // Each outline layer fills its glyph body with the same paint as its
  // stroke, so the band the next layer covers is solid — no background
  // shows through when stroke widths are large.
  const layers = [];
  if (stroke2.enabled) {
    const w = outerStrokeWidth(stroke1, stroke2);
    layers.push(`<text ${common} fill="${s2Paint.ref}" stroke="${s2Paint.ref}" stroke-width="${w}" stroke-linejoin="round">${label}</text>`);
  }
  if (stroke1.enabled) {
    layers.push(`<text ${common} fill="${s1Paint.ref}" stroke="${s1Paint.ref}" stroke-width="${stroke1.width * 2}" stroke-linejoin="round">${label}</text>`);
  }
  layers.push(`<text ${common} fill="${fillPaint.ref}">${label}</text>`);

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${approxW} ${approxH}" preserveAspectRatio="xMidYMid meet">`
    + `<defs>${filterMarkup}${fillPaint.def}${s1Paint.def}${s2Paint.def}</defs>`
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
      // Uploaded SVGs usually have a viewBox that fits the original shapes
      // tightly. Adding an outline pushes the stroke beyond that box and
      // gets clipped by the SVG's overflow, so grow the viewBox by the
      // total outward extent (both outlines + shadow blur/offset).
      expandViewBox(svg, outwardPadding(stroke1, stroke2, shadow));

      // Snapshot the whole current children so clones preserve any wrapping
      // <g transform="…"> the shapes live under.
      const original = Array.from(svg.childNodes);

      const fillPaint = paintToMarkup(fill, "logo-fill");
      const s1Paint = paintToMarkup(stroke1.paint, "logo-stroke1");
      const s2Paint = paintToMarkup(stroke2.paint, "logo-stroke2");

      const buildOutlineLayer = (ref, width) => {
        const layer = doc.createElementNS(SVG_NS, "g");
        // fill + stroke both set to same paint → no cavity between layers.
        layer.setAttribute("fill", ref);
        layer.setAttribute("stroke", ref);
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

      // Wipe svg children, then stack: defs → stroke2 → stroke1 → fill.
      for (const n of original) svg.removeChild(n);

      const defsMarkup = fillPaint.def + s1Paint.def + s2Paint.def;
      if (defsMarkup) {
        const defs = doc.createElementNS(SVG_NS, "defs");
        defs.insertAdjacentHTML("beforeend", defsMarkup);
        svg.appendChild(defs);
      }

      if (stroke2.enabled) svg.appendChild(buildOutlineLayer(s2Paint.ref, outerStrokeWidth(stroke1, stroke2)));
      if (stroke1.enabled) svg.appendChild(buildOutlineLayer(s1Paint.ref, stroke1.width * 2));
      svg.appendChild(buildFillLayer(doc, original, fillPaint.ref));
    }
  }

  if (shadow && shadow.enabled) {
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = doc.createElementNS(SVG_NS, "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.insertAdjacentHTML("beforeend", shadowFilter("logo-shadow", shadow));
    svg.setAttribute("filter", "url(#logo-shadow)");
  }

  return new XMLSerializer().serializeToString(svg);
}

function buildFillLayer(doc, originalChildren, ref) {
  const layer = doc.createElementNS(SVG_NS, "g");
  layer.setAttribute("fill", ref);
  layer.setAttribute("stroke", "none");
  for (const n of originalChildren) {
    const c = n.cloneNode(true);
    if (c.nodeType === 1) stripFillStroke(c);
    layer.appendChild(c);
  }
  return layer;
}

// Visible outward extent of a stacked-outline layer, in SVG user units.
// stroke2 sits under stroke1, so its stroke-width has to cover both.
function outerStrokeWidth(stroke1, stroke2) {
  return (stroke1.enabled ? stroke1.width : 0) * 2 + stroke2.width * 2;
}

function outwardPadding(stroke1, stroke2, shadow) {
  const s1 = stroke1.enabled ? stroke1.width : 0;
  const s2 = stroke2.enabled ? stroke2.width : 0;
  const sh = shadow && shadow.enabled
    ? Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) + shadow.blur
    : 0;
  return s1 + s2 + sh;
}

function expandViewBox(svg, pad) {
  if (!pad) return;
  const raw = svg.getAttribute("viewBox");
  if (!raw) return;
  const parts = raw.split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return;
  const [x, y, w, h] = parts;
  svg.setAttribute("viewBox", `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`);
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
      .replace(/(^|;)\s*(?:fill|stroke|stroke-width)\s*:[^;]*/gi, "$1")
      .replace(/;;+/g, ";").replace(/^;|;$/g, "");
    if (cleaned) node.setAttribute("style", cleaned);
    else node.removeAttribute("style");
  }
  for (const child of Array.from(node.childNodes)) stripFillStroke(child);
}

// Raster mode: paint the outline as a colored/gradient rect masked by a
// dilated copy of the image alpha channel (feMorphology on SourceAlpha).
// Body stays as the raw <image>, unless recolor is on — then it's a rect
// filled with the body paint and masked by the original alpha.
function renderRasterLogo(logo) {
  const { source, fill, stroke1, stroke2, shadow, recolor } = logo;
  const { markup: href, width: iw, height: ih } = source;
  if (!href || !iw || !ih) {
    return renderText({ ...logo, source: { ...source, value: "(画像なし)" } });
  }

  const pad = outwardPadding(stroke1, stroke2, shadow);
  const vbX = -pad, vbY = -pad, vbW = iw + pad * 2, vbH = ih + pad * 2;
  const url = escapeXml(href);

  const fillPaint = paintToMarkup(fill, "logo-fill");
  const s1Paint = paintToMarkup(stroke1.paint, "logo-stroke1");
  const s2Paint = paintToMarkup(stroke2.paint, "logo-stroke2");

  // radius is in image user units — same coordinate space as stroke widths
  // elsewhere. stroke2 sits under stroke1 so it must dilate further.
  const s1r = stroke1.width;
  const s2r = (stroke1.enabled ? stroke1.width : 0) + stroke2.width;

  const dilateFilter = (id, radius) =>
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">`
    + `<feMorphology in="SourceAlpha" operator="dilate" radius="${radius}"/>`
    + `</filter>`;

  const alphaMask = (id, filter) =>
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" style="mask-type:alpha">`
    + `<image href="${url}" x="0" y="0" width="${iw}" height="${ih}"${filter ? ` filter="url(#${filter})"` : ""}/>`
    + `</mask>`;

  const defs = [
    fillPaint.def, s1Paint.def, s2Paint.def,
    stroke2.enabled ? dilateFilter("logo-dilate-s2", s2r) : "",
    stroke1.enabled ? dilateFilter("logo-dilate-s1", s1r) : "",
    stroke2.enabled ? alphaMask("logo-mask-s2", "logo-dilate-s2") : "",
    stroke1.enabled ? alphaMask("logo-mask-s1", "logo-dilate-s1") : "",
    recolor.enabled ? alphaMask("logo-mask-body", null) : "",
    shadowFilter("logo-shadow", shadow),
  ].join("");

  const shadowAttr = shadow && shadow.enabled ? ` filter="url(#logo-shadow)"` : "";

  const layers = [];
  if (stroke2.enabled) {
    layers.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${s2Paint.ref}" mask="url(#logo-mask-s2)"/>`);
  }
  if (stroke1.enabled) {
    layers.push(`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="${s1Paint.ref}" mask="url(#logo-mask-s1)"/>`);
  }
  if (recolor.enabled) {
    layers.push(`<rect x="0" y="0" width="${iw}" height="${ih}" fill="${fillPaint.ref}" mask="url(#logo-mask-body)"/>`);
  } else {
    layers.push(`<image href="${url}" x="0" y="0" width="${iw}" height="${ih}"/>`);
  }

  return `<svg xmlns="${SVG_NS}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet">`
    + `<defs>${defs}</defs>`
    + `<g${shadowAttr}>${layers.join("")}</g>`
    + `</svg>`;
}

export function renderLogoSvg(logo) {
  if (!logo) return "";
  const t = logo.source && logo.source.type;
  if (t === "svg") return renderUploadedSvg(logo);
  if (t === "raster") return renderRasterLogo(logo);
  return renderText(logo);
}
