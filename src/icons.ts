// Small inline SVGs built with the app's React (no JSX, no asset imports).

import { h } from "./runtime";

// A framed rectangle split down the middle — the before/after split glyph.
export function splitIcon(size = 14): unknown {
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
    },
    h("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
    h("line", { x1: 12, y1: 4, x2: 12, y2: 20 }),
  );
}
