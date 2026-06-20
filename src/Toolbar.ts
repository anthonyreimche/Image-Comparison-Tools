// Develop status-bar button that toggles the before/after split. Mounted into
// the "develop-toolbar" slot (only rendered in Develop with a photo open).
// Inline styles + CSS variables — runtime-loaded extensions aren't scanned by
// the app's Tailwind build, so utility classes wouldn't resolve.

import { h, R } from "./runtime";
import { compareStore } from "./store";
import { splitIcon } from "./icons";

export function CompareToolbar() {
  const react = R();
  const store = compareStore();
  const splitOn: boolean = store((s) => s.splitOn);
  const toggleSplit: () => void = store((s) => s.toggleSplit);
  const [hover, setHover] = react.useState(false);

  const active = splitOn || hover;

  return h(
    "button",
    {
      onClick: toggleSplit,
      title: "Before / after split (Shift+\\)",
      "aria-label": "Toggle before/after split",
      "aria-pressed": splitOn,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        height: "22px",
        padding: "0 8px",
        borderRadius: "4px",
        border: "1px solid",
        borderColor: splitOn ? "var(--color-accent)" : "var(--color-border-subtle)",
        background: splitOn ? "var(--color-accent)" : "transparent",
        color: splitOn
          ? "var(--color-on-accent, #fff)"
          : active
            ? "var(--color-text-primary)"
            : "var(--color-text-muted)",
        cursor: "pointer",
        fontSize: "11px",
        lineHeight: 1,
      },
    },
    splitIcon(13),
    h("span", null, "Compare"),
  );
}
