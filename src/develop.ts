// "Before" = the photo's original look with its *current* framing. We reset the
// tonal/colour/effect edits to the seeded "Original" snapshot but keep the
// geometry (crop, transform, straighten, upright, lens) and the processing
// version, so the before image lines up pixel-for-pixel with the edited one and
// is rendered the same way — essential for the split view.

import { api } from "./runtime";
import { buildBeforeParams } from "./before";
import type { DevelopParams } from "./safelight";

/** Build the before/original params, or null if no photo is loaded. */
export function beforeParams(): DevelopParams | null {
  const dev = api().stores.useDevelopStore.getState();
  const cur = dev.params;
  if (!cur || !dev.photoId) return null;
  // history[0] is the seeded "Original" (defaults at the as-shot white balance).
  const original = dev.history?.[0]?.params ?? cur;
  return buildBeforeParams(cur, original);
}

/** True when Develop is the active module with a photo open. Develop counts as
 *  active either as the main window's module OR as its own popped-out window —
 *  a detached window carries ?detached=develop in its URL and keeps its own
 *  activeModule, so we check the param too (exactly as core's key handler does).
 *  Without this the hold/toggle and split shortcuts go dead in a detached
 *  Develop window even though the Compare button still works. */
export function inDevelop(): boolean {
  const detached = new URLSearchParams(window.location.search).get("detached");
  const active =
    api().stores.useUIStore.getState().activeModule === "develop" ||
    detached === "develop";
  return active && !!api().stores.useDevelopStore.getState().photoId;
}
