import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("journal CORS permits direct upload and private preview only from the production origin", async () => {
  const rules = JSON.parse(await readFile(new URL("../../deploy/r2/staging-cors.json", import.meta.url), "utf8"));
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0].AllowedOrigins, ["https://arnaud-belec.vercel.app"]);
  assert.deepEqual(new Set(rules[0].AllowedMethods), new Set(["PUT", "GET", "HEAD"]));
  assert.deepEqual(rules[0].AllowedHeaders, ["Content-Type"]);
  assert.deepEqual(rules[0].ExposeHeaders, ["ETag"]);
  assert.equal(rules[0].MaxAgeSeconds, 3600);
});
