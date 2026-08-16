// UIBridge — output generators for the 3 formats defined in spec §6.4:
//   html: HTML markup with inline CSS for each part
//   vars: :root CSS custom properties + reusable class rules
//   text: Japanese natural-language description

import { overlayToCss, overlayLabel } from "./overlay.js";
import { renderLogoSvg } from "./logo.js";

function bgToCss(bg) {
  if (!bg) return "transparent";
  if (bg.type === "gradient") {
    const stops = bg.stops.map((s) => `${s.color} ${s.position}%`).join(", ");
    return `linear-gradient(${bg.angle}deg, ${stops})`;
  }
  return bg.color;
}

// Same composition rule as the renderer: if an overlay exists, wrap solid
// base in a flat gradient so both layers are valid <image> values.
function composedBg(base, overlay) {
  const overlayCss = overlayToCss(overlay);
  if (!overlayCss) return bgToCss(base);
  const baseImg = base && base.type === "gradient"
    ? bgToCss(base)
    : `linear-gradient(${base ? base.color || base : "transparent"}, ${base ? base.color || base : "transparent"})`;
  return `${overlayCss}, ${baseImg}`;
}

function styleString(pairs) {
  return pairs
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

function buttonStyle(btn) {
  const border = btn.borderWidth > 0
    ? `${btn.borderWidth}px solid ${btn.borderColor}`
    : "none";
  return styleString([
    ["background", composedBg(btn.background, btn.overlay)],
    ["color", btn.textColor],
    ["border", border],
    ["border-radius", `${btn.radius}px`],
    ["padding", `${btn.paddingY}px ${btn.paddingX}px`],
    ["font-size", `${btn.fontSize}px`],
    ["font-weight", btn.fontWeight],
    ["box-shadow", btn.shadow || "none"],
  ]);
}

function cardStyle(card) {
  const border = card.borderWidth > 0
    ? `${card.borderWidth}px solid ${card.borderColor}`
    : "none";
  return styleString([
    ["background", composedBg({ type: "solid", color: card.background }, card.overlay)],
    ["border", border],
    ["border-radius", `${card.borderRadius}px`],
    ["padding", `${card.padding}px`],
    ["box-shadow", card.shadow || "none"],
  ]);
}

function inputStyle(inp) {
  const border = inp.borderWidth > 0
    ? `${inp.borderWidth}px solid ${inp.borderColor}`
    : "none";
  return styleString([
    ["background", inp.background],
    ["color", inp.textColor],
    ["border", border],
    ["border-radius", `${inp.borderRadius}px`],
    ["padding", `${inp.paddingY}px ${inp.paddingX}px`],
  ]);
}

function bgStyle(bg) {
  return `background: ${bgToCss(bg)};`;
}

// --- Format A: HTML + inline CSS --------------------------------------

export function toHtml(state) {
  const { parts } = state;
  const logo = parts.logo ? indent(renderLogoSvg(parts.logo), "  ") : "";
  return [
    `<div style="${bgStyle(parts.background)} padding: 24px;">`,
    logo && `  ${logo.trim()}`,
    logo && ``,
    `  <button style="${buttonStyle(parts.button)}">Click me</button>`,
    ``,
    `  <div style="${cardStyle(parts.card)}">`,
    `    <h3 style="margin: 0 0 8px;">Card title</h3>`,
    `    <p style="margin: 0;">Card body text.</p>`,
    `  </div>`,
    ``,
    `  <input type="text" placeholder="入力…" style="${inputStyle(parts.input)}">`,
    `</div>`,
  ].filter((l) => l !== false && l !== undefined).join("\n");
}

function indent(text, pad) {
  return text.split("\n").map((l) => pad + l).join("\n");
}

// --- Format B: CSS variables + class rules ----------------------------

export function toCssVars(state) {
  const { tokens, parts } = state;
  const btn = parts.button;
  const card = parts.card;
  const inp = parts.input;

  const lines = [];
  lines.push(":root {");
  lines.push(`  --color-primary: ${tokens.colors.primary};`);
  lines.push(`  --color-secondary: ${tokens.colors.secondary};`);
  lines.push(`  --color-text: ${tokens.colors.text};`);
  lines.push(`  --color-text-muted: ${tokens.colors.textMuted};`);
  lines.push(``);
  lines.push(`  --page-bg: ${bgToCss(parts.background)};`);
  lines.push(``);
  lines.push(`  --btn-bg: ${composedBg(btn.background, btn.overlay)};`);
  lines.push(`  --btn-text: ${btn.textColor};`);
  lines.push(`  --btn-radius: ${btn.radius}px;`);
  lines.push(`  --btn-border: ${btn.borderWidth > 0 ? `${btn.borderWidth}px solid ${btn.borderColor}` : "none"};`);
  lines.push(`  --btn-shadow: ${btn.shadow || "none"};`);
  lines.push(`  --btn-padding: ${btn.paddingY}px ${btn.paddingX}px;`);
  lines.push(`  --btn-font-size: ${btn.fontSize}px;`);
  lines.push(`  --btn-font-weight: ${btn.fontWeight};`);
  lines.push(``);
  lines.push(`  --card-bg: ${composedBg({ type: "solid", color: card.background }, card.overlay)};`);
  lines.push(`  --card-radius: ${card.borderRadius}px;`);
  lines.push(`  --card-border: ${card.borderWidth > 0 ? `${card.borderWidth}px solid ${card.borderColor}` : "none"};`);
  lines.push(`  --card-shadow: ${card.shadow || "none"};`);
  lines.push(`  --card-padding: ${card.padding}px;`);
  lines.push(``);
  lines.push(`  --input-bg: ${inp.background};`);
  lines.push(`  --input-text: ${inp.textColor};`);
  lines.push(`  --input-radius: ${inp.borderRadius}px;`);
  lines.push(`  --input-border: ${inp.borderWidth > 0 ? `${inp.borderWidth}px solid ${inp.borderColor}` : "none"};`);
  lines.push(`  --input-padding: ${inp.paddingY}px ${inp.paddingX}px;`);
  lines.push("}");
  lines.push("");
  lines.push("body { background: var(--page-bg); color: var(--color-text); }");
  lines.push("");
  lines.push(".btn {");
  lines.push("  background: var(--btn-bg);");
  lines.push("  color: var(--btn-text);");
  lines.push("  border: var(--btn-border);");
  lines.push("  border-radius: var(--btn-radius);");
  lines.push("  padding: var(--btn-padding);");
  lines.push("  font-size: var(--btn-font-size);");
  lines.push("  font-weight: var(--btn-font-weight);");
  lines.push("  box-shadow: var(--btn-shadow);");
  lines.push("}");
  lines.push("");
  lines.push(".card {");
  lines.push("  background: var(--card-bg);");
  lines.push("  border: var(--card-border);");
  lines.push("  border-radius: var(--card-radius);");
  lines.push("  padding: var(--card-padding);");
  lines.push("  box-shadow: var(--card-shadow);");
  lines.push("}");
  lines.push("");
  lines.push(".input {");
  lines.push("  background: var(--input-bg);");
  lines.push("  color: var(--input-text);");
  lines.push("  border: var(--input-border);");
  lines.push("  border-radius: var(--input-radius);");
  lines.push("  padding: var(--input-padding);");
  lines.push("}");
  return lines.join("\n");
}

// --- Format C: Japanese natural-language description ------------------

function describeBackground(bg) {
  if (bg.type === "gradient") {
    const [a, b] = bg.stops;
    return `${bg.angle}度のグラデーション、開始色 ${a.color}（${a.position}%）→ 終了色 ${b.color}（${b.position}%）`;
  }
  return `単色 ${bg.color}`;
}

// Logo paints share the {type, color, angle, stops} shape with backgrounds,
// so reuse describeBackground for consistent wording.
const describePaint = (p) => (p ? describeBackground(p) : "なし");

function describeBorder(width, color) {
  return width > 0 ? `${width}px（${color}）` : "なし";
}

function describeOverlay(overlay) {
  if (!overlay || overlay.type === "none") return "なし";
  const pct = Math.round((Number(overlay.opacity) || 0) * 100);
  return `${overlayLabel(overlay.type)}（濃度${pct}%）`;
}

export function toText(state) {
  const { parts } = state;
  const bg = parts.background;
  const btn = parts.button;
  const card = parts.card;
  const inp = parts.input;

  const lines = [];
  lines.push("【背景】");
  lines.push(`- ${describeBackground(bg)}`);
  lines.push("");
  lines.push("【ボタン】");
  lines.push(`- 背景: ${describeBackground(btn.background)}`);
  lines.push(`- オーバーレイ: ${describeOverlay(btn.overlay)}`);
  lines.push(`- 文字色: ${btn.textColor}`);
  lines.push(`- 角丸: ${btn.radius}px`);
  lines.push(`- 枠線: ${describeBorder(btn.borderWidth, btn.borderColor)}`);
  lines.push(`- 影: ${btn.shadow || "なし"}`);
  lines.push(`- パディング: 縦${btn.paddingY}px、横${btn.paddingX}px`);
  lines.push(`- フォント: ${btn.fontSize}px、太さ${btn.fontWeight}`);
  lines.push("");
  lines.push("【カード】");
  lines.push(`- 背景: ${card.background}`);
  lines.push(`- オーバーレイ: ${describeOverlay(card.overlay)}`);
  lines.push(`- 角丸: ${card.borderRadius}px`);
  lines.push(`- 枠線: ${describeBorder(card.borderWidth, card.borderColor)}`);
  lines.push(`- 影: ${card.shadow || "なし"}`);
  lines.push(`- 内側余白: ${card.padding}px`);
  lines.push("");
  if (parts.logo) {
    const l = parts.logo;
    lines.push("【ロゴ】");
    lines.push(`- 表示サイズ: ${l.size}px`);
    if (l.source.type === "svg") {
      lines.push(`- ソース: SVGアップロード（${l.source.value || "unnamed.svg"}、${l.source.capability === "full" ? "編集可" : "表示のみ"}）`);
    } else {
      lines.push(`- テキスト: 「${l.source.value}」`);
      lines.push(`- フォント: ${l.fontFamily}、${l.fontSize}px、太さ${l.fontWeight}${l.italic ? "、斜体" : ""}`);
    }
    if (l.source.type === "text" || l.source.capability === "full") {
      lines.push(`- 本体: ${describePaint(l.fill)}`);
      lines.push(`- アウトライン: ${l.stroke1.enabled ? `${l.stroke1.width}px、${describePaint(l.stroke1.paint)}` : "なし"}`);
      lines.push(`- 追加アウトライン: ${l.stroke2.enabled ? `${l.stroke2.width}px、${describePaint(l.stroke2.paint)}` : "なし"}`);
    }
    lines.push(`- 影: ${l.shadow.enabled ? `x${l.shadow.x} y${l.shadow.y} blur${l.shadow.blur} ${l.shadow.color}` : "なし"}`);
    lines.push("");
  }
  lines.push("【入力欄】");
  lines.push(`- 背景: ${inp.background}`);
  lines.push(`- 文字色: ${inp.textColor}`);
  lines.push(`- 角丸: ${inp.borderRadius}px`);
  lines.push(`- 枠線: ${describeBorder(inp.borderWidth, inp.borderColor)}`);
  lines.push(`- パディング: 縦${inp.paddingY}px、横${inp.paddingX}px`);
  return lines.join("\n");
}

// --- Dialog wiring ----------------------------------------------------

const generators = { html: toHtml, vars: toCssVars, text: toText };

export function initOutput({ getState }) {
  const dialog = document.getElementById("output-dialog");
  const openBtn = document.getElementById("output-open");
  const closeBtn = document.getElementById("output-close");
  const copyBtn = document.getElementById("output-copy");
  const tabs = document.getElementById("output-tabs");
  const codeEl = document.getElementById("output-code");
  let format = "html";

  function refresh() {
    codeEl.textContent = generators[format](getState());
  }

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-format]");
    if (!btn) return;
    format = btn.dataset.format;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    refresh();
  });

  openBtn.addEventListener("click", () => {
    refresh();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });

  closeBtn.addEventListener("click", () => dialog.close());

  // Click outside the dialog surface closes it.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  copyBtn.addEventListener("click", async () => {
    const text = codeEl.textContent;
    const label = copyBtn.textContent;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: temporary textarea + execCommand.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      copyBtn.textContent = "コピー完了";
    } catch {
      copyBtn.textContent = "コピー失敗";
    }
    setTimeout(() => { copyBtn.textContent = label; }, 1200);
  });
}
