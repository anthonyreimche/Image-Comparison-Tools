// Develop status-bar button that toggles the before/after split. Mounted into
// the "develop-toolbar" slot (only rendered in Develop with a photo open).
// Uses the app's shared UI kit (api.ui) so it matches the rest of the app.

import { h, api } from "./runtime";
import { compareStore } from "./store";
import { splitIcon } from "./icons";

export function CompareToolbar() {
  const ui = api().ui;
  if (!ui)
    return h(
      "div",
      { style: { padding: "10px", fontSize: "11px", color: "var(--color-text-muted)" } },
      "Update Safelight to use this panel.",
    );

  const store = compareStore();
  const splitOn: boolean = store((s) => s.splitOn);
  const toggleSplit: () => void = store((s) => s.toggleSplit);

  return h(
    ui.Button,
    {
      size: "sm",
      variant: "ghost",
      active: splitOn,
      onClick: toggleSplit,
      title: "Before / after split (Shift+\\)",
      "aria-label": "Toggle before/after split",
      "aria-pressed": splitOn,
    },
    splitIcon(13),
    h("span", null, "Compare"),
  );
}
