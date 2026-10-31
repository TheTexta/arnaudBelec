import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";
import { blogStorage, type BlogMedia } from "./storage";

const id = "12345678-1234-1234-1234-123456789abc";
const env: NodeJS.ProcessEnv = { NODE_ENV: "test", R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "test-key", R2_SECRET_ACCESS_KEY: "test-secret" };
const bytes = Buffer.from([255, 216, 255, 0]);
const media: BlogMedia = { id, post_id: id, storage_path: `blog/${id}.jpg`, filename: "photo.jpg", content_type: "image/jpeg", size_bytes: bytes.length, multipart_id: "upload", state: "ready", sha256: createHash("sha256").update(bytes).digest("hex"), source_etag: '"source"', published_etag: null, created_at: new Date().toISOString() };

test("presigned media stays site-scoped, typed, and short-lived; photo and pending paths are rejected", async () => {
  const storage = blogStorage(env);
  const part = new URL(await storage.signPart(media.storage_path, "upload", 2));
  assert.equal(part.pathname, `/arnaudbelec-staging/${media.storage_path}`);
  assert.equal(part.searchParams.get("X-Amz-Expires"), "900");
  const read = new URL(await storage.signRead(media.storage_path, "image/jpeg", true));
  assert.equal(read.pathname, `/arnaudbelec-staging/${media.storage_path}`);
  assert.equal(read.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(read.searchParams.get("response-content-type"), "image/jpeg");
  const published = new URL(await storage.signRead(media.storage_path, "image/jpeg", false));
  assert.equal(published.pathname, `/arnaudbelec/${media.storage_path}`);
  for (const path of [`uploads/${id}.jpg`, `blog/_pending/${id}.jpg`, `blog/${id}.html`]) await assert.rejects(storage.signRead(path, "image/jpeg", true), /Invalid/);
});

test("promotion is conditional and independently reads back the destination before registration", async () => {
  let copied = false;
  let copyHeaders: Record<string, string> = {};
  const storage = blogStorage(env, {
    handle: async (request: { method: string; headers: Record<string, string>; path: string }) => {
      if (request.method === "HEAD") return { response: { statusCode: copied ? 200 : 404, headers: { etag: '"destination"', "content-length": String(bytes.length), "content-type": "image/jpeg" } } };
      if (request.method === "PUT") {
        copied = true; copyHeaders = request.headers;
        return { response: { statusCode: 200, headers: { "content-type": "application/xml" }, body: Buffer.from('<CopyObjectResult><ETag>"destination"</ETag></CopyObjectResult>') } };
      }
      assert.equal(request.method, "GET");
      return { response: { statusCode: 200, headers: {}, body: Readable.from([bytes]) } };
    },
  });
  assert.equal(await storage.promote(media), '"destination"');
  assert.equal(copyHeaders["x-amz-copy-source"], `arnaudbelec-staging/${media.storage_path}`);
  assert.equal(copyHeaders["x-amz-copy-source-if-match"], '"source"');
  assert.equal(copyHeaders["cf-copy-destination-if-none-match"], "*");
  assert.match(copyHeaders.authorization, /cf-copy-destination-if-none-match/);
});

test("checksum mismatches retain recovery objects and do not report promotion success", async () => {
  const storage = blogStorage(env, { handle: async (request: { method: string }) => request.method === "HEAD"
    ? { response: { statusCode: 200, headers: { etag: '"destination"', "content-length": String(bytes.length), "content-type": "image/jpeg" } } }
    : { response: { statusCode: 200, headers: {}, body: Readable.from([Buffer.alloc(bytes.length)]) } },
  });
  await assert.rejects(storage.promote(media), /checksum failed/);
});

test("upload finalization verifies immutable completed bytes and rejects disguised active content", async () => {
  const storageFor = (body: Buffer) => blogStorage(env, {
    handle: async (request: { method: string }) => request.method === "HEAD"
      ? { response: { statusCode: 200, headers: { etag: '"source"', "content-length": String(body.length), "content-type": "image/jpeg" } } }
      : { response: { statusCode: 200, headers: {}, body: Readable.from([body]) } },
  });
  assert.deepEqual(await storageFor(bytes).finish({ ...media, state: "uploading" }), { sha256: media.sha256, source_etag: '"source"' });
  await assert.rejects(storageFor(Buffer.from("<svg")).finish({ ...media, state: "uploading" }), /file contents/);
});
