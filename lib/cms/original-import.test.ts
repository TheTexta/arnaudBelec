import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { createOriginalImporter, MAX_ORIGINAL_BYTES, PART_BYTES, validateManifest, type ImportRecord, type Journal, type Manifest, type Observation, type Part, type Source, type Storage } from "./original-import/core";
import { parseArguments, main } from "../../scripts/cms/import-original";
import { originalR2 } from "./original-import/r2";

const actor = "12345678-1234-4234-8234-123456789abc";
const mp4 = Buffer.concat([Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"), Buffer.alloc(8192)]);
function fixture(data = mp4) {
  const manifest: Manifest = { filename: "untouched-original.mp4", bytes: data.length, sha256: createHash("sha256").update(data).digest("hex"), identity: { ino: "1", size: String(data.length) }, probe: { duration: 61, width: 3840, height: 2160, videoCodec: "h264", audioCodecs: ["aac"] } };
  let row: ImportRecord;
  let token: string | undefined;
  let remote: Buffer | undefined;
  let created = 0;
  let registered = 0;
  let sourceChanged = false;
  let failPart = false;
  let failComplete = false;
  let failCreate = false;
  let failRegister: "before" | "after" | undefined;
  let listOverride: ((marker?: string) => { parts: Part[]; next?: string }) | undefined;
  const stored = new Map<number, Part>();
  const uploaded: number[] = [];
  const journal: Journal = {
    async reserve(record) { if (!row) row = structuredClone(record); return structuredClone(row); },
    async inspect() { return structuredClone(row); },
    async lease(_id, value) { if (token) throw new Error("already leased"); token = value; },
    async renew(_id, value) { assert.equal(value, token); },
    async release(_id, value, failed) { assert.equal(value, token); token = undefined; if (failed && !row.mediaId) row.state = "recoverable_error"; },
    async upload(_id, value, uploadId) { assert.equal(value, token); row.uploadId = uploadId; row.state = "uploading"; },
    async state(_id, value, state) { assert.equal(value, token); row.state = state; },
    async register(_id, value, observation: Observation) {
      assert.equal(value, token);
      assert.equal(observation.sha256, row.sha256);
      if (failRegister === "before") { failRegister = undefined; throw new Error("transaction rolled back"); }
      registered++;
      row.mediaId = row.id; row.state = "registered";
      if (failRegister === "after") { failRegister = undefined; throw new Error("response lost after commit"); }
      return row.id;
    },
  };
  const source: Source = {
    async scan() { return { ...structuredClone(manifest), sha256: sourceChanged ? "a".repeat(64) : manifest.sha256 }; },
    async assertIdentity() { if (sourceChanged) throw new Error("source changed"); },
    async part(offset, bytes) { if (sourceChanged) throw new Error("source changed"); return data.subarray(offset, offset + bytes); },
  };
  const storage: Storage = {
    async head() { return remote ? { bytes: remote.length, etag: "immutable-etag" } : null; },
    async create() { created++; if (failCreate) throw new Error("response lost"); return "upload-id"; },
    async list(_key, _upload, marker) { return listOverride ? listOverride(marker) : { parts: [...stored.values()].sort((a, b) => a.number - b.number) }; },
    async put(_key, _upload, number, body) { uploaded.push(number); stored.set(number, { number, bytes: body.length, etag: `etag-${number}` }); if (failPart) { failPart = false; throw new Error("expired temporary capability"); } return `etag-${number}`; },
    async complete() { remote = data; if (failComplete) throw new Error("response lost after completion"); },
    async read(_key, etag) { assert.equal(etag, "immutable-etag"); return (async function* () { yield remote!; })(); },
  };
  return { importer: createOriginalImporter(journal, storage, source, actor), journal, manifest, uploaded, stored,
    get row() { return row; }, get created() { return created; }, get registered() { return registered; },
    changeSource() { sourceChanged = true; }, interruptPart() { failPart = true; }, uncertainComplete() { failComplete = true; }, uncertainCreate() { failCreate = true; },
    corruptRemote() { remote = Buffer.from(data); remote[remote.length - 1] ^= 1; },
    remote(value: Buffer) { remote = value; },
    failRegistration(where: "before" | "after") { failRegister = where; },
    list(value: typeof listOverride) { listOverride = value; }, expireLease() { token = undefined; },
  };
}

test("private operator import verifies independent remote bytes and idempotently registers native Media", async () => {
  const f = fixture();
  const reserved = await f.importer.beginOriginal("approved-master-1");
  assert.match(reserved.key, /^journal-native\/large-originals\//);
  const done = await f.importer.completeOriginal(reserved.id);
  assert.equal(done.state, "registered");
  assert.equal(done.mediaId, reserved.id);
  await f.importer.resumeOriginal(reserved.id);
  assert.equal(f.registered, 1);
  assert.equal(f.created, 1);
  assert.equal((await f.importer.beginOriginal("approved-master-1")).id, reserved.id);
});

test("interrupted/expired-capability part acknowledgement resumes from remote ListParts, not blind reupload", async () => {
  const f = fixture();
  const r = await f.importer.beginOriginal("interrupt");
  f.interruptPart();
  await assert.rejects(f.importer.resumeOriginal(r.id), /interrupted/);
  assert.equal(f.row.state, "recoverable_error");
  await f.importer.resumeOriginal(r.id);
  assert.deepEqual(f.uploaded, [1]);
  assert.equal(f.created, 1);
});

test("pagination is followed; exact missing, duplicate, out-of-order and wrong-sized remote parts fail closed", async () => {
  const data = Buffer.alloc(PART_BYTES + mp4.length);
  mp4.copy(data);
  const f = fixture(data);
  const r = await f.importer.beginOriginal("pages");
  f.row.uploadId = "known";
  let calls = 0;
  f.list(marker => { calls++; return marker ? { parts: [{ number: 2, bytes: mp4.length, etag: "two" }] } : { parts: [{ number: 1, bytes: PART_BYTES, etag: "one" }], next: "1" }; });
  await f.importer.resumeOriginal(r.id);
  assert.equal(calls, 4);
  assert.deepEqual(f.uploaded, []);
  for (const parts of [
    [{ number: 1, bytes: 2, etag: "bad-size" }],
    [{ number: 1, bytes: mp4.length, etag: "a" }, { number: 1, bytes: mp4.length, etag: "b" }],
    [{ number: 2, bytes: mp4.length, etag: "b" }, { number: 1, bytes: mp4.length, etag: "a" }],
    [{ number: 3, bytes: mp4.length, etag: "invalid-number" }],
  ]) {
    const bad = fixture(); const record = await bad.importer.beginOriginal(randomUUID());
    bad.list(() => ({ parts }));
    await assert.rejects(bad.importer.resumeOriginal(record.id), /Invalid remote multipart/);
    assert.equal(bad.registered, 0);
  }
  const missing = fixture(); const record = await missing.importer.beginOriginal("missing");
  missing.list(() => ({ parts: [] }));
  await assert.rejects(missing.importer.resumeOriginal(record.id), /Missing remote parts/);
});

test("lost completion response reconciles existing object; lost Create response retains orphan diagnosis", async () => {
  const f = fixture(); const r = await f.importer.beginOriginal("completion");
  f.uncertainComplete();
  assert.equal((await f.importer.resumeOriginal(r.id)).state, "registered");
  const uncertain = fixture(); const u = await uncertain.importer.beginOriginal("create");
  uncertain.uncertainCreate();
  await assert.rejects(uncertain.importer.resumeOriginal(u.id));
  await assert.rejects(uncertain.importer.resumeOriginal(u.id), /operator diagnosis/);
  assert.equal(uncertain.created, 1);
  assert.equal(uncertain.row.uploadId, "CREATE_UNCERTAIN");
});

test("registration rollback and lost commit response recover without duplicate Media", async () => {
  for (const where of ["before", "after"] as const) {
    const f = fixture(); const r = await f.importer.beginOriginal(where);
    f.failRegistration(where);
    await assert.rejects(f.importer.resumeOriginal(r.id));
    await f.importer.resumeOriginal(r.id);
    assert.equal(f.registered, 1);
    assert.equal(f.created, 1);
  }
});

test("source changes, remote SHA/size/MIME mismatches and arbitrary key/bucket/actor never register", async () => {
  const changed = fixture(); const r = await changed.importer.beginOriginal("changed"); changed.changeSource();
  await assert.rejects(changed.importer.resumeOriginal(r.id), /Source changed/);
  assert.equal(changed.created, 0);
  const invalidMime = fixture(Buffer.alloc(8192));
  const invalid = await invalidMime.importer.beginOriginal("actual-mime");
  await assert.rejects(invalidMime.importer.resumeOriginal(invalid.id), /verification failed/);
  assert.equal(invalidMime.registered, 0);
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => f.corruptRemote(),
    (f: ReturnType<typeof fixture>) => f.remote(Buffer.alloc(3)),
    (f: ReturnType<typeof fixture>) => { f.row.key = "journal-native/existing/old.mp4"; },
    (f: ReturnType<typeof fixture>) => { f.row.bucket = "arnaudbelec"; },
    (f: ReturnType<typeof fixture>) => { f.row.actor = randomUUID(); },
  ]) {
    const f = fixture(); const record = await f.importer.beginOriginal(randomUUID()); mutate(f);
    await assert.rejects(f.importer.resumeOriginal(record.id));
    assert.equal(f.registered, 0);
  }
});

test("exclusive lease denies competing run and expiry allows recovery", async () => {
  const f = fixture(); const r = await f.importer.beginOriginal("lease");
  await f.journal.lease(r.id, randomUUID());
  await assert.rejects(f.importer.resumeOriginal(r.id), /already leased/);
  f.expireLease();
  assert.equal((await f.importer.resumeOriginal(r.id)).state, "registered");
});

test("CLI defaults local-only/help, requires explicit key/upload/operator enable; cap and credentials fail closed", async () => {
  assert.equal(parseArguments([]).help, true);
  assert.equal(parseArguments(["--file", "/not-read/master.mp4"]).upload, false);
  assert.throws(() => parseArguments(["--file", "a", "--upload"]), /stable --key/);
  assert.throws(() => parseArguments(["--upload", "--dry-run"]), /conflict/);
  assert.throws(() => parseArguments(["--unknown"]));
  await assert.rejects(main(["--file", "/not-read/master.mp4", "--key", "test", "--upload"], {}), /not enabled/);
  const f = fixture();
  validateManifest({ ...f.manifest, bytes: MAX_ORIGINAL_BYTES });
  assert.throws(() => validateManifest({ ...f.manifest, bytes: MAX_ORIGINAL_BYTES + 1 }), /8 GiB/);
  assert.throws(() => validateManifest({ ...f.manifest, bytes: 0 }));
  assert.throws(() => originalR2({ R2_ACCOUNT_ID: "application-not-accepted" }), /Explicit operator/);
  const storage = originalR2({ ARNAUD_ORIGINALS_R2_ACCOUNT_ID: "a".repeat(32), ARNAUD_ORIGINALS_R2_ACCESS_KEY_ID: "synthetic", ARNAUD_ORIGINALS_R2_SECRET_ACCESS_KEY: "synthetic", ARNAUD_ORIGINALS_R2_SESSION_TOKEN: "synthetic-session" });
  // Validation runs before SDK transport; none of these may contact a provider.
  await assert.rejects(storage.head("journal-native/existing-id/master.mp4"), /key denied/);
  await assert.rejects(storage.head("journal-native/large-originals/../master.mp4"), /key denied/);
});
