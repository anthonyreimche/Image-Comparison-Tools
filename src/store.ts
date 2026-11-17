// Extension-local UI state for the comparison modes. Kept out of core: core
// only renders our slot components, which read this store. The split position is
// remembered for the session but not persisted (per the feature spec).

import { api } from "./runtime";
import type { CompareReference } from "./reference";
import type { StoreApi } from "./safelight";

export interface CompareState {
  /** Vertical-split before/after overlay active. */
  splitOn: boolean;
  /** Divider position, 0 (all before) … 1 (all after). */
  split: number;
  /** On-canvas badge for the hold/toggle preview: "before" stays while the
   *  original is shown, "after" appears briefly (then fades) on return, null
   *  hides it. */
  indicator: "before" | "after" | null;
  /** The edit another extension handed over to show as Before for the open
   *  photo (see reference.ts), or null for the photo as opened. */
  reference: CompareReference | null;
  /** The split was opened by a reference arriving, so it closes when the
   *  reference is taken back; opening or closing it by hand clears this. */
  splitByReference: boolean;
  setSplitOn(v: boolean): void;
  toggleSplit(): void;
  setSplit(v: number): void;
  setIndicator(v: "before" | "after" | null): void;
  /** Take on a new reference: a new one opens the split, and taking back the
   *  one that opened it closes it again. */
  setReference(v: CompareReference | null): void;
}

let _store: StoreApi<CompareState> | null = null;

export function initStore(): StoreApi<CompareState> {
  _store = api().stores.create<CompareState>((set) => ({
    splitOn: false,
    split: 0.5,
    indicator: null,
    reference: null,
    splitByReference: false,
    setSplitOn: (splitOn) => set({ splitOn, splitByReference: false }),
    toggleSplit: () => set((s) => ({ splitOn: !s.splitOn, splitByReference: false })),
    setSplit: (split) => set({ split: Math.max(0, Math.min(1, split)) }),
    setIndicator: (indicator) => set({ indicator }),
    setReference: (reference) =>
      set((s) => {
        if (!reference) return s.splitByReference ? { reference, splitOn: false, splitByReference: false } : { reference };
        const fresh = !s.reference || s.reference.source !== reference.source || s.reference.id !== reference.id;
        return fresh && !s.splitOn ? { reference, splitOn: true, splitByReference: true } : { reference };
      }),
  }));
  return _store;
}

export function compareStore(): StoreApi<CompareState> {
  if (!_store) throw new Error("[image-comparison] store used before activate()");
  return _store;
}
