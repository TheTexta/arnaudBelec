import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";
import { journalStorage, Media, verifyOriginal } from "./media";
import { MAX_MEDIA_BYTES } from "../blog/media";
import { privateRestoreRequest } from "./restore";
import { contentMedia } from "./content";
import { postgresAdapter } from "@payloadcms/db-postgres";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYVQAAAAASUVORK5CYII=", "base64");
test("switching new uploads off retains private storage reads and receipt enforcement", async () => {
  const [plugin] = journalStorage(true, { NODE_ENV: "test", ARNAUD_BLOG_UPLOADS_ENABLED: "false", R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "fixture", R2_SECRET_ACCESS_KEY: "fixture" });
  const config = await plugin({ secret: "fixture-only", collections: [Media], db: postgresAdapter({ pool: { connectionString: "postgresql://127.0.0.1:1/must-not-connect" }, push: false }) });
  const upload = config.collections![0].upload;
  assert.ok(upload && typeof upload === "object");
  assert.ok(upload.handlers?.length);
  assert.equal(upload.requiresClientUploadReceipt, true);
});
test("original verification streams actual bytes and rejects metadata/type/size mismatches", async () => {
  const result = await verifyOriginal(Readable.from([png.subarray(0, 7), png.subarray(7)]), png.length, "original.png", "image/png");
  assert.equal(result.sha256, createHash("sha256").update(png).digest("hex"));
  assert.equal(result.size, png.length);
  await assert.rejects(verifyOriginal(Readable.from([png]), png.length - 1, "original.png", "image/png"), /do not match/);
  await assert.rejects(verifyOriginal(Readable.from([png]), png.length, "original.jpg", "image/jpeg"), /do not match/);
  await assert.rejects(verifyOriginal(Readable.from([Buffer.from("<html>active</html>")]), 19, "original.png", "image/png"), /do not match/);
  await assert.rejects(verifyOriginal(Readable.from([]), 0, "empty.png", "image/png"), /between 1 byte/);
});

test("WAV aliases and Ogg Opus normalize to supported canonical audio, not Ogg video", async () => {
  const wav = Buffer.alloc(48);
  wav.write("RIFF", 0); wav.writeUInt32LE(40, 4); wav.write("WAVE", 8); wav.write("fmt ", 12);
  assert.equal((await verifyOriginal(Readable.from([wav]), wav.length, "audio.wav", "audio/x-wav")).mimeType, "audio/wav");
  const ogg = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(24), Buffer.from("OpusHead"), Buffer.alloc(16)]);
  assert.equal((await verifyOriginal(Readable.from([ogg]), ogg.length, "audio.ogg", "audio/ogg")).mimeType, "audio/ogg");
  const video = Buffer.from(ogg); video.set([0x80, 0x74, 0x68, 0x65, 0x6f, 0x72, 0x61, 0], 28);
  await assert.rejects(verifyOriginal(Readable.from([video]), video.length, "audio.ogg", "audio/ogg"), /do not match/);
});

test("100 MiB streamed originals are accepted; oversized streams fail without buffering the entire file", async () => {
  async function* source(size: number) {
    yield png;
    const chunk = Buffer.alloc(256 * 1024);
    for (let remaining = size - png.length; remaining > 0; remaining -= chunk.length) yield chunk.subarray(0, Math.min(chunk.length, remaining));
  }
  assert.equal((await verifyOriginal(source(MAX_MEDIA_BYTES), MAX_MEDIA_BYTES, "large.png", "image/png")).size, MAX_MEDIA_BYTES);
  await assert.rejects(verifyOriginal(source(MAX_MEDIA_BYTES + 1), MAX_MEDIA_BYTES, "large.png", "image/png"), /must not exceed/);
});

test("restore normalization preserves native request bodies and always selects a private restore", async () => {
  const original = new Request("http://localhost/api/cms/posts/versions/fixture?draft=false&depth=0", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: "{}" });
  const normalized = privateRestoreRequest(original, ["posts", "versions", "fixture"]);
  assert.equal(new URL(normalized.url).searchParams.get("draft"), "true");
  assert.equal(new URL(normalized.url).searchParams.get("depth"), "0");
  assert.equal(normalized.headers.get("origin"), "http://localhost");
  assert.equal(await normalized.text(), "{}");
  const read = new Request("http://localhost/api/cms/posts/versions/fixture");
  assert.equal(privateRestoreRequest(read, ["posts", "versions", "fixture"]), read);
});

test("reference extraction accepts native uploads only and rejects legacy or malformed documents", () => {
  const id = "12345678-1234-4234-8234-123456789abc";
  assert.deepEqual(contentMedia({ root: { type: "root", children: [{ type: "upload", relationTo: "media", value: id }] } }), [id]);
  assert.throws(() => contentMedia([]));
  assert.throws(() => contentMedia({ root: { type: "root", children: [{ type: "upload", relationTo: "cms-users", value: id }] } }));
  assert.throws(() => contentMedia({ root: { type: "root", children: [{ type: "upload", relationTo: "media" }] } }));
});
