// UIBridge — apply state (tokens + parts) to the preview DOM via CSS variables.
// Kept renderer-only: no event wiring, no persistence.

import { defaultTokens, defaultParts, clone } from "./state.js";
import { overlayToCss } from "./overlay.js";
import { renderLogoSvg } from "./logo.js";

// Shallow-per-key deep merge sufficient for our 2-level shapes.
function mergeDeep(base, over) {
  if (over == null) return clone(base);
  if (typeof base !== "object" || Array.isArray(base) || typeof over !== "object" || Array.isArray(over)) {
    return clone(over);
  }
  const out = clone(base);
  for (const k of Object.keys(over)) out[k] = mergeDeep(base[k], over[k]);
  return out;
}

export function resolvePreset(preset) {
  return {
    tokens: mergeDeep(defaultTokens, preset.tokens || {}),
    parts: mergeDeep(defaultParts, preset.parts || {}),
  };
}

// Backfills any fields added in later versions (e.g. overlay) so persisted
// or user-saved states from earlier builds still render / edit safely.
export function migrateState(state) {
  return {
    tokens: mergeDeep(defaultTokens, state.tokens || {}),
    parts: mergeDeep(defaultParts, state.parts || {}),
  };
}

export function bgToCss(bg) {
  if (!bg) return "transparent";
  if (bg.type === "gradient") {
    const stops = bg.stops.map((s) => `${s.color} ${s.position}%`).join(", ");
    return `linear-gradient(${bg.angle}deg, ${stops})`;
  }
  return bg.color;
}

// Normalize a base background into a single CSS <image>, so it can be safely
// stacked under an overlay layer (a solid color is wrapped in a flat gradient).
function bgAsImage(bg) {
  if (!bg) return null;
  if (bg.type === "gradient") return bgToCss(bg);
  return `linear-gradient(${bg.color}, ${bg.color})`;
}

// Compose overlay + base into a background shorthand value; falls back to the
// plain base when there is no overlay so simple presets stay simple.
export function composeBackground(base, overlay) {
  const overlayCss = overlayToCss(overlay);
  if (!overlayCss) return bgToCss(base);
  return `${overlayCss}, ${bgAsImage(base)}`;
}

export function applyState(root, state) {
  const { tokens, parts } = state;
  const s = root.style;

  // Tokens
  s.setProperty("--color-primary", tokens.colors.primary);
  s.setProperty("--color-secondary", tokens.colors.secondary);
  s.setProperty("--text-color", tokens.colors.text);
  s.setProperty("--text-muted", tokens.colors.textMuted);

  // Background
  s.setProperty("--bg-color", bgToCss(parts.background));

  // Button — overlay (if any) is composed above the base background.
  s.setProperty("--btn-bg", composeBackground(parts.button.background, parts.button.overlay));
  s.setProperty("--btn-text", parts.button.textColor);
  s.setProperty("--btn-radius", `${parts.button.radius}px`);
  s.setProperty("--btn-border-width", `${parts.button.borderWidth}px`);
  s.setProperty("--btn-border-color", parts.button.borderColor);
  s.setProperty("--btn-shadow", parts.button.shadow || "none");
  s.setProperty("--btn-pad-x", `${parts.button.paddingX}px`);
  s.setProperty("--btn-pad-y", `${parts.button.paddingY}px`);
  s.setProperty("--btn-font-size", `${parts.button.fontSize}px`);
  s.setProperty("--btn-font-weight", String(parts.button.fontWeight));

  // Card — same overlay treatment. Card background is a plain color string,
  // so wrap it in a synthetic gradient object when we need to stack.
  const cardBase = { type: "solid", color: parts.card.background };
  s.setProperty("--card-bg", composeBackground(cardBase, parts.card.overlay));
  s.setProperty("--card-radius", `${parts.card.borderRadius}px`);
  s.setProperty("--card-border-width", `${parts.card.borderWidth}px`);
  s.setProperty("--card-border-color", parts.card.borderColor);
  s.setProperty("--card-shadow", parts.card.shadow || "none");
  s.setProperty("--card-padding", `${parts.card.padding}px`);

  // Logo — the SVG itself is regenerated on every state edit and dropped
  // into the stage element. Kept separate from CSS vars because outline
  // stacking is easier to express as inline SVG than as CSS.
  const stage = document.getElementById("logo-stage");
  if (stage && parts.logo) stage.innerHTML = renderLogoSvg(parts.logo);

  // Input
  s.setProperty("--input-bg", parts.input.background);
  s.setProperty("--input-text", parts.input.textColor);
  s.setProperty("--input-radius", `${parts.input.borderRadius}px`);
  s.setProperty("--input-border-width", `${parts.input.borderWidth}px`);
  s.setProperty("--input-border-color", parts.input.borderColor);
  s.setProperty("--input-pad-x", `${parts.input.paddingX}px`);
  s.setProperty("--input-pad-y", `${parts.input.paddingY}px`);
}
