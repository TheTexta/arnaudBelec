import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { validateImageSample } from "./image-sample.mjs";
import { MAXIMUM_SAMPLE_BYTES } from "../palette/config.mjs";

test("new and already-open legacy clients retain bounded, dimension-checked samples", () => {
  const dimensions = { width: 4000, height: 3000 };
  assert.equal(validateImageSample({ format: "png", width: 256, height: 192 }, dimensions), 256);
  assert.equal(validateImageSample({ format: "png", width: 96, height: 72 }, dimensions), 96);
  assert.equal(validateImageSample({ format: "png", width: 32, height: 16 }, { width: 32, height: 16 }), 256);
  for (const metadata of [{ format: "jpeg", width: 256, height: 192 }, { format: "png", width: 256, height: 256 }, { format: "png", width: 512, height: 384 }]) {
    assert.throws(() => validateImageSample(metadata, dimensions), /dimensions/);
  }
});

test("the PNG byte cap accommodates an incompressible 256px RGBA sample", async () => {
  const data = Buffer.alloc(256 * 256 * 4);
  let seed = 1;
  for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed >>> 24; }
  const png = await sharp(data, { raw: { width: 256, height: 256, channels: 4 } }).png().toBuffer();
  assert.ok(png.length < MAXIMUM_SAMPLE_BYTES);
});
