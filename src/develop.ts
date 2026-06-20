// "Before" = the photo's original look with its *current* framing. We reset the
// tonal/colour/effect edits to the seeded "Original" snapshot but keep the
// geometry (crop, transform, straighten, upright, lens) so the before image
// lines up pixel-for-pixel with the edited one — essential for the split view.

import { api } from "./runtime";
import type { DevelopParams } from "./safelight";

/** Build the before/original params, or null if no photo is loaded. */
export function beforeParams(): DevelopParams | null {
  const dev = api().stores.useDevelopStore.getState();
  const cur = dev.params;
  if (!cur || !dev.photoId) return null;
  // history[0] is the seeded "Original" (defaults at the as-shot white balance).
  const original = dev.history?.[0]?.params ?? cur;
  return {
    ...original,
    crop: cur.crop,
    transform: cur.transform,
    straighten: cur.straighten,
    uprightMode: cur.uprightMode,
    guidedLines: cur.guidedLines,
    lensCorrection: cur.lensCorrection,
  };
}

/** True when Develop is the active module with a photo open. */
export function inDevelop(): boolean {
  return (
    api().stores.useUIStore.getState().activeModule === "develop" &&
    !!api().stores.useDevelopStore.getState().photoId
  );
}
