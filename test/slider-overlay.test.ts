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

// activate() hangs its key listeners on the window; the tests fire them by hand.
type KeyListener = (e: { key: string; timeStamp: number; repeat?: boolean; target?: unknown }) => void;
const windowListeners = new Map<string, Set<KeyListener>>();
Object.assign(globalThis, {
  HTMLElement: class {},
  window: {
    location: { search: "" },
    addEventListener(type: string, l: KeyListener) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type)!.add(l);
    },
    removeEventListener(type: string, l: KeyListener) {
      windowListeners.get(type)?.delete(l);
    },
  },
});
const fireKey = (type: "keydown" | "keyup", key: string, timeStamp: number) =>
  windowListeners.get(type)?.forEach((l) => l({ key, timeStamp }));

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
    const out = component();
    pending.splice(0).forEach((run) => run());
    return out;
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

// Develop with a version 1 photo open and, unless told, the split view switched
// on, as the overlay sees it. With `variables`, the app shares variables between
// extensions (Safelight 3.0.1 and later); `write` sets one as another extension would.
function openSplit({ split = true, variables = false } = {}) {
  const hooks = createHooks();
  const captures: { [key: string]: unknown; processVersion?: number }[] = [];
  const captureOptions: ({ asShown?: boolean; paramBag?: Record<string, unknown> } | undefined)[] = [];
  const previews: unknown[][] = [];
  const components = new Map<string, () => unknown>();
  const shortcuts = new Map<string, () => void>();
  const develop = createStore(() => ({
    photoId: "P",
    params: { exposure: 1, crop: "current crop", processVersion: 1 } as Record<string, unknown>,
    paramBag: { "glow.amount": 0.9, "grain.size": 3 } as Record<string, unknown>,
    history: [{ label: "Original", params: { exposure: 0, processVersion: 1 } }],
    setPreviewParams: (...args: unknown[]) => void previews.push(args),
  }));
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<(s: { value: unknown }) => void>>();
  const shared = {
    register(name: string, init: { initial: unknown }) {
      if (!values.has(name)) values.set(name, init.initial);
      return { name, value: values.get(name) };
    },
    subscribe(name: string, l: (s: { value: unknown }) => void) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(l);
      if (values.has(name)) l({ value: values.get(name) });
      return () => listeners.get(name)!.delete(l);
    },
  };
  const defaults: Record<string, number> = { "glow.amount": 0, "grain.size": 1.5 };
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
    ...(variables
      ? {
          variables: shared,
          params: { get: (key: string) => (key in defaults ? { default: defaults[key] } : undefined) },
        }
      : {}),
    registerSlot: (c: { id: string; component: () => unknown }) =>
      void components.set(c.id, c.component),
    registerKeybinding: (c: { id: string; handler(): void }) => void shortcuts.set(c.id, c.handler),
  });
  const overlay = components.get(OVERLAY_ID);
  const toggleSplit = shortcuts.get(SPLIT_ID);
  assert.ok(overlay && toggleSplit, "the overlay and its shortcut are registered");
  if (split) toggleSplit();
  mock.timers.enable({ apis: ["setTimeout"] });
  return {
    develop,
    captures,
    captureOptions,
    previews,
    toggleSplit,
    /** Render the overlay, let its debounced capture fire, and return what it drew. */
    show() {
      const out = hooks.render(overlay);
      mock.timers.tick(CAPTURE_DEBOUNCE_MS);
      return out;
    },
    /** Write a shared variable, as another extension's set() would. */
    write(name: string, value: unknown) {
      values.set(name, value);
      listeners.get(name)?.forEach((l) => l({ value }));
    },
    close() {
      mock.timers.reset();
      extension.deactivate();
    },
  };
}

/** The parts of a Before's params these tests set. */
function look(params: unknown) {
  const { exposure, crop, processVersion } = params as Record<string, unknown>;
  return { exposure, crop, processVersion };
}

/** Every text in a rendered element tree. */
function texts(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (!node || typeof node !== "object") return [];
  return ((node as { children?: unknown[] }).children ?? []).flatMap(texts);
}

// Core has kept no tool or crop flags on the develop store since the built-in
// tools moved out of core; the split must not wait on them.
test("shows the split on core's develop store, which has no tool or crop flags", (t) => {
  const split = openSplit();
  t.after(() => split.close());

  split.show();
  assert.equal(split.captures.length, 1);
});

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

// Snapshots (or any extension) can hand over an edit of the open photo through
// the "compare.reference" variable; the Before is then that edit, named after
// it, in place of the photo as opened.
const WARM = {
  photoId: "P",
  source: "snapshots",
  id: "s1",
  label: "Warm",
  params: { exposure: 3, crop: "snapshot crop", processVersion: 2 },
  paramBag: { "glow.amount": 0.4 },
};

test("shows a reference for the open photo as the Before, at the edit's framing and version, under its name", (t) => {
  const split = openSplit({ variables: true });
  t.after(() => split.close());

  split.write("compare.reference", WARM);
  const drawn = split.show();
  assert.deepEqual(look(split.captures.at(-1)), { exposure: 3, crop: "current crop", processVersion: 1 });
  assert.deepEqual(split.captureOptions.at(-1), {
    asShown: true,
    paramBag: { "glow.amount": 0.4, "grain.size": 1.5 },
  });
  assert.deepEqual(texts(drawn).sort(), ["After", "Warm", "⟺"]);
});

test("opens the split when a reference arrives, and closes it when the reference is taken back", (t) => {
  const split = openSplit({ split: false, variables: true });
  t.after(() => split.close());

  assert.equal(split.show(), null);
  split.write("compare.reference", WARM);
  assert.notEqual(split.show(), null);
  split.write("compare.reference", null);
  assert.equal(split.show(), null);
});

test("leaves a split opened by hand open when the reference is taken back, and shows the original again", (t) => {
  const split = openSplit({ variables: true });
  t.after(() => split.close());

  split.write("compare.reference", WARM);
  split.show();
  split.write("compare.reference", null);
  const drawn = split.show();
  assert.deepEqual(texts(drawn).sort(), ["After", "Before", "⟺"]);
  assert.deepEqual(look(split.captures.at(-1)), { exposure: 0, crop: "current crop", processVersion: 1 });
  assert.deepEqual(split.captureOptions.at(-1), { asShown: true });
});

test("ignores a reference for another photo", (t) => {
  const split = openSplit({ split: false, variables: true });
  t.after(() => split.close());

  split.write("compare.reference", { ...WARM, photoId: "Q" });
  assert.equal(split.show(), null);
  split.toggleSplit();
  assert.deepEqual(texts(split.show()).sort(), ["After", "Before", "⟺"]);
});

test("re-grabs the Before when the reference changes", (t) => {
  const split = openSplit({ variables: true });
  t.after(() => split.close());

  split.write("compare.reference", WARM);
  split.show();
  const grabs = split.captures.length;
  split.write("compare.reference", { ...WARM, id: "s2", label: "Cool", params: { exposure: -1 } });
  split.show();
  assert.equal(split.captures.length, grabs + 1);
  assert.equal(split.captures.at(-1)?.exposure, -1);
});

test("previews the reference while the Before key is held", (t) => {
  const split = openSplit({ split: false, variables: true });
  t.after(() => split.close());

  split.write("compare.reference", WARM);
  split.toggleSplit();
  fireKey("keydown", "\\", 0);
  const [params, bag] = split.previews.at(-1)!;
  assert.deepEqual(look(params), { exposure: 3, crop: "current crop", processVersion: 1 });
  assert.deepEqual(bag, { "glow.amount": 0.4, "grain.size": 1.5 });
  fireKey("keyup", "\\", 1000);
  assert.deepEqual(split.previews.at(-1), [null]);
});
