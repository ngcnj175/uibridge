// UIBridge — overlay presets. One optional overlay layer per part, composed
// above the base background to produce highlights/fog/band effects.
// Alpha values are scaled by `opacity` (0..1) so a single slider tunes the
// intensity without exposing raw stop editing.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Each builder returns a CSS <image> value (linear-gradient) or null for none.
const builders = {
  none: () => null,
  // Top glass "lens" — bright arc that fades and cuts off around the middle.
  shine: (a) => `linear-gradient(180deg, rgba(255,255,255,${(0.65 * a).toFixed(3)}) 0%, rgba(255,255,255,${(0.12 * a).toFixed(3)}) 45%, rgba(255,255,255,0) 46%)`,
  // Even white fog across the whole surface (frosted look).
  fog: (a) => `linear-gradient(180deg, rgba(255,255,255,${(0.5 * a).toFixed(3)}), rgba(255,255,255,${(0.05 * a).toFixed(3)}))`,
  // Horizontal bright band across the middle.
  band: (a) => `linear-gradient(180deg, rgba(255,255,255,0) 30%, rgba(255,255,255,${(0.5 * a).toFixed(3)}) 45%, rgba(255,255,255,${(0.5 * a).toFixed(3)}) 55%, rgba(255,255,255,0) 70%)`,
  // "Dome" highlight — only the bottom half of a large ellipse is visible.
  // Center sits at the button's top edge so the ellipse extends past the top
  // corners (no gap along the rounded top border). Bottom of the ellipse
  // lands exactly at the button's vertical center (H/2 + Y = 50%).
  lens: (a) => `radial-gradient(ellipse 120% 100% at 50% 0%, rgba(255,255,255,${(0.65 * a).toFixed(3)}) 0%, rgba(255,255,255,${(0.60 * a).toFixed(3)}) 88%, rgba(255,255,255,${(0.10 * a).toFixed(3)}) 97%, rgba(255,255,255,0) 100%)`,
};

export const overlayTypes = ["none", "shine", "lens", "fog", "band"];

export function overlayLabel(type) {
  return { none: "なし", shine: "上部光沢", lens: "レンズ光沢", fog: "白フォグ", band: "中央帯" }[type] || type;
}

export function overlayToCss(overlay) {
  if (!overlay || overlay.type === "none") return null;
  const build = builders[overlay.type];
  if (!build) return null;
  const alpha = clamp(Number(overlay.opacity), 0, 1);
  if (alpha <= 0) return null;
  return build(alpha);
}
