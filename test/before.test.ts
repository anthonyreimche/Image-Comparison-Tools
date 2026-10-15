import test from "node:test";
import assert from "node:assert/strict";
import { buildBeforeParams } from "../src/before.ts";
import type { DevelopParams } from "../src/safelight";

const FLAT = {
  perspectiveV: 0,
  perspectiveH: 0,
  aspect: 0,
  scale: 0,
  offsetX: 0,
  offsetY: 0,
  flipH: false,
  flipV: false,
};

// The seeded Original snapshot of an older photo, and the same photo's edit
// after Update processing: different look, different framing, newer version.
const original: DevelopParams = {
  exposure: 0,
  contrast: 0,
  temperature: 5200,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  transform: FLAT,
  straighten: 0,
  uprightMode: "off",
  guidedLines: [],
  lensCorrection: { enabled: false },
  processVersion: 1,
};

const current: DevelopParams = {
  exposure: 1.2,
  contrast: 30,
  temperature: 6100,
  crop: { x: 0.1, y: 0.05, width: 0.8, height: 0.9 },
  transform: { ...FLAT, perspectiveV: 12 },
  straighten: -1.5,
  uprightMode: "guided",
  guidedLines: [{ x1: 0.1, y1: 0.2, x2: 0.9, y2: 0.25 }],
  lensCorrection: { enabled: true },
  processVersion: 2,
};

test("keeps the photo's current version when the original snapshot is older", () => {
  const before = buildBeforeParams(current, original);
  assert.equal(before.processVersion, 2);
  assert.deepEqual(before, {
    exposure: 0,
    contrast: 0,
    temperature: 5200,
    crop: current.crop,
    transform: current.transform,
    straighten: current.straighten,
    uprightMode: current.uprightMode,
    guidedLines: current.guidedLines,
    lensCorrection: current.lensCorrection,
    processVersion: 2,
  });
});

test("keeps an older photo's Before at its older version", () => {
  const before = buildBeforeParams(
    { ...current, processVersion: 1 },
    { ...original, processVersion: 2 },
  );
  assert.equal(before.processVersion, 1);
});
