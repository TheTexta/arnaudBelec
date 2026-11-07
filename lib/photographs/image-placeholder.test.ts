import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { imagePlaceholder } from "./image-placeholder";

test("the inline placeholder renders the photograph's matched colour", async () => {
  const placeholder = imagePlaceholder("#7A95ae");
  assert.ok(placeholder.startsWith("data:image/svg+xml,"));
  const svg = decodeURIComponent(placeholder.slice(placeholder.indexOf(",") + 1));
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1);
  assert.equal(info.height, 1);
  assert.deepEqual([...data], [122, 149, 174, 255]);
});

test("missing or invalid colours use the neutral fallback without embedding input", () => {
  const fallback = imagePlaceholder(null);
  assert.ok(decodeURIComponent(fallback).includes('fill="#b6b4be"'));
  assert.equal(imagePlaceholder(""), fallback);
  assert.equal(imagePlaceholder('red" onload="alert(1)'), fallback);
});
