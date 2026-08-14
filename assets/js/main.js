// UIBridge — entry point. Wires the preset picker and control panel to the
// preview renderer, with localStorage persistence for the current state.

import { builtinPresets } from "./presets.js";
import { resolvePreset, applyState } from "./render.js";
import { initControls } from "./controls.js";
import { clone } from "./state.js";

const LS_LAST = "uibridge:lastSelectedPreset";
const LS_STATE = "uibridge:currentState";

// CSS vars live on <html> so both the preview pane and the control panel
// (which now sits underneath the preview) can share the same background.
const previewRoot = document.documentElement;
const select = document.getElementById("preset-select");

let currentState = null;

function saveState() {
  try { localStorage.setItem(LS_STATE, JSON.stringify(currentState)); } catch {}
}

function setState(state, { persist = true } = {}) {
  currentState = state;
  applyState(previewRoot, currentState);
  if (persist) saveState();
}

function populateOptions() {
  for (const p of builtinPresets) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  }
}

function selectPreset(id) {
  const preset = builtinPresets.find((p) => p.id === id) || builtinPresets[0];
  select.value = preset.id;
  setState(resolvePreset(preset));
  try { localStorage.setItem(LS_LAST, preset.id); } catch {}
  controls.rebuild();
}

populateOptions();
select.addEventListener("change", (e) => selectPreset(e.target.value));

const controls = initControls({
  getState: () => currentState,
  onEdit: (next) => setState(clone(next)),
});

// Initial load: prefer persisted currentState; else last selected preset; else first builtin.
let bootstrapped = false;
try {
  const raw = localStorage.getItem(LS_STATE);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.tokens && parsed.parts) {
      setState(parsed, { persist: false });
      const lastId = localStorage.getItem(LS_LAST);
      if (lastId && builtinPresets.some((p) => p.id === lastId)) select.value = lastId;
      bootstrapped = true;
    }
  }
} catch {}

if (!bootstrapped) {
  let initial = builtinPresets[0].id;
  try {
    const saved = localStorage.getItem(LS_LAST);
    if (saved && builtinPresets.some((p) => p.id === saved)) initial = saved;
  } catch {}
  selectPreset(initial);
}
