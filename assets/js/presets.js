// UIBridge — 8 built-in presets. Each preset is a partial override of the
// default tokens/parts; loadPreset() in render.js merges over the defaults.

const solid = (color) => ({ type: "solid", color });
const gradient = (angle, from, to) => ({
  type: "gradient",
  angle,
  stops: [
    { color: from, position: 0 },
    { color: to, position: 100 },
  ],
});

export const builtinPresets = [
  {
    id: "preset_simple",
    name: "シンプル（デフォルト）",
    type: "builtin",
    tokens: {},
    parts: {},
  },
  {
    id: "preset_gradient_purple",
    name: "グラデーション（紫→青）",
    type: "builtin",
    tokens: { colors: { primary: "#667eea", secondary: "#764ba2" } },
    parts: {
      background: solid("#f7f8ff"),
      button: {
        background: gradient(135, "#667eea", "#764ba2"),
        textColor: "#ffffff",
        radius: 14,
        borderWidth: 0,
        shadow: "0 6px 20px rgba(102,126,234,0.45)",
      },
      card: { background: "#ffffff", borderRadius: 14, borderColor: "#e6e7f2", shadow: "0 6px 18px rgba(102,126,234,0.10)" },
    },
  },
  {
    id: "preset_gradient_sunset",
    name: "グラデーション（オレンジ→ピンク）",
    type: "builtin",
    tokens: { colors: { primary: "#ff8a3d", secondary: "#ff4d8d" } },
    parts: {
      background: solid("#fff6f0"),
      button: {
        background: gradient(120, "#ff8a3d", "#ff4d8d"),
        textColor: "#ffffff",
        radius: 999,
        borderWidth: 0,
        shadow: "0 8px 22px rgba(255,77,141,0.35)",
        paddingX: 28,
      },
      card: { background: "#ffffff", borderRadius: 16, borderColor: "#f6dccb", shadow: "0 4px 14px rgba(255,138,61,0.12)" },
    },
  },
  {
    id: "preset_flat",
    name: "単色フラット",
    type: "builtin",
    tokens: { colors: { primary: "#2b7cff" } },
    parts: {
      background: solid("#ffffff"),
      button: {
        background: solid("#2b7cff"),
        textColor: "#ffffff",
        radius: 6,
        borderWidth: 0,
        shadow: "none",
        fontWeight: 600,
      },
      card: { background: "#ffffff", borderRadius: 6, borderColor: "#e6e8ec", shadow: "none" },
      input: { background: "#ffffff", borderRadius: 6, borderColor: "#cfd3da" },
    },
  },
  {
    id: "preset_neumorphism_light",
    name: "ニューモフィズム（ライト）",
    type: "builtin",
    tokens: { colors: { text: "#3a3f4b", textMuted: "#7c8494" } },
    parts: {
      background: solid("#e6e9ef"),
      button: {
        background: solid("#e6e9ef"),
        textColor: "#3a3f4b",
        radius: 16,
        borderWidth: 0,
        shadow: "6px 6px 12px #c4c8d0, -6px -6px 12px #ffffff",
      },
      card: {
        background: "#e6e9ef",
        borderRadius: 20,
        borderWidth: 0,
        borderColor: "transparent",
        shadow: "8px 8px 16px #c4c8d0, -8px -8px 16px #ffffff",
      },
      input: {
        background: "#e6e9ef",
        borderRadius: 12,
        borderWidth: 0,
        borderColor: "transparent",
        textColor: "#3a3f4b",
      },
    },
  },
  {
    id: "preset_neumorphism_dark",
    name: "ニューモフィズム（ダーク）",
    type: "builtin",
    tokens: { colors: { text: "#e6e9ef", textMuted: "#9aa1b1" } },
    parts: {
      background: solid("#2a2d34"),
      button: {
        background: solid("#2a2d34"),
        textColor: "#e6e9ef",
        radius: 16,
        borderWidth: 0,
        shadow: "6px 6px 12px #1e2026, -6px -6px 12px #363a44",
      },
      card: {
        background: "#2a2d34",
        borderRadius: 20,
        borderWidth: 0,
        borderColor: "transparent",
        shadow: "8px 8px 16px #1e2026, -8px -8px 16px #363a44",
      },
      input: {
        background: "#2a2d34",
        borderRadius: 12,
        borderWidth: 0,
        borderColor: "transparent",
        textColor: "#e6e9ef",
      },
    },
  },
  {
    id: "preset_glass",
    name: "ガラスモーフィズム",
    type: "builtin",
    tokens: { colors: { text: "#1a1a1a", textMuted: "#4a4a58" } },
    parts: {
      background: gradient(160, "#a1c4fd", "#c2e9fb"),
      button: {
        background: solid("rgba(255,255,255,0.35)"),
        textColor: "#1a1a1a",
        radius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        shadow: "0 8px 24px rgba(31,38,135,0.18)",
      },
      card: {
        background: "rgba(255,255,255,0.35)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        shadow: "0 8px 32px rgba(31,38,135,0.18)",
      },
      input: {
        background: "rgba(255,255,255,0.5)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        textColor: "#1a1a1a",
      },
    },
  },
  {
    id: "preset_glass_blue",
    name: "グラスボタン（ブルー）",
    type: "builtin",
    tokens: { colors: { primary: "#159bc5", text: "#0e5b74", textMuted: "#4a7f92" } },
    parts: {
      background: solid("#f5f5f5"),
      button: {
        // 3-stop vertical gradient (top light → mid darker → bottom light).
        background: {
          type: "gradient",
          angle: 180,
          stops: [
            { color: "#d3ecf8", position: 0 },
            { color: "#a9d9ed", position: 50 },
            { color: "#d8eef7", position: 100 },
          ],
        },
        textColor: "#0e5b74",
        radius: 999,
        borderWidth: 7,
        borderColor: "#159bc5",
        // The overlay layer produces the top "shine" lens; the box-shadow
        // just handles the depth (inset bottom shade + subtle drop).
        overlay: { type: "lens", opacity: 1 },
        shadow: "inset 0 -10px 18px rgba(0,0,0,0.08), 0 2px 3px rgba(0,0,0,0.08)",
        paddingX: 40,
        paddingY: 22,
        fontSize: 20,
        fontWeight: 700,
      },
      card: { background: "#ffffff", borderRadius: 20, borderColor: "#d8eef7", shadow: "0 2px 8px rgba(21,155,197,0.10)" },
      input: { background: "#ffffff", borderRadius: 999, borderWidth: 2, borderColor: "#a9d9ed", textColor: "#0e5b74" },
    },
  },
  {
    id: "preset_retro",
    name: "レトロ（ハードシャドウ）",
    type: "builtin",
    tokens: { colors: { primary: "#ffd43b", text: "#111111", textMuted: "#555" } },
    parts: {
      background: solid("#fff8e1"),
      button: {
        background: solid("#ffd43b"),
        textColor: "#111111",
        radius: 4,
        borderWidth: 2,
        borderColor: "#111111",
        shadow: "4px 4px 0 0 #111111",
        fontWeight: 700,
      },
      card: {
        background: "#ffffff",
        borderRadius: 4,
        borderWidth: 2,
        borderColor: "#111111",
        shadow: "6px 6px 0 0 #111111",
      },
      input: {
        background: "#ffffff",
        borderRadius: 4,
        borderWidth: 2,
        borderColor: "#111111",
        textColor: "#111111",
      },
    },
  },
];
