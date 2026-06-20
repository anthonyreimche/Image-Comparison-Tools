// Image Comparison — before/after for the Develop module.
//
//   Variant A  "Show original"  — hold \ to preview the unedited photo, release
//              to return; a quick tap toggles before/after. Pure store work:
//              we render the original params via the develop store's preview
//              channel (keys.ts). No extra canvas, no core render changes.
//
//   Variant B  "Compare split"  — Shift+\ (or the Compare button) drops a
//              draggable vertical divider over the canvas: original on the left,
//              edit on the right (SliderOverlay.ts). The before frame is grabbed
//              off-screen via api.develop.captureFrame so it stays aligned with
//              zoom/pan and never disturbs the live view.
//
// Core only provides three generic hooks (a develop-canvas overlay slot, a
// develop-toolbar slot, and api.develop for overlay geometry + off-screen
// capture). All comparison logic lives here.

import type { SafelightAPI } from "./safelight";
import { initRuntime } from "./runtime";
import { initStore, compareStore } from "./store";
import { initPreviewKeys, PREVIEW_ACTION } from "./keys";
import { inDevelop } from "./develop";
import { CompareToolbar } from "./Toolbar";
import { SliderOverlay } from "./SliderOverlay";
import { CompareIndicator } from "./Indicator";

const ID = "com.safelight.image-comparison";
const SPLIT_ACTION = `${ID}.split`;

let cleanupKeys: (() => void) | null = null;

export function activate(api: SafelightAPI): void {
  initRuntime(api);
  initStore();

  // ── Variant A: show original (hold or tap) ──────────────────────────────────
  // The handler is intentionally inert — hold-to-preview needs a keyup, which
  // the keybinding dispatcher (keydown only) can't deliver, so the behaviour
  // lives in window listeners. Registering the action lists it in
  // Preferences ▸ Shortcuts and makes it rebindable; keys.ts reads the binding.
  api.registerKeybinding({
    id: PREVIEW_ACTION,
    label: "Show original (hold or toggle)",
    category: "Develop",
    defaultCombo: "\\",
    handler: () => {},
  });
  cleanupKeys = initPreviewKeys();

  // ── Variant B: before/after split ───────────────────────────────────────────
  // Combos match `e.key`, and Shift+\ produces "|" on common layouts (same
  // reason core pairs Shift+[ with a Shift+{ alias) — so the binding is Shift+|.
  api.registerKeybinding({
    id: SPLIT_ACTION,
    label: "Before / after split",
    category: "Develop",
    defaultCombo: "Shift+|",
    handler: () => {
      if (inDevelop()) compareStore().getState().toggleSplit();
    },
  });

  api.registerSlot({
    id: `${ID}.toolbar`,
    slot: "develop-toolbar",
    component: CompareToolbar,
  });
  api.registerSlot({
    id: `${ID}.overlay`,
    slot: "develop-canvas-overlay",
    component: SliderOverlay,
    order: 50,
  });
  api.registerSlot({
    id: `${ID}.indicator`,
    slot: "develop-canvas-overlay",
    component: CompareIndicator,
    order: 60,
  });
}

export function deactivate(): void {
  // Drop the window listeners and clear any lingering "before" preview; the host
  // sweeps the registry (slots + keybindings) on disable/uninstall.
  cleanupKeys?.();
  cleanupKeys = null;
}
