// UIBridge — control panel. Renders form fields for the active part and
// dispatches edits back through an onChange callback.

import { overlayTypes, overlayLabel } from "./overlay.js";

const partSchemas = {
  background: [
    { kind: "bgType", key: "type", label: "背景タイプ" },
    // Solid
    { kind: "color", key: "color", label: "色", when: (b) => b.type === "solid" },
    // Gradient
    { kind: "range", key: "angle", label: "角度", min: 0, max: 360, step: 1, when: (b) => b.type === "gradient" },
    { kind: "gradientStop", key: "stops.0", label: "開始色", when: (b) => b.type === "gradient" },
    { kind: "gradientStop", key: "stops.1", label: "終了色", when: (b) => b.type === "gradient" },
  ],
  button: [
    { kind: "bgType", key: "background.type", label: "背景タイプ" },
    { kind: "color", key: "background.color", label: "背景色", when: (b) => b.background.type === "solid" },
    { kind: "range", key: "background.angle", label: "角度", min: 0, max: 360, step: 1, when: (b) => b.background.type === "gradient" },
    { kind: "gradientStop", key: "background.stops.0", label: "開始色", when: (b) => b.background.type === "gradient" },
    { kind: "gradientStop", key: "background.stops.1", label: "終了色", when: (b) => b.background.type === "gradient" },
    { kind: "overlayType", key: "overlay.type", label: "オーバーレイ" },
    { kind: "range", key: "overlay.opacity", label: "オーバーレイ濃度", min: 0, max: 1, step: 0.05, when: (b) => b.overlay && b.overlay.type !== "none" },
    { kind: "color", key: "textColor", label: "文字色" },
    { kind: "range", key: "radius", label: "角丸", min: 0, max: 40, step: 1, unit: "px" },
    { kind: "range", key: "borderWidth", label: "枠線太さ", min: 0, max: 8, step: 1, unit: "px" },
    { kind: "color", key: "borderColor", label: "枠線色" },
    { kind: "text", key: "shadow", label: "影 (CSS)" },
    { kind: "range", key: "paddingX", label: "左右余白", min: 0, max: 48, step: 1, unit: "px" },
    { kind: "range", key: "paddingY", label: "上下余白", min: 0, max: 32, step: 1, unit: "px" },
    { kind: "range", key: "fontSize", label: "文字サイズ", min: 10, max: 24, step: 1, unit: "px" },
    { kind: "range", key: "fontWeight", label: "文字太さ", min: 300, max: 900, step: 100 },
  ],
  card: [
    { kind: "color", key: "background", label: "背景色" },
    { kind: "overlayType", key: "overlay.type", label: "オーバーレイ" },
    { kind: "range", key: "overlay.opacity", label: "オーバーレイ濃度", min: 0, max: 1, step: 0.05, when: (b) => b.overlay && b.overlay.type !== "none" },
    { kind: "range", key: "borderRadius", label: "角丸", min: 0, max: 40, step: 1, unit: "px" },
    { kind: "range", key: "borderWidth", label: "枠線太さ", min: 0, max: 8, step: 1, unit: "px" },
    { kind: "color", key: "borderColor", label: "枠線色" },
    { kind: "text", key: "shadow", label: "影 (CSS)" },
    { kind: "range", key: "padding", label: "内側余白", min: 0, max: 40, step: 1, unit: "px" },
  ],
  input: [
    { kind: "color", key: "background", label: "背景色" },
    { kind: "color", key: "textColor", label: "文字色" },
    { kind: "range", key: "borderRadius", label: "角丸", min: 0, max: 40, step: 1, unit: "px" },
    { kind: "range", key: "borderWidth", label: "枠線太さ", min: 0, max: 8, step: 1, unit: "px" },
    { kind: "color", key: "borderColor", label: "枠線色" },
    { kind: "range", key: "paddingX", label: "左右余白", min: 0, max: 32, step: 1, unit: "px" },
    { kind: "range", key: "paddingY", label: "上下余白", min: 0, max: 24, step: 1, unit: "px" },
  ],
};

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
}
function set(obj, path, value) {
  const keys = path.split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) n.append(c);
  return n;
}

function renderField(spec, partData, onChange) {
  if (spec.when && !spec.when(partData)) return null;
  const value = get(partData, spec.key);
  const wrap = el("div", { class: "field" });
  wrap.append(el("label", {}, spec.label));

  if (spec.kind === "color") {
    const input = el("input", { type: "color", value: normalizeColorForPicker(value) });
    input.addEventListener("input", (e) => onChange(spec.key, e.target.value));
    wrap.append(input, el("span", { class: "value" }, value || ""));
    return wrap;
  }

  if (spec.kind === "range") {
    const range = el("input", { type: "range", min: spec.min, max: spec.max, step: spec.step, value });
    const num = el("input", { type: "number", class: "value value--input", min: spec.min, max: spec.max, step: spec.step, value });
    const clamp = (v) => Math.min(spec.max, Math.max(spec.min, v));
    range.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      num.value = v;
      onChange(spec.key, v);
    });
    num.addEventListener("input", (e) => {
      const raw = Number(e.target.value);
      if (!Number.isFinite(raw)) return;
      const v = clamp(raw);
      range.value = v;
      onChange(spec.key, v);
    });
    num.addEventListener("blur", (e) => {
      const raw = Number(e.target.value);
      const v = Number.isFinite(raw) ? clamp(raw) : Number(range.value);
      num.value = v;
    });
    wrap.append(range, num);
    return wrap;
  }

  if (spec.kind === "text") {
    const input = el("input", { type: "text", value: value ?? "" });
    input.addEventListener("input", (e) => onChange(spec.key, e.target.value));
    wrap.append(input, el("span", { class: "value" }, ""));
    return wrap;
  }

  if (spec.kind === "bgType") {
    const sel = el("select");
    for (const t of ["solid", "gradient"]) {
      const o = el("option", { value: t }, t);
      if (value === t) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener("change", (e) => onChange(spec.key, e.target.value, { rebuild: true }));
    wrap.append(sel, el("span", { class: "value" }, ""));
    return wrap;
  }

  if (spec.kind === "overlayType") {
    const sel = el("select");
    for (const t of overlayTypes) {
      const o = el("option", { value: t }, overlayLabel(t));
      if (value === t) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener("change", (e) => onChange(spec.key, e.target.value, { rebuild: true }));
    wrap.append(sel, el("span", { class: "value" }, ""));
    return wrap;
  }

  if (spec.kind === "gradientStop") {
    // value is a stop object {color, position}
    const stop = value;
    const color = el("input", { type: "color", value: normalizeColorForPicker(stop.color) });
    const pos = el("input", { type: "range", min: 0, max: 100, step: 1, value: stop.position });
    const posNum = el("input", { type: "number", class: "value value--input", min: 0, max: 100, step: 1, value: stop.position });
    const clamp = (v) => Math.min(100, Math.max(0, v));
    color.addEventListener("input", (e) => onChange(`${spec.key}.color`, e.target.value));
    pos.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      posNum.value = v;
      onChange(`${spec.key}.position`, v);
    });
    posNum.addEventListener("input", (e) => {
      const raw = Number(e.target.value);
      if (!Number.isFinite(raw)) return;
      const v = clamp(raw);
      pos.value = v;
      onChange(`${spec.key}.position`, v);
    });
    posNum.addEventListener("blur", (e) => {
      const raw = Number(e.target.value);
      const v = Number.isFinite(raw) ? clamp(raw) : Number(pos.value);
      posNum.value = v;
    });
    wrap.append(el("div", { class: "gradient-stops" }, [color, pos]), posNum);
    return wrap;
  }

  return null;
}

// <input type="color"> only accepts #rrggbb. Fall back to a safe default
// for named/rgba colors so the picker still renders something sane.
function normalizeColorForPicker(v) {
  if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (typeof v === "string" && /^#[0-9a-fA-F]{3}$/.test(v)) {
    return "#" + v.slice(1).split("").map((c) => c + c).join("");
  }
  return "#000000";
}

export function initControls({ getState, onEdit }) {
  const body = document.getElementById("panel-body");
  const tabs = document.getElementById("panel-tabs");
  let activePart = "background";

  function rebuild() {
    body.innerHTML = "";
    const state = getState();
    if (!state) return;
    const partData = state.parts[activePart];
    const schema = partSchemas[activePart];
    for (const spec of schema) {
      const node = renderField(spec, partData, (key, value, opts = {}) => {
        const s = getState();
        set(s.parts[activePart], key, value);
        onEdit(s);
        if (opts.rebuild) rebuild();
      });
      if (node) body.append(node);
    }
  }

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-part]");
    if (!btn) return;
    activePart = btn.dataset.part;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    rebuild();
  });

  rebuild();
  return { rebuild };
}
