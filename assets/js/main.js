// UIBridge — entry point. Wires the preset picker, control panel, and
// user-preset management (save / rename / delete) to the preview renderer.

import { builtinPresets } from "./presets.js";
import { resolvePreset, applyState } from "./render.js";
import { initControls } from "./controls.js";
import { clone } from "./state.js";
import { loadUserPresets, addUserPreset, renameUserPreset, deleteUserPreset } from "./userPresets.js";
import { initOutput } from "./output.js";
import { initPng } from "./png.js";

const LS_LAST = "uibridge:lastSelectedPreset";
const LS_STATE = "uibridge:currentState";

// CSS vars live on <html> so both panes share the same background.
const previewRoot = document.documentElement;
const select = document.getElementById("preset-select");
const btnSave = document.getElementById("preset-save");
const btnRename = document.getElementById("preset-rename");
const btnDelete = document.getElementById("preset-delete");

let currentState = null;
let userPresets = loadUserPresets();
let currentPresetId = null; // tracks which preset the dropdown reflects

function saveState() {
  try { localStorage.setItem(LS_STATE, JSON.stringify(currentState)); } catch {}
}

function setState(state, { persist = true } = {}) {
  currentState = state;
  applyState(previewRoot, currentState);
  if (persist) saveState();
}

function isUserPresetId(id) { return userPresets.some((p) => p.id === id); }

function updateActionButtons() {
  const isUser = isUserPresetId(currentPresetId);
  btnRename.hidden = !isUser;
  btnDelete.hidden = !isUser;
}

function populateOptions() {
  select.innerHTML = "";

  const groupB = document.createElement("optgroup");
  groupB.label = "ビルトイン";
  for (const p of builtinPresets) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    groupB.appendChild(opt);
  }
  select.appendChild(groupB);

  if (userPresets.length) {
    const groupU = document.createElement("optgroup");
    groupU.label = "ユーザー";
    for (const p of userPresets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      groupU.appendChild(opt);
    }
    select.appendChild(groupU);
  }
}

function selectPreset(id) {
  const user = userPresets.find((p) => p.id === id);
  if (user) {
    currentPresetId = user.id;
    select.value = user.id;
    setState(clone(user.state));
  } else {
    const preset = builtinPresets.find((p) => p.id === id) || builtinPresets[0];
    currentPresetId = preset.id;
    select.value = preset.id;
    setState(resolvePreset(preset));
  }
  try { localStorage.setItem(LS_LAST, currentPresetId); } catch {}
  updateActionButtons();
  controls.rebuild();
}

populateOptions();
select.addEventListener("change", (e) => selectPreset(e.target.value));

btnSave.addEventListener("click", () => {
  const name = (prompt("プリセット名を入力", "マイプリセット") || "").trim();
  if (!name) return;
  const preset = addUserPreset(name, currentState);
  userPresets = loadUserPresets();
  populateOptions();
  currentPresetId = preset.id;
  select.value = preset.id;
  try { localStorage.setItem(LS_LAST, currentPresetId); } catch {}
  updateActionButtons();
});

btnRename.addEventListener("click", () => {
  const current = userPresets.find((p) => p.id === currentPresetId);
  if (!current) return;
  const name = (prompt("新しい名前を入力", current.name) || "").trim();
  if (!name || name === current.name) return;
  renameUserPreset(current.id, name);
  userPresets = loadUserPresets();
  populateOptions();
  select.value = current.id;
});

btnDelete.addEventListener("click", () => {
  const current = userPresets.find((p) => p.id === currentPresetId);
  if (!current) return;
  if (!confirm(`「${current.name}」を削除しますか？`)) return;
  deleteUserPreset(current.id);
  userPresets = loadUserPresets();
  populateOptions();
  // Fall back to first builtin after deletion.
  selectPreset(builtinPresets[0].id);
});

const controls = initControls({
  getState: () => currentState,
  onEdit: (next) => setState(clone(next)),
});

initOutput({ getState: () => currentState });
initPng();

// Initial load: persisted currentState wins; else last selected preset (built-in or user); else first builtin.
let bootstrapped = false;
try {
  const raw = localStorage.getItem(LS_STATE);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.tokens && parsed.parts) {
      setState(parsed, { persist: false });
      const lastId = localStorage.getItem(LS_LAST);
      if (lastId && (builtinPresets.some((p) => p.id === lastId) || isUserPresetId(lastId))) {
        currentPresetId = lastId;
        select.value = lastId;
      } else {
        currentPresetId = builtinPresets[0].id;
        select.value = currentPresetId;
      }
      updateActionButtons();
      bootstrapped = true;
    }
  }
} catch {}

if (!bootstrapped) {
  let initial = builtinPresets[0].id;
  try {
    const saved = localStorage.getItem(LS_LAST);
    if (saved && (builtinPresets.some((p) => p.id === saved) || isUserPresetId(saved))) initial = saved;
  } catch {}
  selectPreset(initial);
}
