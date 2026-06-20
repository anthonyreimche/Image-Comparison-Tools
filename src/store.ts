// Extension-local UI state for the comparison modes. Kept out of core: core
// only renders our slot components, which read this store. The split position is
// remembered for the session but not persisted (per the feature spec).

import { api } from "./runtime";
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
  setSplitOn(v: boolean): void;
  toggleSplit(): void;
  setSplit(v: number): void;
  setIndicator(v: "before" | "after" | null): void;
}

let _store: StoreApi<CompareState> | null = null;

export function initStore(): StoreApi<CompareState> {
  _store = api().stores.create<CompareState>((set) => ({
    splitOn: false,
    split: 0.5,
    indicator: null,
    setSplitOn: (splitOn) => set({ splitOn }),
    toggleSplit: () => set((s) => ({ splitOn: !s.splitOn })),
    setSplit: (split) => set({ split: Math.max(0, Math.min(1, split)) }),
    setIndicator: (indicator) => set({ indicator }),
  }));
  return _store;
}

export function compareStore(): StoreApi<CompareState> {
  if (!_store) throw new Error("[image-comparison] store used before activate()");
  return _store;
}
