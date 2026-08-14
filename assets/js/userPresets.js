// UIBridge — user preset persistence (localStorage).
// Presets take the same shape as builtins but carry a resolved state snapshot
// so they can be restored verbatim regardless of future default changes.

import { clone } from "./state.js";

const LS_KEY = "uibridge:userPresets";

function nowIso() { return new Date().toISOString(); }
function uid() {
  return "user_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

export function loadUserPresets() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

// Store a snapshot of the fully-resolved state under `state`, so restoring
// a user preset never depends on the runtime defaults or a source builtin.
export function addUserPreset(name, resolvedState) {
  const list = loadUserPresets();
  const preset = {
    id: uid(),
    name,
    type: "user",
    createdAt: nowIso(),
    state: clone(resolvedState),
  };
  list.push(preset);
  save(list);
  return preset;
}

export function renameUserPreset(id, newName) {
  const list = loadUserPresets();
  const p = list.find((x) => x.id === id);
  if (!p) return false;
  p.name = newName;
  save(list);
  return true;
}

export function deleteUserPreset(id) {
  const list = loadUserPresets().filter((p) => p.id !== id);
  save(list);
}
