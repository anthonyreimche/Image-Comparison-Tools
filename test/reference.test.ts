import test from "node:test";
import assert from "node:assert/strict";
import { referenceBag, referenceFor } from "../src/reference.ts";

// What another extension (Snapshots) hands over as the edit to compare with:
// read only for the photo it names, and only when it has the fields a Before needs.

const snapshot = {
  photoId: "P",
  source: "snapshots",
  id: "s1",
  label: "Warm",
  params: { exposure: 1 },
  paramBag: { "glow.amount": 0.4 },
};

test("takes a reference for the open photo", () => {
  assert.deepEqual(referenceFor(snapshot, "P"), snapshot);
});

test("ignores a reference for another photo, or with no photo open", () => {
  assert.equal(referenceFor(snapshot, "Q"), null);
  assert.equal(referenceFor(snapshot, null), null);
});

test("ignores a value that isn't a whole reference", () => {
  assert.equal(referenceFor(null, "P"), null);
  assert.equal(referenceFor({ ...snapshot, label: 3 }, "P"), null);
  assert.equal(referenceFor({ ...snapshot, params: null }, "P"), null);
  assert.equal(referenceFor({ ...snapshot, paramBag: [] }, "P"), null);
});

test("draws the reference's extension values, and what only the edit holds at its default", () => {
  const defaults: Record<string, number> = { "glow.amount": 0, "grain.size": 1.5 };
  const bag = referenceBag(snapshot.paramBag, { "glow.amount": 0.9, "grain.size": 3, "gone.x": 1 }, (key) =>
    key in defaults ? { default: defaults[key] } : undefined,
  );
  assert.deepEqual(bag, { "glow.amount": 0.4, "grain.size": 1.5 });
});
