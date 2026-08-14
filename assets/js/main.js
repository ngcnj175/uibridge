// UIBridge — entry point. Wires the preset picker to the preview renderer.
// Step 1-3 scope: skeleton + data model + 8 builtin presets applied on select.

import { builtinPresets } from "./presets.js";
import { resolvePreset, applyState } from "./render.js";

const LS_LAST = "uibridge:lastSelectedPreset";

const previewRoot = document.getElementById("preview");
const select = document.getElementById("preset-select");

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
  applyState(previewRoot, resolvePreset(preset));
  try { localStorage.setItem(LS_LAST, preset.id); } catch {}
}

populateOptions();
select.addEventListener("change", (e) => selectPreset(e.target.value));

let initial = builtinPresets[0].id;
try {
  const saved = localStorage.getItem(LS_LAST);
  if (saved && builtinPresets.some((p) => p.id === saved)) initial = saved;
} catch {}
selectPreset(initial);
