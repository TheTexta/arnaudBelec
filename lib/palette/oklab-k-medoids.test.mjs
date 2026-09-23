import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractOklabKMedoidsPalette,
  rgbToOklab,
} from "./oklab-k-medoids.mjs";

test("OKLab conversion maps white to unit lightness with no chroma", () => {
  const [lightness, greenRed, blueYellow] = rgbToOklab([255, 255, 255]);
  assert.ok(Math.abs(lightness - 1) < 0.000001);
  assert.ok(Math.hypot(greenRed, blueYellow) < 0.000001);
});

test("saturation preference keeps vivid accents alongside a large dark background", () => {
  const dark = [8, 8, 8];
  const gray = [65, 65, 65];
  const vivid = [
    [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 220, 0],
    [0, 255, 255], [255, 0, 255], [255, 120, 0],
  ];
  const pixels = [
    ...Array.from({ length: 760 }, () => dark),
    ...Array.from({ length: 100 }, () => gray),
    ...vivid.flatMap((rgb) => Array.from({ length: 20 }, () => rgb)),
  ];

  const palette = extractOklabKMedoidsPalette(pixels);
  assert.equal(palette.length, 7);
  assert.deepEqual(extractOklabKMedoidsPalette(pixels), palette);
  assert.ok(palette.filter(({ rgb }) => vivid.some((colour) =>
    colour.every((channel, index) => channel === rgb[index]))).length >= 5);
  assert.ok(palette.every(({ rgb }) => pixels.some((pixel) =>
    pixel.every((channel, index) => channel === rgb[index]))));
  assert.ok(Math.abs(palette.reduce((sum, { weight }) => sum + weight, 0) - 1) < 0.000001);
});

test("a flat image still has seven entries without inventing colours", () => {
  const palette = extractOklabKMedoidsPalette(Array.from({ length: 20 }, () => [42, 42, 42]));
  assert.equal(palette.length, 7);
  assert.ok(palette.every(({ rgb }) => rgb.join() === "42,42,42"));
  assert.deepEqual(palette.map(({ weight }) => weight), [1, 0, 0, 0, 0, 0, 0]);
});
