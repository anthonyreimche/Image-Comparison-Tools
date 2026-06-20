// On-canvas badge for the hold/toggle "show original" preview (Variant A).
// "Before" stays while the original is shown; "After" appears on return and
// fades away over ~1s. Mounted into the click-through develop-canvas-overlay
// slot; the badge itself is non-interactive.

import { h, R } from "./runtime";
import { compareStore } from "./store";

const FADE_MS = 1000;

export function CompareIndicator() {
  const react = R();
  const store = compareStore();
  const indicator: "before" | "after" | null = store((s) => s.indicator);
  const setIndicator: (v: "before" | "after" | null) => void = store((s) => s.setIndicator);
  const [leaving, setLeaving] = react.useState(false);

  react.useEffect(() => {
    if (indicator !== "after") {
      setLeaving(false);
      return;
    }
    // Start fully visible, then fade out over FADE_MS and clear.
    setLeaving(false);
    const raf = requestAnimationFrame(() => setLeaving(true));
    const t = setTimeout(() => setIndicator(null), FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [indicator]);

  if (!indicator) return null;
  const isAfter = indicator === "after";

  return h(
    "div",
    {
      style: {
        position: "absolute",
        top: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "4px 12px",
        borderRadius: "4px",
        background: "rgba(0,0,0,0.6)",
        color: "#fff",
        font: "600 11px/1.4 system-ui, sans-serif",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        pointerEvents: "none",
        userSelect: "none",
        opacity: isAfter && leaving ? 0 : 1,
        transition: isAfter ? `opacity ${FADE_MS}ms ease-out` : "none",
      },
    },
    isAfter ? "After" : "Before",
  );
}
