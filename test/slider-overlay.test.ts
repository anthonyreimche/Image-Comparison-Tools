import test, { mock } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

// SliderOverlay is a React component over the app's api, and the sources import
// each other without extensions, which Node can't resolve. So bundle the
// extension in memory the way scripts/build.mjs does, activate it against fake
// stores and a minimal hooks runtime, and render the overlay by hand.

const EXT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OVERLAY_ID = "com.safelight.image-comparison.overlay";
const SPLIT_ID = "com.safelight.image-comparison.split";
const CAPTURE_DEBOUNCE_MS = 60;

// activate() hangs its key listeners on the window; nothing here fires them.
Object.assign(globalThis, {
  window: {
    location: { search: "" },
    addEventListener() {},
    removeEventListener() {},
  },
});

type Update<T> = Partial<T> | ((s: T) => Partial<T>);
type Init<T> = (set: (u: Update<T>) => void, get: () => T) => T;

// A zustand-shaped store: callable as a selector hook, with getState, setState
// (value or updater) and subscribe.
function createStore<T extends object>(init: Init<T>) {
  let state: T;
  const listeners = new Set<(s: T, prev: T) => void>();
  const set = (update: Update<T>) => {
    const prev = state;
    state = { ...state, ...(typeof update === "function" ? update(state) : update) };
    listeners.forEach((l) => l(state, prev));
  };
  state = init(set, () => state);
  const store = <U>(selector: (s: T) => U): U => selector(state);
  return Object.assign(store, {
    getState: () => state,
    setState: set,
    subscribe: (l: (s: T, prev: T) => void) => (listeners.add(l), () => listeners.delete(l)),
  });
}

// Just enough of React for one component: hook slots persist between renders,
// and an effect runs after a render only when its deps changed.
function createHooks() {
  const slots: unknown[] = [];
  const pending: (() => void)[] = [];
  let cursor = 0;
  const react = {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
      type,
      props,
      children,
    }),
    useRef: <T>(initial: T) => {
      const i = cursor++;
      return (slots[i] ??= { current: initial }) as { current: T };
    },
    useState: <T>(initial: T) => {
      const i = cursor++;
      const cell = (slots[i] ??= { value: initial }) as { value: T };
      return [cell.value, (v: T) => void (cell.value = v)] as const;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const i = cursor++;
      const prev = slots[i] as { deps: unknown[]; cleanup: void | (() => void) } | undefined;
      if (prev && deps.every((d, k) => Object.is(d, prev.deps[k]))) return;
      pending.push(() => {
        if (typeof prev?.cleanup === "function") prev.cleanup();
        slots[i] = { deps, cleanup: effect() };
      });
    },
  };
  const render = (component: () => unknown) => {
    cursor = 0;
    component();
    pending.splice(0).forEach((run) => run());
  };
  return { react, render };
}

async function loadExtension() {
  const bundle = await rolldown({ input: path.join(EXT_DIR, "src", "index.ts") });
  const { output } = await bundle.generate({ format: "esm" });
  await bundle.close();
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`);
}

const extension = await loadExtension();

// Develop with a version 1 photo open and the split view switched on, as the
// overlay sees it.
function openSplit() {
  const hooks = createHooks();
  const captures: { processVersion?: number }[] = [];
  const captureOptions: ({ asShown?: boolean } | undefined)[] = [];
  const components = new Map<string, () => unknown>();
  const shortcuts = new Map<string, () => void>();
  const develop = createStore(() => ({
    photoId: "P",
    params: { exposure: 1, processVersion: 1 },
    history: [{ label: "Original", params: { exposure: 0, processVersion: 1 } }],
    cropping: false,
    activeTool: "none",
    setPreviewParams() {},
  }));
  extension.activate({
    react: hooks.react,
    stores: {
      create: createStore,
      useDevelopStore: develop,
      useUIStore: createStore(() => ({ activeModule: "develop" })),
      useKeybindings: createStore(() => ({ overrides: {} })),
    },
    develop: {
      useDevelopOverlay: () => ({ rect: { x: 0, y: 0, w: 100, h: 100 }, nonce: 0 }),
      captureFrame: (params: { processVersion?: number }, options?: { asShown?: boolean }) => {
        captures.push(params);
        captureOptions.push(options);
        return Promise.resolve({ width: 1, height: 1, close() {} });
      },
    },
    registerSlot: (c: { id: string; component: () => unknown }) =>
      void components.set(c.id, c.component),
    registerKeybinding: (c: { id: string; handler(): void }) => void shortcuts.set(c.id, c.handler),
  });
  const overlay = components.get(OVERLAY_ID);
  const toggleSplit = shortcuts.get(SPLIT_ID);
  assert.ok(overlay && toggleSplit, "the overlay and its shortcut are registered");
  toggleSplit();
  mock.timers.enable({ apis: ["setTimeout"] });
  return {
    develop,
    captures,
    captureOptions,
    /** Render the overlay and let its debounced capture fire. */
    show() {
      hooks.render(overlay);
      mock.timers.tick(CAPTURE_DEBOUNCE_MS);
    },
    close() {
      mock.timers.reset();
      extension.deactivate();
    },
  };
}

test("re-grabs the Before when the photo's processing version changes", (t) => {
  const split = openSplit();
  t.after(() => split.close());

  split.show();
  assert.equal(split.captures.length, 1);
  assert.equal(split.captures[0].processVersion, 1);

  // Update processing (or Reset all edits on an older photo): same photo, same view.
  split.develop.setState({ params: { exposure: 1, processVersion: 2 } });
  split.show();
  assert.equal(split.captures.length, 2);
  assert.equal(split.captures[1].processVersion, 2);
});

// The Before is drawn over the live canvas, so it must be converted the way the
// canvas is (Safelight's Linux display profile); a plain capture is sRGB.
test("grabs the Before as the screen shows it", (t) => {
  const split = openSplit();
  t.after(() => split.close());

  split.show();
  assert.deepEqual(split.captureOptions, [{ asShown: true }]);
});

test("keeps the Before while an edit leaves the version alone", (t) => {
  const split = openSplit();
  t.after(() => split.close());

  split.show();
  split.develop.setState({ params: { exposure: 2, processVersion: 1 } });
  split.show();
  assert.equal(split.captures.length, 1);
});
