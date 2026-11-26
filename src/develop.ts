// "Before" = the photo's original look with its *current* framing. We reset the
// tonal/colour/effect edits to the seeded "Original" snapshot but keep the
// geometry (crop, transform, straighten, upright, lens) and the processing
// version, so the before image lines up pixel-for-pixel with the edited one and
// is rendered the same way — essential for the split view.

import { api } from "./runtime";
import { buildBeforeParams } from "./before";
import { referenceBag } from "./reference";
import { compareStore } from "./store";
import type { DevelopParams } from "./safelight";

export interface Before {
  params: DevelopParams;
  /** Extension values to draw over the live ones; none for the photo as opened. */
  paramBag?: Record<string, unknown>;
  /** The Before side's name. */
  label: string;
}

/** The Before: a reference another extension handed over for this photo (a
 *  snapshot), else the photo as opened. Either way at the current framing and
 *  processing version. Null with no photo loaded. */
export function before(): Before | null {
  const dev = api().stores.useDevelopStore.getState();
  const cur = dev.params;
  if (!cur || !dev.photoId) return null;
  const reference = compareStore().getState().reference;
  if (reference) {
    const describe = (key: string) => api().params?.get(key);
    return {
      params: buildBeforeParams(cur, reference.params),
      paramBag: referenceBag(reference.paramBag, dev.paramBag ?? {}, describe),
      label: reference.label,
    };
  }
  // history[0] is the seeded "Original" (defaults at the as-shot white balance).
  const original = dev.history?.[0]?.params ?? cur;
  return { params: buildBeforeParams(cur, original), label: "Before" };
}

/** True when Develop is the module this window shows, with a photo open. */
export function inDevelop(): boolean {
  return api().navigation.current() === "develop" && !!api().stores.useDevelopStore.getState().photoId;
}
