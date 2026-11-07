import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { analyseImage, imageMetadata } from "./analyse-image.mjs";
import { extractEdgeBackgroundColour } from "../palette/edge-background.mjs";
import { MMCQ_VIBRANT_ALGORITHM } from "../palette/config.mjs";

test("image analysis returns actual MMCQ counts, normalized weights and CIELAB coordinates", async () => {
  const buffer = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#b02040" } }).png().toBuffer();
  const result = await analyseImage(buffer, "photo-id");
  assert.equal(result.algorithm, MMCQ_VIBRANT_ALGORITHM);
  assert.equal(result.algorithm_iterations, 2);
  assert.equal(result.sample_longest_side, 256);
  assert.equal(result.palette_size, 1);
  assert.equal(result.colours[0].hex, "#b02040");
  assert.equal(result.colours[0].weight, 1);
  assert.equal(result.colours[0].rank, 1);
  assert.ok(result.colours[0].lab_l > 1, "CIELAB must not be replaced with OKLab");
  const { data, info } = await sharp(buffer).resize({ width: 96, height: 96, fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const pixels = Array.from({ length: info.width * info.height }, (_, i) => [...data.subarray(i * 3, i * 3 + 3)]);
  assert.equal(result.background_hex, extractEdgeBackgroundColour(pixels, info.width, info.height));
});

test("backfill preserves the supplied background and legacy browser sampling is recorded honestly", async () => {
  const buffer = await sharp({ create: { width: 96, height: 48, channels: 3, background: "#b02040" } }).png().toBuffer();
  const result = await analyseImage(buffer, "same-id", { backgroundHex: "#080808", sampleLongestSide: 96 });
  assert.equal(result.background_hex, "#080808");
  assert.equal(result.sample_longest_side, 96);
  await assert.rejects(analyseImage(buffer, "id", { sampleLongestSide: 128 }), /sample size/);
  await assert.rejects(analyseImage(buffer, "id", { backgroundHex: "invalid" }), /background/);
});

test("transparent images fail and orientation/input-pixel guards remain in place", async () => {
  const transparent = await sharp({ create: { width: 16, height: 16, channels: 4, background: "#ff00ff00" } }).png().toBuffer();
  await assert.rejects(analyseImage(transparent, "id"), /opaque pixels/);
  const image = await sharp({ create: { width: 32, height: 16, channels: 3, background: "#999999" } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const metadata = await imageMetadata(image);
  assert.equal(metadata.width, 16);
  assert.equal(metadata.height, 32);
  const sof = image.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(sof > 0);
  image.writeUInt16BE(10_000, sof + 5);
  image.writeUInt16BE(15_000, sof + 7);
  await assert.rejects(analyseImage(image, "too-large"), /pixel limit/);
});
