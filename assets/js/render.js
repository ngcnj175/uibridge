// UIBridge — apply state (tokens + parts) to the preview DOM via CSS variables.
// Kept renderer-only: no event wiring, no persistence.

import { defaultTokens, defaultParts, clone } from "./state.js";

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

function bgToCss(bg) {
  if (!bg) return "transparent";
  if (bg.type === "gradient") {
    const stops = bg.stops.map((s) => `${s.color} ${s.position}%`).join(", ");
    return `linear-gradient(${bg.angle}deg, ${stops})`;
  }
  return bg.color;
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

  // Button
  s.setProperty("--btn-bg", bgToCss(parts.button.background));
  s.setProperty("--btn-text", parts.button.textColor);
  s.setProperty("--btn-radius", `${parts.button.radius}px`);
  s.setProperty("--btn-border-width", `${parts.button.borderWidth}px`);
  s.setProperty("--btn-border-color", parts.button.borderColor);
  s.setProperty("--btn-shadow", parts.button.shadow || "none");
  s.setProperty("--btn-pad-x", `${parts.button.paddingX}px`);
  s.setProperty("--btn-pad-y", `${parts.button.paddingY}px`);
  s.setProperty("--btn-font-size", `${parts.button.fontSize}px`);
  s.setProperty("--btn-font-weight", String(parts.button.fontWeight));

  // Card
  s.setProperty("--card-bg", parts.card.background);
  s.setProperty("--card-radius", `${parts.card.borderRadius}px`);
  s.setProperty("--card-border-width", `${parts.card.borderWidth}px`);
  s.setProperty("--card-border-color", parts.card.borderColor);
  s.setProperty("--card-shadow", parts.card.shadow || "none");
  s.setProperty("--card-padding", `${parts.card.padding}px`);

  // Input
  s.setProperty("--input-bg", parts.input.background);
  s.setProperty("--input-text", parts.input.textColor);
  s.setProperty("--input-radius", `${parts.input.borderRadius}px`);
  s.setProperty("--input-border-width", `${parts.input.borderWidth}px`);
  s.setProperty("--input-border-color", parts.input.borderColor);
  s.setProperty("--input-pad-x", `${parts.input.paddingX}px`);
  s.setProperty("--input-pad-y", `${parts.input.paddingY}px`);
}
