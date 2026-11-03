// Variant B — vertical before/after split. Mounted into the click-through
// "develop-canvas-overlay" slot. Left of the divider shows the unedited photo
// (an off-screen capture, aligned to the live view via api.develop); right is
// the live edited canvas showing through. Drag the divider to reveal more of
// either. Editing stays fully live — only view geometry and processing-version
// changes re-grab the before.
//
// Inline styles + CSS variables (no Tailwind: runtime-loaded files aren't
// scanned by the app's build).

import { h, R, api } from "./runtime";
import { compareStore } from "./store";
import { beforeParams } from "./develop";

const CAPTURE_DEBOUNCE_MS = 60;

function label(text: string, side: "left" | "right"): unknown {
  return h(
    "div",
    {
      style: {
        position: "absolute",
        top: "10px",
        [side]: "10px",
        padding: "2px 7px",
        borderRadius: "3px",
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        font: "600 10px/1.4 system-ui, sans-serif",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        pointerEvents: "none",
        userSelect: "none",
      },
    },
    text,
  );
}

export function SliderOverlay() {
  const react = R();
  const store = compareStore();
  const splitOn: boolean = store((s) => s.splitOn);
  const split: number = store((s) => s.split);
  const setSplit: (v: number) => void = store((s) => s.setSplit);

  const devStore = api().stores.useDevelopStore;
  const cropping: boolean = devStore((s) => s.cropping);
  const activeTool: string = devStore((s) => s.activeTool);
  const photoId: string | null = devStore((s) => s.photoId);
  // The Before renders at the photo's current processing version, so a change
  // (Update processing, Reset all edits) has to re-grab it.
  const processVersion: number | undefined = devStore((s) => s.params?.processVersion);

  const { rect, nonce } = api().develop.useDevelopOverlay();

  const canvasRef = react.useRef(null);
  const wrapRef = react.useRef(null);
  const draggingRef = react.useRef(false);
  const [ready, setReady] = react.useState(false);

  const visible = splitOn && !cropping && activeTool === "none" && !!rect && !!photoId;

  // Grab the "before" frame for the current view; re-grab on a view, photo or
  // processing-version change. Debounced so a continuous pan/zoom doesn't fire
  // a capture per frame.
  react.useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const bp = beforeParams();
      if (!bp) return;
      // As shown: drawn over the canvas, it must match the canvas under a
      // display profile. Older cores ignore the option and match anyway.
      api()
        .develop.captureFrame(bp, { asShown: true })
        .then((bitmap: ImageBitmap) => {
          const cv = canvasRef.current as HTMLCanvasElement | null;
          if (cancelled || !cv) {
            bitmap.close();
            return;
          }
          cv.width = bitmap.width;
          cv.height = bitmap.height;
          const ctx = cv.getContext("2d");
          if (ctx) ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          setReady(true);
        });
    }, CAPTURE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, nonce, photoId, processVersion]);

  if (!visible || !rect) return null;

  const pct = `${Math.max(0, Math.min(1, split)) * 100}%`;

  const onDown = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const w = wrapRef.current as HTMLElement | null;
    if (!w) return;
    const r = w.getBoundingClientRect();
    if (r.width > 0) setSplit((e.clientX - r.left) / r.width);
  };
  const onUp = (e: PointerEvent & { currentTarget: HTMLElement }) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };

  // Before image, clipped to the left of the divider.
  const beforeLayer = h(
    "div",
    {
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        height: "100%",
        width: pct,
        overflow: "hidden",
        pointerEvents: "none",
      },
    },
    h("canvas", {
      ref: canvasRef,
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        opacity: ready ? 1 : 0,
        transition: "opacity 120ms linear",
      },
    }),
    label("Before", "left"),
  );

  // The divider: a thin line with a centred grab handle, full height.
  const divider = h(
    "div",
    {
      onPointerDown: onDown,
      onPointerMove: onMove,
      onPointerUp: onUp,
      style: {
        position: "absolute",
        top: 0,
        left: pct,
        transform: "translateX(-50%)",
        height: "100%",
        width: "22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Shared resize-divider token (so Custom Cursors themes restyle it) with a
        // fallback for older builds that predate api.cursors.resolve.
        cursor: api().cursors?.resolve("crop-resize-ew") ?? "ew-resize",
        pointerEvents: "auto",
        touchAction: "none",
      },
    },
    // visible line
    h("div", {
      style: {
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "2px",
        height: "100%",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
      },
    }),
    // handle knob
    h(
      "div",
      {
        style: {
          position: "relative",
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#222",
          font: "600 13px/1 system-ui, sans-serif",
        },
      },
      "⟺",
    ),
  );

  return h(
    "div",
    {
      ref: wrapRef,
      style: {
        position: "absolute",
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        pointerEvents: "none",
      },
    },
    beforeLayer,
    label("After", "right"),
    divider,
  );
}
