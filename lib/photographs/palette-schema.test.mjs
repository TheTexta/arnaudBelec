import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { MMCQ_VIBRANT_ALGORITHM } from "../palette/config.mjs";
import { rgbToLab, rgbToHex } from "../palette/oklab-k-medoids.mjs";
import sharp from "sharp";
import { preparePaletteRun, transitionPaletteRun, sha256 } from "../palette/backfill.mjs";

test("MMCQ migration accepts actual counts and metadata in both providers, preserves legacy writes and rejects invalid palettes atomically", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage; create table storage.objects (bucket_id text, name text);
      grant usage on schema public, storage to anon, authenticated, service_role;
      grant select on storage.objects to service_role;`);
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter(file => file.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(file, directory), "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select public.arnaud_validate_photo_palette(null,null,null,null,null,null)"), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_palette_snapshot()"), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_apply_palette_snapshot(null,null,true)"), /permission denied/);
      await db.exec("reset role");
    }
    const colours = count => Array.from({ length: count }, (_, i) => {
      const rgb = [i * 30 + 1, 2, 3];
      const [lab_l, lab_a, lab_b] = rgbToLab(rgb);
      return { rank: i + 1, red: rgb[0], green: rgb[1], blue: rgb[2], hex: rgbToHex(rgb), lab_l, lab_a, lab_b, weight: Number((1 / count).toFixed(6)) };
    });
    const id = "12345678-1234-1234-1234-123456789abc";
    const metadata = { p_photograph_id: id, p_storage_path: `uploads/${id}.jpg`, p_filename: "new.jpg", p_image_width: 100, p_image_height: 80,
      p_captured_at: null, p_title: "Title", p_alt_text: "Alt", p_sort_order: null, p_algorithm: MMCQ_VIBRANT_ALGORITHM,
      p_algorithm_iterations: 2, p_sample_longest_side: 256, p_palette_size: 1, p_analyzed_at: "2026-11-05T00:00:00Z", p_background_hex: "#112233", p_colours: colours(1) };
    await db.query("insert into storage.objects values ('arnaudbelec',$1)", [metadata.p_storage_path]);
    await db.exec("set role service_role");
    await db.query("select public.arnaud_insert_photograph_metadata($1::jsonb,'supabase')", [JSON.stringify(metadata)]);
    const before = (await db.query("select to_jsonb(p) as row from public.arnaud_photographs p where id=$1", [id])).rows[0].row;
    const replace = (count, overrides = {}) => {
      const m = { ...metadata, p_palette_size: count, p_colours: colours(count), ...overrides };
      return db.query("select public.arnaud_replace_photo_palette($1::uuid,$2::text,$3::smallint,$4::smallint,$5::smallint,$6::timestamptz,$7::text,$8::jsonb)",
        [id, m.p_algorithm, m.p_algorithm_iterations, m.p_sample_longest_side, m.p_palette_size, m.p_analyzed_at, m.p_background_hex, JSON.stringify(m.p_colours)]);
    };
    for (const count of [1, 2, 3, 4, 5, 6, 7]) {
      await replace(count);
      const result = (await db.query("select algorithm, algorithm_iterations, sample_longest_side, palette_size from public.arnaud_photo_palette_analyses where photograph_id=$1", [id])).rows[0];
      assert.deepEqual(result, { algorithm: MMCQ_VIBRANT_ALGORITHM, algorithm_iterations: 2, sample_longest_side: 256, palette_size: count });
      assert.equal((await db.query("select count(*)::integer as n from public.arnaud_photo_palette_colours where photograph_id=$1", [id])).rows[0].n, count);
    }
    assert.deepEqual((await db.query("select to_jsonb(p) as row from public.arnaud_photographs p where id=$1", [id])).rows[0].row, before);
    for (const overrides of [
      { p_palette_size: 0, p_colours: [] }, { p_palette_size: 8, p_colours: colours(8) }, { p_colours: colours(6) },
      { p_algorithm: "unknown" }, { p_algorithm_iterations: 10 }, { p_sample_longest_side: 128 },
      { p_colours: colours(7).map(c => ({ ...c, rank: 1 })) },
      { p_colours: colours(7).map((c, i) => ({ ...c, rank: i + 2 })) },
      { p_colours: colours(7).map(c => ({ ...c, weight: 1 })) },
      { p_colours: colours(7).map(c => ({ ...c, hex: "#ffffff" })) },
      { p_colours: colours(7).map(c => ({ ...c, lab_l: "NaN" })) },
      { p_colours: colours(7).map((c, i) => ({ ...c, ...(i === 0 ? { weight: 0 } : {}) })) },
    ]) await assert.rejects(replace(7, overrides), /Invalid/);
    assert.equal((await db.query("select count(*)::integer as n from public.arnaud_photo_palette_colours where photograph_id=$1", [id])).rows[0].n, 7);
    await replace(1, { p_sample_longest_side: 96 });
    const r2Id = "22345678-1234-1234-1234-123456789abc";
    const r2 = { ...metadata, p_photograph_id: r2Id, p_storage_path: `uploads/${r2Id}.jpg`, p_filename: "r2.jpg", p_palette_size: 2, p_colours: colours(2) };
    await db.query(`insert into public.arnaud_upload_reservations (id,user_id,filename,storage_path,size_bytes,content_type,expires_at,state,sha256,published_etag)
      values ($1,$1,'r2.jpg',$2,3,'image/jpeg',now()+interval '1 day','verified',$3,'etag')`, [r2Id, r2.p_storage_path, "a".repeat(64)]);
    await db.query("select public.arnaud_publish_r2_photograph($1,$2::jsonb)", [r2Id, JSON.stringify(r2)]);
    await db.query("select public.arnaud_publish_r2_photograph($1,$2::jsonb)", [r2Id, JSON.stringify(r2)]);
    assert.equal((await db.query("select palette_size from public.arnaud_photo_palette_analyses where photograph_id=$1", [r2Id])).rows[0].palette_size, 2);

    const snapshot = async () => (await db.query("select public.arnaud_palette_snapshot() as snapshot")).rows[0].snapshot;
    const transition = async (expected, desired, verify = false) => (await db.query(
      "select public.arnaud_apply_palette_snapshot($1::jsonb,$2::jsonb,$3::boolean) as result",
      [JSON.stringify(expected), JSON.stringify(desired), verify],
    )).rows[0].result;
    const frozen = await snapshot();
    const desired = structuredClone(frozen);
    const [lab_l, lab_a, lab_b] = rgbToLab([255, 2, 3]);
    Object.assign(desired.colours[0], { red: 255, hex: "#ff0203", lab_l, lab_a, lab_b });
    desired.analyses[0].analyzed_at = "2026-11-05T12:34:56.500Z";
    assert.equal(await transition(frozen, desired, true), "before");
    assert.deepEqual(await snapshot(), frozen, "verification cannot write rows");
    assert.equal(await transition(frozen, desired), "applied");
    const applied = await snapshot();
    assert.deepEqual(applied.photographs, frozen.photographs, "photo rows/timestamps/backgrounds must stay exact");
    assert.equal(await transition(frozen, desired, true), "after");
    assert.equal(await transition(frozen, desired), "already_applied");
    assert.equal(await transition(desired, frozen), "applied");
    assert.deepEqual(await snapshot(), frozen, "rollback restores exact palette rows and timestamps");
    assert.equal(await transition(desired, frozen), "already_applied");
    // Exercise the real production analyser/operator mapping against real SQL,
    // not only independently mocked JS and handcrafted SQL payloads.
    const image = await sharp({ create: { width: 100, height: 80, channels: 3, background: "#b02040" } }).png().toBuffer();
    const read = async p => ({ bytes: image, provider: p.storage_provider, path: p.storage_path, etag: "synthetic-etag", size: image.length, sha256: sha256(image) });
    const pinnedRuntime = { node: "isolated-test", files: {}, sharp: {} };
    const run = await preparePaletteRun(frozen, read, "https://supabase.example.test", pinnedRuntime);
    const service = { rpc: async (name, args) => {
      assert.equal(name, "arnaud_apply_palette_snapshot");
      return { data: await transition(args.p_expected, args.p_desired, args.p_verify), error: null };
    } };
    assert.equal(await transitionPaletteRun(service, run, "apply", read, pinnedRuntime), "applied");
    assert.equal(await transitionPaletteRun(service, run, "verify", read, pinnedRuntime), "after");
    assert.deepEqual((await snapshot()).photographs, frozen.photographs);
    assert.equal(await transitionPaletteRun(service, run, "rollback", read, pinnedRuntime), "applied");
    assert.deepEqual(await snapshot(), frozen);
    const forged = structuredClone(desired);
    forged.photographs[0].title = "not palette-only";
    await assert.rejects(transition(frozen, forged), /cannot change photographs/);
    assert.deepEqual(await snapshot(), frozen);

    // A failure AFTER deletes/analysis insertion must roll back both tables.
    await db.exec("reset role; alter table public.arnaud_photo_palette_colours add constraint test_insert_failure check (red <> 255); set role service_role");
    const constrained = await snapshot();
    const failing = { ...desired, schema: constrained.schema };
    await assert.rejects(transition(constrained, failing), /test_insert_failure/);
    assert.deepEqual(await snapshot(), constrained);
    assert.equal(await transition(frozen, desired, true), "stale", "same rows with schema drift must fail closed");

    await db.query("update public.arnaud_photographs set title='later text' where id=$1", [id]);
    const edited = await snapshot();
    assert.equal(await transition(constrained, { ...desired, schema: constrained.schema }, true), "stale");
    await assert.rejects(transition(constrained, { ...desired, schema: constrained.schema }), /Stale/);
    assert.deepEqual(await snapshot(), edited, "stale-state refusal cannot overwrite later work");
    await db.exec("begin isolation level repeatable read");
    await assert.rejects(transition(edited, edited), /READ COMMITTED/);
    await db.exec("rollback");
    await db.exec("reset role; create table public.test_palette_reference (id uuid references public.arnaud_photo_palette_analyses(photograph_id) on delete cascade); set role service_role");
    await assert.rejects(snapshot(), /Unsupported/);
  } finally { await db.close(); }
});
