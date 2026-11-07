import assert from "node:assert/strict";
import test from "node:test";
import { extractMmcqVibrantPalette, MMCQ_MINIMUM_DISTANCE } from "./mmcq-vibrant.mjs";

const pixels = (rgb, count) => Array.from({ length: count }, () => [...rgb]);
const accents = [[220, 20, 35], [20, 180, 70], [30, 80, 220], [235, 190, 20], [160, 35, 190], [30, 180, 180], [245, 110, 30]];

test("seven supported, sampled and perceptually distinct colours are available without padding", () => {
  const input = accents.flatMap(rgb => pixels(rgb, 100));
  const before = structuredClone(input);
  const palette = extractMmcqVibrantPalette(input);
  assert.equal(palette.length, 7);
  assert.deepEqual(input, before);
  assert.deepEqual(extractMmcqVibrantPalette([...input].reverse()), palette);
  for (let i = 0; i < palette.length; i++) {
    assert.ok(input.some(rgb => rgb.join() === palette[i].rgb.join()));
    for (let j = i + 1; j < palette.length; j++) {
      assert.ok(Math.hypot(...palette[i].oklab.map((v, axis) => v - palette[j].oklab[axis])) >= MMCQ_MINIMUM_DISTANCE);
    }
  }
});

test("background exclusion preserves real accent population weights rather than selection scores", () => {
  const palette = extractMmcqVibrantPalette([
    ...pixels([8, 8, 8], 9000), ...pixels(accents[0], 300), ...pixels(accents[1], 100),
  ], 7, "#080808");
  assert.equal(palette.length, 2);
  assert.equal(palette.find(c => c.rgb.join() === accents[0].join()).weight, 0.75);
  assert.equal(palette.find(c => c.rgb.join() === accents[1].join()).weight, 0.25);
  assert.equal(palette.reduce((sum, c) => sum + c.weight, 0), 1);
});

test("selection keeps vivid accents and muted coverage without amplifying small populations", () => {
  const palette = extractMmcqVibrantPalette([...pixels([60, 60, 60], 9500), ...pixels(accents[0], 300), ...pixels(accents[2], 200)]);
  assert.equal(palette.length, 3);
  assert.equal(palette.find(c => c.rgb.join() === "60,60,60").weight, 0.95);
  assert.notEqual(palette[0].rgb.join(), "60,60,60");
});

test("noise, near-flat and grayscale samples do not acquire synthetic or duplicate swatches", () => {
  const noisy = extractMmcqVibrantPalette([...pixels([80, 80, 80], 10000), [255, 0, 255], [0, 255, 0]]);
  assert.equal(noisy.length, 1);
  const excludedNoise = extractMmcqVibrantPalette([...pixels([80, 80, 80], 10000), [255, 0, 255], [0, 255, 0]], 7, "#505050");
  assert.deepEqual(excludedNoise.map(c => c.rgb), [[80, 80, 80]], "Background exclusion must not amplify isolated hot pixels");
  assert.equal(excludedNoise[0].weight, 1);
  for (const input of [pixels([42, 42, 42], 20), [[0, 0, 0], [255, 255, 255]].flatMap(rgb => pixels(rgb, 100)),
    [...pixels([100, 100, 100], 100), ...pixels([102, 102, 102], 100)]]) {
    const palette = extractMmcqVibrantPalette(input, 7, "#2a2a2a");
    assert.ok(palette.length >= 1 && palette.length <= 2);
    assert.ok(palette.every(c => input.some(rgb => rgb.join() === c.rgb.join())));
    assert.equal(new Set(palette.map(c => c.rgb.join())).size, palette.length);
  }
  assert.deepEqual(extractMmcqVibrantPalette([[42, 42, 42]], 7, "#2a2a2a")[0].rgb, [42, 42, 42]);
});

test("64-candidate quantisation is deterministic for a rich sample and never mutates input", () => {
  const input = Array.from({ length: 4096 }, (_, i) => [i % 256, (i * 37) % 256, (i * 71) % 256]);
  input.forEach(Object.freeze);
  Object.freeze(input);
  const first = extractMmcqVibrantPalette(input);
  assert.deepEqual(extractMmcqVibrantPalette([...input].reverse()), first);
  assert.ok(first.every(c => input.some(rgb => rgb.join() === c.rgb.join())));
});

test("empty, invalid samples, backgrounds and unsupported sizes fail explicitly", () => {
  assert.throws(() => extractMmcqVibrantPalette([]), /empty/);
  for (const size of [0, 8, 2.5]) assert.throws(() => extractMmcqVibrantPalette([[0, 0, 0]], size), /one and seven/);
  for (const pixel of [[-1, 0, 0], [256, 0, 0], [NaN, 0, 0], [1, 2], [1.5, 2, 3], null]) {
    assert.throws(() => extractMmcqVibrantPalette([pixel]), /RGB/);
  }
  assert.throws(() => extractMmcqVibrantPalette([[0, 0, 0]], 7, "not-a-colour"), /background/);
});
