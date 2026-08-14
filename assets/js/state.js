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
  },
  card: {
    background: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadow: "0 2px 8px rgba(0,0,0,0.06)",
    padding: 16,
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
};

// Deep clone via structured JSON — tokens/parts are plain data.
export const clone = (v) => JSON.parse(JSON.stringify(v));

export function makeState(tokens = defaultTokens, parts = defaultParts) {
  return { tokens: clone(tokens), parts: clone(parts) };
}
