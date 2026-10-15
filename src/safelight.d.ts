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
  previewParams: DevelopParams | null;
  history: EditSnapshot[];
  asShotTemperature: number;
  cropping: boolean;
  activeTool: "none" | "mask" | "retouch" | "hsl-picker";
  setPreviewParams(params: DevelopParams | null): void;
}

export interface UIStoreState {
  activeModule: "library" | "develop";
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
  stores: {
    create<T>(initializer: StateCreator<T>): StoreApi<T>;
    useDevelopStore: StoreApi<DevelopStoreState>;
    useUIStore: StoreApi<UIStoreState>;
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
    captureFrame(params: DevelopParams, options?: { asShown?: boolean }): Promise<ImageBitmap>;
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
