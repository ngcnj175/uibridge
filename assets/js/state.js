// UIBridge — data model and defaults.
// Shapes match §5 of uibridge-spec.md. Keep this file free of DOM code.

export const defaultTokens = {
  colors: {
    primary: "#667eea",
    secondary: "#764ba2",
    background: "#ffffff",
    surface: "#f5f5f5",
    text: "#1a1a1a",
    textMuted: "#666666",
    border: "#e0e0e0",
  },
  radius: { sm: 4, md: 8, lg: 12, xl: 20, full: 9999 },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 25px rgba(0,0,0,0.15)",
  },
  border: { width: 1, style: "solid" },
  spacing: { unit: 4 },
};

export const defaultParts = {
  background: { type: "solid", color: "#ffffff" },
  button: {
    background: {
      type: "gradient",
      angle: 135,
      stops: [
        { color: "#667eea", position: 0 },
        { color: "#764ba2", position: 100 },
      ],
    },
    textColor: "#ffffff",
    radius: 12,
    borderWidth: 0,
    borderColor: "transparent",
    shadow: "0 4px 15px rgba(102,126,234,0.4)",
    paddingX: 24,
    paddingY: 12,
    fontSize: 16,
    fontWeight: 600,
    overlay: { type: "none", opacity: 1 },
  },
  card: {
    background: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadow: "0 2px 8px rgba(0,0,0,0.06)",
    padding: 16,
    overlay: { type: "none", opacity: 1 },
  },
  input: {
    background: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    textColor: "#1a1a1a",
    paddingX: 12,
    paddingY: 10,
  },
  logo: {
    // source.type: "text" | "svg". For "svg", `markup` holds the sanitized
    // <svg>…</svg> string; `capability` reports what edits are safe to apply
    // ("full" = fill/stroke overrides, "display" = render only).
    source: { type: "text", value: "UIBridge", markup: "", capability: "full" },
    fontFamily: "system-ui",
    fontSize: 96,
    fontWeight: 700,
    italic: false,
    letterSpacing: 0,
    // Rendered display size (px), applied as max-width/max-height on the
    // SVG in the stage. Independent of fontSize so text weight/proportion
    // can differ from displayed pixel size.
    size: 300,
    // A "paint" object represents a fill or stroke color: either a solid
    // hex or a two-stop linear gradient. Keeping the same shape across
    // fill/stroke1/stroke2 lets the panel reuse one set of fields.
    fill: {
      type: "solid",
      color: "#667eea",
      angle: 135,
      stops: [
        { color: "#667eea", position: 0 },
        { color: "#764ba2", position: 100 },
      ],
    },
    // stroke1 is the inner outline, stroke2 wraps around stroke1.
    stroke1: {
      enabled: true,
      width: 4,
      paint: {
        type: "solid",
        color: "#ffffff",
        angle: 135,
        stops: [
          { color: "#ffffff", position: 0 },
          { color: "#c0c0c0", position: 100 },
        ],
      },
    },
    stroke2: {
      enabled: false,
      width: 10,
      paint: {
        type: "solid",
        color: "#1a1a1a",
        angle: 135,
        stops: [
          { color: "#1a1a1a", position: 0 },
          { color: "#404040", position: 100 },
        ],
      },
    },
    shadow: { enabled: false, x: 0, y: 4, blur: 8, color: "rgba(0,0,0,0.3)" },
  },
};

// Deep clone via structured JSON — tokens/parts are plain data.
export const clone = (v) => JSON.parse(JSON.stringify(v));

export function makeState(tokens = defaultTokens, parts = defaultParts) {
  return { tokens: clone(tokens), parts: clone(parts) };
}
