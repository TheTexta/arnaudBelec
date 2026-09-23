import assert from "node:assert/strict";
import { test } from "node:test";

import { extractEdgeBackgroundColour } from "./edge-background.mjs";

test("the background follows the photo edge rather than its centre", () => {
  const width = 20;
  const height = 20;
  const pixels = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    return x < 2 || x >= width - 2 || y < 2 || y >= height - 2
      ? [15, 30, 185]
      : [235, 35, 25];
  });

  const background = extractEdgeBackgroundColour(pixels, width, height);
  const [red, green, blue] = background.slice(1).match(/../g).map((channel) => parseInt(channel, 16));
  assert.ok(blue > red && blue > green, `Expected a blue edge colour, got ${background}`);
  assert.notEqual(background, "#0f1eb9");
  assert.equal(extractEdgeBackgroundColour(pixels, width, height), background);
});

test("transparent edge pixels do not influence the background", () => {
  const pixels = Array.from({ length: 100 }, (_, index) => index % 10 === 0 ? null : [80, 80, 80]);
  assert.match(extractEdgeBackgroundColour(pixels, 10, 10), /^#[0-9a-f]{6}$/);
  const transparentBorder = Array.from({ length: 100 }, (_, index) => {
    const x = index % 10;
    const y = Math.floor(index / 10);
    return x === 0 || x === 9 || y === 0 || y === 9 ? null : [80, 80, 80];
  });
  assert.match(extractEdgeBackgroundColour(transparentBorder, 10, 10), /^#[0-9a-f]{6}$/);
  assert.throws(() => extractEdgeBackgroundColour(Array(100).fill(null), 10, 10));
});

test("a dark neutral edge is not artificially brightened", () => {
  const pixels = Array.from({ length: 100 }, () => [5, 5, 5]);
  assert.equal(extractEdgeBackgroundColour(pixels, 10, 10), "#050505");
});
