import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPath, uploadProvider, objectProvider, r2Config, PART_SIZE, validateParts, verifyPromotion } from "./storage.mjs";
import { importId } from "./r2-import.mjs";
import { reconcileCatalogue, verifyCopiedOriginal, sha256 } from "./storage-migration.mjs";

const id = "12345678-1234-1234-1234-123456789abc";
const path = `uploads/${id}.jpg`;

test("storage defaults remain Supabase and credentials/bucket scope fail closed", () => {
  assert.equal(uploadProvider({}), "supabase");
  assert.equal(objectProvider(undefined), "supabase");
  assert.equal(uploadProvider({ ARNAUD_UPLOAD_STORAGE: "r2" }), "r2");
  assert.throws(() => uploadProvider({ ARNAUD_UPLOAD_STORAGE: "other" }));
  assert.throws(() => objectProvider("other"));
  assert.throws(() => r2Config({}));
  const config = r2Config({ R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "local", R2_SECRET_ACCESS_KEY: "test", R2_BUCKET: "another-site" });
  assert.equal(config.published, "arnaudbelec");
  assert.equal(config.staging, "arnaudbelec-staging");
});

test("canonical keys exclude private and non-image paths", () => {
  assert.equal(assertPath(path), path);
  for (const key of ["uploads/a.jpg", `staging/${path}`, `uploads/_pending/${id}.jpg`, `uploads/${id}.jpg/extra`, `uploads/${id}.svg`, `uploads/%2f${id}.jpg`]) assert.throws(() => assertPath(key));
});

test("multipart completion requires contiguous exact-sized parts", () => {
  const parts = [{ PartNumber: 1, Size: PART_SIZE, ETag: "one" }, { PartNumber: 2, Size: 1, ETag: "two" }];
  validateParts(parts, PART_SIZE + 1);
  assert.throws(() => validateParts(parts.slice(1), PART_SIZE + 1));
  assert.throws(() => validateParts([...parts].reverse(), PART_SIZE + 1));
  assert.throws(() => validateParts([{ ...parts[0], Size: 1 }, parts[1]], PART_SIZE + 1));
  assert.throws(() => validateParts([{ ...parts[0], ETag: "" }, parts[1]], PART_SIZE + 1));
});

function fakeStorage({ existing = false, mismatch = false } = {}) {
  let present = existing, copies = 0, reads = 0;
  const metadata = { ETag: "revision", ContentLength: 3, ContentType: "image/jpeg" };
  return {
    head: async (_path, staging) => staging || present ? metadata : null,
    hash: async (_path, staging) => { reads++; return { size: 3, sha256: mismatch && !staging ? "bad" : sha256(Buffer.from("abc")) }; },
    promote: async () => { present = true; copies++; },
    put: async () => { present = true; copies++; },
    counts: () => ({ copies, reads }),
  };
}

test("promotion independently hashes both bodies and retry does not overwrite", async () => {
  const storage = fakeStorage();
  const result = await verifyPromotion(storage, path, 3, "image/jpeg");
  assert.equal(result.sha256, sha256(Buffer.from("abc")));
  await verifyPromotion(storage, path, 3, "image/jpeg");
  assert.deepEqual(storage.counts(), { copies: 1, reads: 4 });
});

test("checksum failure retains both recovery objects instead of deleting", async () => {
  const storage = fakeStorage({ mismatch: true });
  await assert.rejects(verifyPromotion(storage, path, 3, "image/jpeg"), /Recovery objects were retained/);
  assert.equal(storage.counts().copies, 1);
  assert.ok(await storage.head(path));
  assert.ok(await storage.head(path, true));
});

test("CLI identity is stable for retries and bound to filename/original bytes", () => {
  const first = importId("photo.jpg", Buffer.from("abc"));
  assert.equal(first, importId("photo.jpg", Buffer.from("abc")));
  assert.notEqual(first, importId("other.jpg", Buffer.from("abc")));
  assert.notEqual(first, importId("photo.jpg", Buffer.from("def")));
});

test("migration resume rereads both sources and rejects changed source bytes", async () => {
  const storage = fakeStorage();
  const entry = { id, path, filename: "photo.jpg" };
  const verified = await verifyCopiedOriginal(storage, entry, Buffer.from("abc"), "image/jpeg", true);
  await verifyCopiedOriginal(storage, verified, Buffer.from("abc"), "image/jpeg", true);
  assert.deepEqual(storage.counts(), { copies: 1, reads: 2 });
  await assert.rejects(verifyCopiedOriginal(storage, verified, Buffer.from("def"), "image/jpeg", true), /Source changed/);
});

test("cutover reconciliation rejects source scope, duplicate IDs and catalogue drift", () => {
  const photo = { id, storage_path: path, filename: "photo.jpg" };
  const manifest = { version: 1, sourceUrl: "https://source.example", photographs: [{ id, path, filename: photo.filename }] };
  reconcileCatalogue(manifest, [photo], manifest.sourceUrl);
  assert.throws(() => reconcileCatalogue(manifest, [photo], "https://other.example"));
  assert.throws(() => reconcileCatalogue(manifest, [], manifest.sourceUrl));
  assert.throws(() => reconcileCatalogue(manifest, [{ ...photo, storage_path: `uploads/${id}.png` }], manifest.sourceUrl));
  assert.throws(() => reconcileCatalogue({ ...manifest, photographs: [...manifest.photographs, ...manifest.photographs] }, [photo, photo], manifest.sourceUrl));
});
