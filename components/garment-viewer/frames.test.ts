import assert from "node:assert/strict";
import test from "node:test";
import { draggedFrame, frameIndex } from "./frames";

test("frame indices clamp rather than assuming a complete 360-degree capture", () => {
  assert.equal(frameIndex(-1, 4), 0);
  assert.equal(frameIndex(9, 4), 3);
  assert.equal(frameIndex(1, 0), 0);
  assert.equal(frameIndex(NaN, 4), 0);
  assert.equal(frameIndex(3, 1), 0);
});

test("pointer displacement uses a stable threshold in either direction", () => {
  assert.equal(draggedFrame(2, 27, 7), 2);
  assert.equal(draggedFrame(2, 28, 7), 3);
  assert.equal(draggedFrame(2, -28, 7), 1);
  assert.equal(draggedFrame(2, -1000, 7), 0);
  assert.equal(draggedFrame(2, 1000, 7), 6);
  assert.equal(draggedFrame(2, NaN, 7), 2);
});
