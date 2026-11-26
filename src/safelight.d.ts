// Minimal type surface SafeLight exposes to this extension. The repo-root
// `extensions/` folder is outside the main tsconfig, so this can't import
// "@/..." — it vendors the shapes it needs. These mirror the core types in
// src/catalog/types.ts and src/extensions/types.ts; only the fields this
// extension touches are declared.

// ── Develop params ───────────────────────────────────────────────────────────
// The full edit state. We only read it back out and hand it to captureFrame /
// setPreviewParams, so the body stays permissive; the fields we copy to keep
// before/after aligned (the geometry, and the processing version) are named
// for clarity.

export interface DevelopParams {
  crop?: unknown;
  transform?: unknown;
  straighten?: unknown;
  uprightMode?: unknown;
  guidedLines?: unknown;
  lensCorrection?: unknown;
  /** The rendering generation the edit was made with; absent on builds that
   *  predate process versions. */
  processVersion?: number;
  [key: string]: unknown;
}

export interface EditSnapshot {
  label: string;
  params: DevelopParams;
}

// ── Zustand-ish store handles ────────────────────────────────────────────────

export interface StoreApi<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState(): T;
  setState(partial: Partial<T> | ((s: T) => Partial<T>), replace?: boolean): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

export type StateCreator<T> = (
  set: (partial: Partial<T> | ((s: T) => Partial<T>), replace?: boolean) => void,
  get: () => T,
) => T;

export interface DevelopStoreState {
  photoId: string | null;
  params: DevelopParams;
  /** Extension stage params by qualified key ("{stageId}.{key}"). */
  paramBag: Record<string, unknown>;
  previewParams: DevelopParams | null;
  history: EditSnapshot[];
  asShotTemperature: number;
  /** `paramBag` is merged over the live one for the preview. */
  setPreviewParams(params: DevelopParams | null, paramBag?: Record<string, unknown> | null): void;
}

export interface CatalogStoreState {
  activePhotoId: string | null;
}

export interface KeybindingsState {
  overrides: Record<string, string>;
}

// ── Contributions / API ──────────────────────────────────────────────────────

// The app's shared UI kit components are plain React components; we don't bundle
// React, so type them as a permissive component alias (matches how `react` is
// typed as `any` above).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentType = (...args: any[]) => any;

export type SlotName =
  | "library-toolbar"
  | "library-subbar"
  | "develop-toolbar"
  | "develop-canvas-overlay";

export interface SlotContribution {
  id: string;
  slot: SlotName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: (...args: any[]) => any;
  order?: number;
}

export interface KeyActionContribution {
  id: string;
  label: string;
  category?: "General" | "Develop" | "Library";
  defaultCombo: string;
  handler(): void;
}

export interface OverlayRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SafelightAPI {
  version: 1;
  extensionId: string;
  /** The app's React instance — use this, never a bundled copy. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  react: any;
  registerSlot(c: SlotContribution): void;
  registerKeybinding(c: KeyActionContribution): void;
  settings: {
    get<T>(key: string, fallback: T): T;
    set(key: string, value: unknown): void;
    onChange(cb: (key: string, value: unknown) => void): () => void;
  };
  navigation: {
    /** The module this window shows: a popped-out window's own module, else
     *  the main window's tab. Ask it before acting on a Develop shortcut,
     *  `current() === "develop"`, rather than reading the URL. Needs
     *  Safelight 3.2.7. */
    current(): string;
  };
  stores: {
    create<T>(initializer: StateCreator<T>): StoreApi<T>;
    useDevelopStore: StoreApi<DevelopStoreState>;
    useCatalogStore: StoreApi<CatalogStoreState>;
    useKeybindings: StoreApi<KeybindingsState>;
    [key: string]: unknown;
  };
  keybindings: { getBinding(actionId: string): string };
  /** Optional on older builds — resolve a cursor token (e.g. "crop-resize-ew",
   *  "pick") to a CSS cursor value, honouring any Custom Cursors theme. */
  cursors?: {
    labels: Readonly<Record<string, string>>;
    resolve(token: string): string;
  };
  develop: {
    useDevelopOverlay(): { rect: OverlayRect | null; nonce: number };
    /** sRGB by default; `asShown` converts it the way the canvas is (a Linux
     *  display profile). Older cores ignore the option. */
    captureFrame(
      params: DevelopParams,
      options?: { asShown?: boolean; paramBag?: Record<string, unknown> },
    ): Promise<ImageBitmap>;
  };
  /** The value a stage reads while an edit holds none, by qualified key.
   *  Absent on builds before extension params were listed. */
  params?: {
    get(qualifiedKey: string): { default: unknown } | undefined;
  };
  /** Named JSON values every extension can share, in every window. Absent
   *  before Safelight 3.0.1. */
  variables?: {
    register<T>(name: string, init: { initial: T; description?: string }): { value: T };
    subscribe<T>(name: string, listener: (snapshot: { value: T }) => void): () => void;
  };
  ui?: {
    Button: ComponentType;
    Select: ComponentType;
    TextInput: ComponentType;
    NumberInput: ComponentType;
    TextArea: ComponentType;
    Toggle: ComponentType;
    SegmentedControl: ComponentType;
    Field: ComponentType;
    Section: ComponentType;
    Card: ComponentType;
    Badge: ComponentType;
    ProgressBar: ComponentType;
    Row: ComponentType;
    Stack: ComponentType;
    tokens: Record<string, string>;
  };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
