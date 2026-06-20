// Variant A — "show original". Press and hold the key to preview the unedited
// photo; release to return to the edit. A quick tap toggles before/after (it
// stays on the original until tapped again), matching Lightroom's `\`.
//
// We drive this from our own window listeners rather than the registered
// keybinding's handler, because hold-to-preview needs keyup — which the
// keybinding dispatcher (keydown only) can't give us. The registered action
// (index.ts) exists purely so the shortcut is listed and rebindable; its
// handler is inert. We read its current combo here so a rebind still works.

import { api } from "./runtime";
import { beforeParams, inDevelop } from "./develop";
import { compareStore } from "./store";

export const PREVIEW_ACTION = "com.safelight.image-comparison.preview";
const DEFAULT_COMBO = "\\";
const TAP_MS = 220;

// Normalized combo for an event, in the same format as core keybindings
// ("Ctrl+Shift+Alt+<Key>", single chars upper-cased). null for bare modifiers.
function comboFromEvent(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === "Control" || k === "Shift" || k === "Alt" || k === "Meta") return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join("+");
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  if (t instanceof HTMLInputElement) {
    return !["range", "checkbox", "radio", "button", "color", "file", "submit", "reset"].includes(
      t.type,
    );
  }
  return t.isContentEditable;
}

function previewCombo(): string {
  return api().stores.useKeybindings.getState().overrides[PREVIEW_ACTION] ?? DEFAULT_COMBO;
}

// previewParams is the render override; the indicator is the on-canvas badge.
// We set the badge from the key handlers (not these helpers) so teardown can
// clear the preview without flashing a label.
function showBefore(): void {
  const bp = beforeParams();
  if (bp) api().stores.useDevelopStore.getState().setPreviewParams(bp);
}

function showAfter(): void {
  api().stores.useDevelopStore.getState().setPreviewParams(null);
}

function badge(v: "before" | "after" | null): void {
  compareStore().getState().setIndicator(v);
}

/** Install the hold/toggle listeners. Returns a cleanup function. */
export function initPreviewKeys(): () => void {
  let pressing = false;
  let downAt = 0;
  let sticky = false; // latched to "before" by a tap

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || pressing) return;
    if (isEditableTarget(e.target) || !inDevelop()) return;
    if (comboFromEvent(e) !== previewCombo()) return;
    pressing = true;
    downAt = e.timeStamp;
    showBefore(); // immediate feedback for both hold and tap
    badge("before");
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!pressing) return;
    pressing = false;
    const held = e.timeStamp - downAt;
    if (held < TAP_MS) {
      // Tap: flip the sticky toggle.
      sticky = !sticky;
      if (sticky) {
        showBefore();
        badge("before");
      } else {
        showAfter();
        badge("after");
      }
    } else {
      // Hold: releasing always returns to the edit.
      sticky = false;
      showAfter();
      badge("after");
    }
  };

  // A new photo clears previewParams in core; drop our latch so state matches.
  let lastPhoto = api().stores.useDevelopStore.getState().photoId;
  const unsubStore = api().stores.useDevelopStore.subscribe((s) => {
    if (s.photoId !== lastPhoto) {
      lastPhoto = s.photoId;
      sticky = false;
      pressing = false;
      badge(null);
    }
  });

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    unsubStore();
    showAfter();
    badge(null);
  };
}
