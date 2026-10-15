import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { r2Storage } from "./storage.mjs";

const path = "uploads/12345678-1234-1234-1234-123456789abc.jpg";
const env = { R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "test-key", R2_SECRET_ACCESS_KEY: "test-secret" };

test("S3 promotion signs source AND immutable destination conditions", async () => {
  let captured;
  const storage = r2Storage(env, {
    handle: async request => {
      captured = request;
      return { response: { statusCode: 200, headers: { "content-type": "application/xml" }, body: Buffer.from('<CopyObjectResult><ETag>"copied"</ETag><LastModified>2026-10-14T00:00:00Z</LastModified></CopyObjectResult>') } };
    },
  });
  await storage.promote(path, '"source-etag"', "image/jpeg");
  assert.equal(captured.hostname, `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  assert.equal(captured.path, `/arnaudbelec/${path}`);
  assert.equal(captured.headers["x-amz-copy-source"], `arnaudbelec-staging/${path}`);
  assert.equal(captured.headers["x-amz-copy-source-if-match"], '"source-etag"');
  assert.equal(captured.headers["cf-copy-destination-if-none-match"], "*");
  assert.match(captured.headers.authorization, /cf-copy-destination-if-none-match/);
  assert.equal(captured.headers["cache-control"], "public, max-age=31536000, immutable");
});

test("presigned part URLs target staging, one part and a short expiry", async () => {
  const storage = r2Storage(env);
  const url = new URL(await storage.signPart(path, "upload-id", 2));
  assert.equal(url.hostname, `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  assert.equal(url.pathname, `/arnaudbelec-staging/${path}`);
  assert.equal(url.searchParams.get("partNumber"), "2");
  assert.equal(url.searchParams.get("uploadId"), "upload-id");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "900");
});

test("migration refuses remote writes without confirmation before loading environment", () => {
  for (const mode of ["--copy", "--cutover"]) {
    const result = spawnSync(process.execPath, ["scripts/migrate-photographs-to-r2.mjs", mode], { cwd: new URL("../../", import.meta.url), encoding: "utf8", env: {} });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /require --confirm-production/);
  }
});
