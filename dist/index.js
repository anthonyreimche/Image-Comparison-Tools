//#region src/runtime.ts
let _react = null;
let _api = null;
function initRuntime(api) {
	_react = api.react;
	_api = api;
}
/** The scoped SafelightAPI captured at activate(). */
function api() {
	if (!_api) throw new Error("[image-comparison] api used before activate()");
	return _api;
}
/** The app's React namespace (createElement, useState, useEffect, useRef, …). */
function R() {
	if (!_react) throw new Error("[image-comparison] runtime used before activate()");
	return _react;
}
/** createElement shorthand. */
function h(type, props, ...children) {
	return R().createElement(type, props, ...children);
}
//#endregion
//#region src/store.ts
let _store = null;
function initStore() {
	_store = api().stores.create((set) => ({
		splitOn: false,
		split: .5,
		indicator: null,
		setSplitOn: (splitOn) => set({ splitOn }),
		toggleSplit: () => set((s) => ({ splitOn: !s.splitOn })),
		setSplit: (split) => set({ split: Math.max(0, Math.min(1, split)) }),
		setIndicator: (indicator) => set({ indicator })
	}));
	return _store;
}
function compareStore() {
	if (!_store) throw new Error("[image-comparison] store used before activate()");
	return _store;
}
//#endregion
//#region src/develop.ts
/** Build the before/original params, or null if no photo is loaded. */
function beforeParams() {
	const dev = api().stores.useDevelopStore.getState();
	const cur = dev.params;
	if (!cur || !dev.photoId) return null;
	return {
		...dev.history?.[0]?.params ?? cur,
		crop: cur.crop,
		transform: cur.transform,
		straighten: cur.straighten,
		uprightMode: cur.uprightMode,
		guidedLines: cur.guidedLines,
		lensCorrection: cur.lensCorrection
	};
}
/** True when Develop is the active module with a photo open. */
function inDevelop() {
	return api().stores.useUIStore.getState().activeModule === "develop" && !!api().stores.useDevelopStore.getState().photoId;
}
//#endregion
//#region src/keys.ts
const PREVIEW_ACTION = "com.safelight.image-comparison.preview";
const DEFAULT_COMBO = "\\";
const TAP_MS = 220;
function comboFromEvent(e) {
	const k = e.key;
	if (k === "Control" || k === "Shift" || k === "Alt" || k === "Meta") return null;
	const parts = [];
	if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
	if (e.shiftKey) parts.push("Shift");
	if (e.altKey) parts.push("Alt");
	parts.push(k.length === 1 ? k.toUpperCase() : k);
	return parts.join("+");
}
function isEditableTarget(t) {
	if (!(t instanceof HTMLElement)) return false;
	if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
	if (t instanceof HTMLInputElement) return ![
		"range",
		"checkbox",
		"radio",
		"button",
		"color",
		"file",
		"submit",
		"reset"
	].includes(t.type);
	return t.isContentEditable;
}
function previewCombo() {
	return api().stores.useKeybindings.getState().overrides["com.safelight.image-comparison.preview"] ?? DEFAULT_COMBO;
}
function showBefore() {
	const bp = beforeParams();
	if (bp) api().stores.useDevelopStore.getState().setPreviewParams(bp);
}
function showAfter() {
	api().stores.useDevelopStore.getState().setPreviewParams(null);
}
function badge(v) {
	compareStore().getState().setIndicator(v);
}
/** Install the hold/toggle listeners. Returns a cleanup function. */
function initPreviewKeys() {
	let pressing = false;
	let downAt = 0;
	let sticky = false;
	const onKeyDown = (e) => {
		if (e.repeat || pressing) return;
		if (isEditableTarget(e.target) || !inDevelop()) return;
		if (comboFromEvent(e) !== previewCombo()) return;
		pressing = true;
		downAt = e.timeStamp;
		showBefore();
		badge("before");
	};
	const onKeyUp = (e) => {
		if (!pressing) return;
		pressing = false;
		if (e.timeStamp - downAt < TAP_MS) {
			sticky = !sticky;
			if (sticky) {
				showBefore();
				badge("before");
			} else {
				showAfter();
				badge("after");
			}
		} else {
			sticky = false;
			showAfter();
			badge("after");
		}
	};
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
//#endregion
//#region src/icons.ts
function splitIcon(size = 14) {
	return h("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": true
	}, h("rect", {
		x: 3,
		y: 4,
		width: 18,
		height: 16,
		rx: 2
	}), h("line", {
		x1: 12,
		y1: 4,
		x2: 12,
		y2: 20
	}));
}
//#endregion
//#region src/Toolbar.ts
function CompareToolbar() {
	const react = R();
	const store = compareStore();
	const splitOn = store((s) => s.splitOn);
	const toggleSplit = store((s) => s.toggleSplit);
	const [hover, setHover] = react.useState(false);
	return h("button", {
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
			color: splitOn ? "var(--color-on-accent, #fff)" : splitOn || hover ? "var(--color-text-primary)" : "var(--color-text-muted)",
			cursor: "pointer",
			fontSize: "11px",
			lineHeight: 1
		}
	}, splitIcon(13), h("span", null, "Compare"));
}
//#endregion
//#region src/SliderOverlay.ts
const CAPTURE_DEBOUNCE_MS = 60;
function label(text, side) {
	return h("div", { style: {
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
		userSelect: "none"
	} }, text);
}
function SliderOverlay() {
	const react = R();
	const store = compareStore();
	const splitOn = store((s) => s.splitOn);
	const split = store((s) => s.split);
	const setSplit = store((s) => s.setSplit);
	const devStore = api().stores.useDevelopStore;
	const cropping = devStore((s) => s.cropping);
	const activeTool = devStore((s) => s.activeTool);
	const photoId = devStore((s) => s.photoId);
	const { rect, nonce } = api().develop.useDevelopOverlay();
	const canvasRef = react.useRef(null);
	const wrapRef = react.useRef(null);
	const draggingRef = react.useRef(false);
	const [ready, setReady] = react.useState(false);
	const visible = splitOn && !cropping && activeTool === "none" && !!rect && !!photoId;
	react.useEffect(() => {
		if (!visible) {
			setReady(false);
			return;
		}
		let cancelled = false;
		const timer = setTimeout(() => {
			const bp = beforeParams();
			if (!bp) return;
			api().develop.captureFrame(bp).then((bitmap) => {
				const cv = canvasRef.current;
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
	}, [
		visible,
		nonce,
		photoId
	]);
	if (!visible || !rect) return null;
	const pct = `${Math.max(0, Math.min(1, split)) * 100}%`;
	const onDown = (e) => {
		e.preventDefault();
		e.stopPropagation();
		draggingRef.current = true;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {}
	};
	const onMove = (e) => {
		if (!draggingRef.current) return;
		const w = wrapRef.current;
		if (!w) return;
		const r = w.getBoundingClientRect();
		if (r.width > 0) setSplit((e.clientX - r.left) / r.width);
	};
	const onUp = (e) => {
		draggingRef.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {}
	};
	const beforeLayer = h("div", { style: {
		position: "absolute",
		left: 0,
		top: 0,
		height: "100%",
		width: pct,
		overflow: "hidden",
		pointerEvents: "none"
	} }, h("canvas", {
		ref: canvasRef,
		style: {
			position: "absolute",
			left: 0,
			top: 0,
			width: `${rect.w}px`,
			height: `${rect.h}px`,
			opacity: ready ? 1 : 0,
			transition: "opacity 120ms linear"
		}
	}), label("Before", "left"));
	const divider = h("div", {
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
			cursor: "ew-resize",
			pointerEvents: "auto",
			touchAction: "none"
		}
	}, h("div", { style: {
		position: "absolute",
		top: 0,
		left: "50%",
		transform: "translateX(-50%)",
		width: "2px",
		height: "100%",
		background: "rgba(255,255,255,0.9)",
		boxShadow: "0 0 0 1px rgba(0,0,0,0.35)"
	} }), h("div", { style: {
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
		font: "600 13px/1 system-ui, sans-serif"
	} }, "⟺"));
	return h("div", {
		ref: wrapRef,
		style: {
			position: "absolute",
			left: `${rect.x}px`,
			top: `${rect.y}px`,
			width: `${rect.w}px`,
			height: `${rect.h}px`,
			pointerEvents: "none"
		}
	}, beforeLayer, label("After", "right"), divider);
}
//#endregion
//#region src/Indicator.ts
const FADE_MS = 1e3;
function CompareIndicator() {
	const react = R();
	const store = compareStore();
	const indicator = store((s) => s.indicator);
	const setIndicator = store((s) => s.setIndicator);
	const [leaving, setLeaving] = react.useState(false);
	react.useEffect(() => {
		if (indicator !== "after") {
			setLeaving(false);
			return;
		}
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
	return h("div", { style: {
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
		transition: isAfter ? `opacity ${FADE_MS}ms ease-out` : "none"
	} }, isAfter ? "After" : "Before");
}
//#endregion
//#region src/index.ts
const ID = "com.safelight.image-comparison";
const SPLIT_ACTION = `${ID}.split`;
let cleanupKeys = null;
function activate(api) {
	initRuntime(api);
	initStore();
	api.registerKeybinding({
		id: PREVIEW_ACTION,
		label: "Show original (hold or toggle)",
		category: "Develop",
		defaultCombo: "\\",
		handler: () => {}
	});
	cleanupKeys = initPreviewKeys();
	api.registerKeybinding({
		id: SPLIT_ACTION,
		label: "Before / after split",
		category: "Develop",
		defaultCombo: "Shift+|",
		handler: () => {
			if (inDevelop()) compareStore().getState().toggleSplit();
		}
	});
	api.registerSlot({
		id: `${ID}.toolbar`,
		slot: "develop-toolbar",
		component: CompareToolbar
	});
	api.registerSlot({
		id: `${ID}.overlay`,
		slot: "develop-canvas-overlay",
		component: SliderOverlay,
		order: 50
	});
	api.registerSlot({
		id: `${ID}.indicator`,
		slot: "develop-canvas-overlay",
		component: CompareIndicator,
		order: 60
	});
}
function deactivate() {
	cleanupKeys?.();
	cleanupKeys = null;
}
//#endregion
export { activate, deactivate };
