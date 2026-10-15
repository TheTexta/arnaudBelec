import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("isolated Postgres migration preserves legacy publication and enforces R2 journal/RLS/atomicity", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage; create table storage.objects (bucket_id text, name text);
      grant usage on schema public, storage to anon, authenticated, service_role;
      grant select on storage.objects to service_role;`);
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter(file => file.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(file, directory), "utf8"));
    const id = "12345678-1234-1234-1234-123456789abc";
    const userId = "22345678-1234-1234-1234-123456789abc";
    const metadata = {
      p_photograph_id: id, p_storage_path: `uploads/${id}.jpg`, p_filename: "photo.jpg",
      p_image_width: 100, p_image_height: 80, p_captured_at: null, p_title: "Title", p_alt_text: "Alt", p_sort_order: null,
      p_algorithm: "oklab-kmedoids-chroma-background-v2", p_algorithm_iterations: 10, p_sample_longest_side: 96, p_palette_size: 7,
      p_analyzed_at: "2026-10-14T00:00:00Z", p_background_hex: "#112233",
      p_colours: Array.from({ length: 7 }, (_, i) => ({ rank: i + 1, red: 1, green: 2, blue: 3, hex: "#010203", lab_l: 50, lab_a: 0, lab_b: 0, weight: 1 / 7 })),
    };
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from public.arnaud_upload_reservations"), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_publish_r2_photograph($1, $2::jsonb)", [id, JSON.stringify(metadata)]), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_insert_photograph_metadata($1::jsonb, 'r2')", [JSON.stringify(metadata)]), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await db.query(`insert into public.arnaud_upload_reservations (id,user_id,filename,storage_path,size_bytes,content_type,expires_at)
      values ($1,$2,'photo.jpg',$3,3,'image/jpeg',now()+interval '1 day')`, [id, userId, metadata.p_storage_path]);
    const publish = data => db.query("select public.arnaud_publish_r2_photograph($1,$2::jsonb)", [id, JSON.stringify(data)]);
    await assert.rejects(publish(metadata), /unverified/);
    await db.query("update public.arnaud_upload_reservations set state='verified', sha256=$1, published_etag='etag' where id=$2", ["a".repeat(64), id]);
    await assert.rejects(publish({ ...metadata, p_storage_path: "uploads/wrong.jpg" }), /mismatch/);
    await assert.rejects(publish({ ...metadata, p_colours: metadata.p_colours.slice(0, 6) }), /Invalid/);
    await assert.rejects(publish({ ...metadata, p_colours: metadata.p_colours.map(() => metadata.p_colours[0]) }), /duplicate key/);
    assert.equal((await db.query("select count(*)::integer as n from public.arnaud_photographs")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::integer as n from public.arnaud_photo_palette_analyses")).rows[0].n, 0);
    assert.equal((await db.query("select state from public.arnaud_upload_reservations where id=$1", [id])).rows[0].state, "verified");
    await publish(metadata);
    await publish(metadata); // Lost-response retry is idempotent.
    const photo = (await db.query("select * from public.arnaud_photographs where id=$1", [id])).rows[0];
    assert.equal(photo.storage_provider, "r2");
    assert.equal(photo.background_hex, metadata.p_background_hex);
    assert.equal((await db.query("select count(*)::integer as n from public.arnaud_photo_palette_colours")).rows[0].n, 7);
    assert.equal((await db.query("select state from public.arnaud_upload_reservations where id=$1", [id])).rows[0].state, "published");
    await db.exec("reset role");

    const legacyId = "32345678-1234-1234-1234-123456789abc";
    await db.query("insert into storage.objects values ('arnaudbelec',$1)", [`uploads/${legacyId}.jpg`]);
    await db.exec("set role service_role");
    const legacy = { ...metadata, p_photograph_id: legacyId, p_storage_path: `uploads/${legacyId}.jpg`, p_filename: "legacy.jpg" };
    const values = Object.values(legacy).map(value => Array.isArray(value) ? JSON.stringify(value) : value);
    await db.query(`select public.arnaud_publish_photograph($1::uuid,$2::text,$3::text,$4::integer,$5::integer,$6::date,$7::text,$8::text,$9::integer,$10::text,$11::smallint,$12::smallint,$13::smallint,$14::timestamptz,$15::text,$16::jsonb)`, values);
    assert.equal((await db.query("select storage_provider from public.arnaud_photographs where id=$1", [legacyId])).rows[0].storage_provider, "supabase");
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select count(*)::integer as n from public.arnaud_photographs")).rows[0].n, 2);
  } finally { await db.close(); }
});
