import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { parseBackfillArgs, preparePaletteRun, validatePreparedRun, transitionPaletteRun, paletteReviewHtml, sha256, analyserRuntime } from "./backfill.mjs";
import { originalReader } from "./backfill-storage.mjs";
import { rgbToLab } from "./oklab-k-medoids.mjs";

const id = "12345678-1234-1234-1234-123456789abc";
const runtime = { node: "test", files: {}, sharp: {} };
const origin = "https://supabase.example.test";
const photo = { id, filename: '<img src=x onerror="alert(1)">.jpg', storage_path: `uploads/${id}.jpg`, storage_provider: "r2", background_hex: "#080808", title: "Untouched", updated_at: "2026-11-01T01:23:45.123456Z" };
function snapshot() {
  const [lab_l, lab_a, lab_b] = rgbToLab([80, 80, 80]);
  return { schema: "a".repeat(32), photographs: [structuredClone(photo)],
    analyses: [{ photograph_id: id, algorithm: "oklab-kmedoids-chroma-background-v2", algorithm_iterations: 10, sample_longest_side: 96, palette_size: 7, analyzed_at: "2026-11-01T00:00:00Z" }],
    colours: Array.from({ length: 7 }, (_, i) => ({ photograph_id: id, rank: i + 1, red: 80, green: 80, blue: 80, hex: "#505050", lab_l, lab_a, lab_b, weight: i === 0 ? 1 : 0 })) };
}
async function fixture() {
  const bytes = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#b02040" } }).png().toBuffer();
  const read = async p => ({ bytes, path: p.storage_path, provider: p.storage_provider, etag: "etag", size: bytes.length, sha256: sha256(bytes) });
  return { run: await preparePaletteRun(snapshot(), read, origin, runtime), read };
}

test("default/help and invalid apply never load environment, network or write production", () => {
  assert.deepEqual(parseBackfillArgs([]), { command: "help" });
  for (const args of [["--dry-run"], ["apply", "--run=test"], ["apply", "--run=test", `--sha256=${"a".repeat(64)}`],
    ["prepare", "--run=test", "--confirm=arnaudbelec"], ["prepare", "--run=x", "--run=y"]]) assert.throws(() => parseBackfillArgs(args));
  const result = spawnSync(process.execPath, ["scripts/reanalyse-photographs.mjs"], { cwd: new URL("../..", import.meta.url),
    encoding: "utf8", env: { ...process.env, SUPABASE_URL: "not-a-url", SUPABASE_SERVICE_ROLE_KEY: "never-load-this" } });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Default: help only/);
  const invalid = spawnSync(process.execPath, ["scripts/reanalyse-photographs.mjs", "apply", "--run=missing"], { cwd: new URL("../..", import.meta.url), encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /sha256/);
});

test("preparation uses the production analyser, preserves every photo field and creates an escaped offline comparison", async () => {
  const { run } = await fixture();
  assert.deepEqual(run.before.photographs, run.after.photographs);
  assert.equal(run.after.analyses[0].palette_size, 1);
  assert.equal(run.after.colours.length, 1);
  assert.equal(run.after.colours[0].weight, 1);
  assert.equal(run.after.colours[0].photograph_id, id);
  validatePreparedRun(run);
  const html = paletteReviewHtml(run);
  assert.ok(html.includes("data:image/jpeg;base64,"));
  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(html.includes("&lt;img"));
});

test("invalid, incomplete and forged runs or unreadable original bytes cannot be applied", async () => {
  const { run, read } = await fixture();
  for (const mutate of [r => { r.after.photographs[0].title = "changed"; }, r => { r.originals = []; },
    r => { r.after.colours[0].lab_l = 0.5; }, r => { r.after.colours[0].rank = 2; }, r => { r.originals[0].sha256 = "bad"; }]) {
    const bad = structuredClone(run); mutate(bad); assert.throws(() => validatePreparedRun(bad));
  }
  await assert.rejects(preparePaletteRun(snapshot(), async p => ({ ...await read(p), sha256: "0".repeat(64) }), origin, runtime), /checksum/);
  const noBackground = snapshot(); noBackground.photographs[0].background_hex = null;
  await assert.rejects(preparePaletteRun(noBackground, read, origin, runtime), /metadata/);
});

test("read-only verification and already-applied replays do not fetch originals or write", async () => {
  const { run } = await fixture();
  const calls = [];
  const service = { rpc: async (_name, args) => { calls.push(args); return { data: "after", error: null }; } };
  const noRead = () => { throw new Error("Unexpected original read"); };
  assert.equal(await transitionPaletteRun(service, run, "verify", noRead, runtime), "after");
  assert.equal(await transitionPaletteRun(service, run, "apply", noRead, runtime), "already_applied");
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.p_verify));
});

test("apply freshly verifies original hashes/runtime; rollback reverses frozen snapshots, never photo rows", async () => {
  const { run, read } = await fixture();
  const calls = [];
  const service = { rpc: async (_name, args) => { calls.push(args); return { data: args.p_verify ? "before" : "applied", error: null }; } };
  assert.equal(await transitionPaletteRun(service, run, "apply", read, runtime), "applied");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].p_expected, run.before);
  assert.equal(calls[1].p_desired, run.after);
  calls.length = 0;
  assert.equal(await transitionPaletteRun(service, run, "rollback", read, runtime), "applied");
  assert.equal(calls[1].p_expected, run.after);
  assert.equal(calls[1].p_desired, run.before);
  calls.length = 0;
  await assert.rejects(transitionPaletteRun(service, run, "apply", read, {}), /runtime changed/);
  assert.equal(calls.length, 1);
  await assert.rejects(transitionPaletteRun(service, run, "apply", async p => ({ ...await read(p), etag: "changed" }), runtime), /original changed/);
  assert.equal(calls.length, 2, "failed verification must not call the write RPC");
});

test("stale data and ambiguous RPC failures stop without an automatic retry", async () => {
  const { run, read } = await fixture();
  await assert.rejects(transitionPaletteRun({ rpc: async () => ({ data: "stale", error: null }) }, run, "apply", read, runtime), /Stale/);
  let calls = 0;
  await assert.rejects(transitionPaletteRun({ rpc: async () => { calls++; return { data: null, error: { secret: "never print" } }; } }, run, "apply", read, runtime), /uncertain/);
  assert.equal(calls, 1);
  const actualRuntime = await analyserRuntime();
  assert.ok(Object.keys(actualRuntime.files).length >= 8);
});

test("original reader conditionally reads published R2, bounds bytes and rejects observed source drift", async () => {
  const bytes = Buffer.from("original");
  const head = { ETag: "etag", ContentLength: bytes.length };
  const storage = { head: async () => head, read: async (path, staging, etag) => {
    assert.equal(path, photo.storage_path); assert.equal(staging, false); assert.equal(etag, "etag");
    return [bytes];
  } };
  const read = originalReader({}, origin, "test-only", () => storage);
  assert.equal((await read(photo)).sha256, sha256(bytes));
  let calls = 0;
  const drift = originalReader({}, origin, "test-only", () => ({ ...storage, head: async () => ({ ...head, ETag: ++calls === 1 ? "etag" : "changed" }) }));
  await assert.rejects(drift(photo), /changed during/);
  await assert.rejects(originalReader({}, origin, "test-only", () => ({ ...storage, read: async () => [Buffer.alloc(bytes.length + 1)] }))(photo), /size limit/);
});

test("legacy provider reads the credentialed ORIGINAL endpoint only, with bounded bytes and no redirects", async () => {
  const originalFetch = globalThis.fetch;
  const bytes = Buffer.from("legacy-original");
  const service = { storage: { from: bucket => {
    assert.equal(bucket, "arnaudbelec");
    return { info: async path => { assert.equal(path, photo.storage_path); return { data: { size: bytes.length }, error: null }; } };
  } } };
  const read = originalReader(service, origin, "synthetic-only");
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, `${origin}/storage/v1/object/arnaudbelec/${photo.storage_path}`);
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.apikey, "synthetic-only");
      assert.equal(options.headers.Authorization, "Bearer synthetic-only");
      return new Response(bytes, { headers: { etag: "legacy-etag" } });
    };
    const result = await read({ ...photo, storage_provider: "supabase" });
    assert.equal(result.provider, "supabase");
    assert.equal(result.sha256, sha256(bytes));
    assert.equal(result.etag, "legacy-etag");
    globalThis.fetch = async () => new Response(bytes.subarray(1));
    await assert.rejects(read({ ...photo, storage_provider: "supabase" }), /byte count/);
  } finally { globalThis.fetch = originalFetch; }
});
