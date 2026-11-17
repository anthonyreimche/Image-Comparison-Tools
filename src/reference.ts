// An edit another extension hands over to compare with, through the shared
// "compare.reference" variable: Snapshots sets it to a snapshot of the open
// photo, and the Before is then that edit in place of the photo as opened. Kept
// pure so test/reference.test.ts can import it straight into Node.

import type { DevelopParams } from "./safelight";

export const COMPARE_REFERENCE = "compare.reference";

export const COMPARE_REFERENCE_DESCRIPTION =
  "The edit Image Comparison shows as Before for the open photo, in place of the photo as opened, or null. " +
  "{ photoId, source, id, label, params, paramBag }: label names the Before side; the extension that set it (source) clears it.";

export interface CompareReference {
  /** The photo it belongs to; ignored on any other. */
  photoId: string;
  /** The extension that set it. */
  source: string;
  /** Which of the source's edits it is. */
  id: string;
  /** Shown on the Before side. */
  label: string;
  params: DevelopParams;
  paramBag: Record<string, unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `value` as a reference for the open photo, or null when it is none, belongs
 *  to another photo, or lacks a field a Before needs. Another extension writes
 *  it, so it is checked rather than trusted. */
export function referenceFor(value: unknown, photoId: string | null): CompareReference | null {
  if (!isObject(value) || photoId === null || value.photoId !== photoId) return null;
  const { source, id, label, params, paramBag } = value;
  if (typeof source !== "string" || typeof id !== "string" || typeof label !== "string") return null;
  if (!isObject(params) || !isObject(paramBag)) return null;
  // The params are the source's copy of a stored edit, handed to core as they are.
  return { photoId, source, id, label, params: params as DevelopParams, paramBag };
}

/** The extension values a Before of the reference draws. A capture's or
 *  preview's bag is merged over the live one, so each value only the live edit
 *  holds is put back at the default a stage reads when an edit holds none. */
export function referenceBag(
  bag: Record<string, unknown>,
  live: Record<string, unknown>,
  describe: (key: string) => { default: unknown } | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...bag };
  for (const key of Object.keys(live)) {
    if (key in out) continue;
    const fallback = describe(key)?.default;
    if (fallback !== undefined) out[key] = fallback;
  }
  return out;
}
