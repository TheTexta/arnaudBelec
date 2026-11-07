import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { cleanMedia, digest, planReset, resetJournal, type Storage, type ObjectIdentity, type Multipart } from "./reset";

const post = "12345678-1234-4234-8234-123456789abc";
const asset = "22345678-1234-4234-8234-123456789abc";
const orphan = "32345678-1234-4234-8234-123456789abc";
const object: ObjectIdentity = { bucket: "arnaudbelec-staging", key: `blog/${asset}.jpg`, size: 3, etag: '"etag"', sha256: "a".repeat(64) };
function mockStorage() {
  let objects = [{ ...object }];
  let multipart: Multipart[] = [{ bucket: object.bucket, key: object.key, uploadId: "upload-1" }];
  const deleted: string[] = [];
  const storage: Storage = {
    async inventory() { return { objects: objects.map(o => ({ ...o })), multipart: multipart.map(u => ({ ...u })) }; },
    async identify(o) { return objects.find(v => v.bucket === o.bucket && v.key === o.key) ?? null; },
    async remove(o) { deleted.push(o.key); objects = objects.filter(v => v.key !== o.key); },
    async abort(u) { deleted.push(u.uploadId); multipart = multipart.filter(v => v.uploadId !== u.uploadId); },
  };
  return { storage, deleted, change() { objects[0].etag = "changed"; } };
}
async function fixture() {
  const db = await PGlite.create();
  await db.exec("create role anon; create role authenticated; create role service_role; create schema arnaud_cms;");
  await db.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
  const native = await readFile(new URL("../../migrations/20261031_200002_payload_journal.ts", import.meta.url), "utf8");
  await db.exec(native.split("await db.execute(sql`")[1].split("`)")[0]);
  await db.exec(`create table public.photograph_sentinel(id int); insert into public.photograph_sentinel values(1);
    insert into arnaud_cms.cms_users(id,email) values('${post}','sentinel@example.test');
    insert into arnaud_cms.posts(id,body) values('${post}','{"private":"never report this"}');
    insert into arnaud_cms._posts_v(parent_id,version_body) values('${post}','{"history":"secret"}'),(null,'{"orphan":"secret"}');
    insert into arnaud_cms.legacy_revisions(id,source_key,post_id,revision,snapshot,saved_by,saved_at)
      values('${orphan}','orphan','missing-text-post',1,'{"private":"orphan"}','owner',now());
    insert into arnaud_cms.payload_locked_documents(id) values('${post}');
    insert into arnaud_cms.payload_locked_documents_rels(parent_id,path,posts_id) values('${post}','posts','${post}');
    insert into arnaud_cms.payload_locked_documents_rels(parent_id,path,cms_users_id) values('${post}','users','${post}');`);
  await db.query("select public.arnaud_save_blog_post($1,0,$2::jsonb,$1)", [post, JSON.stringify({ title: "Private title", slug: "private-slug", excerpt: "", body: [] })]);
  await db.query("select public.arnaud_save_blog_post($1,1,$2::jsonb,$1)", [post, JSON.stringify({ title: "Private revised title", slug: "private-slug", excerpt: "", body: [] })]);
  await db.query("insert into public.arnaud_blog_media(id,post_id,storage_path,filename,content_type,size_bytes,multipart_id,sha256) values($1,$2,$3,'private.jpg','image/jpeg',3,'upload-1',$4)", [asset, post, object.key, object.sha256]);
  await db.query("select public.arnaud_publish_blog_post($1,2,'{}'::uuid[])", [post]);
  await db.query("insert into public.arnaud_blog_publication_media(post_id,media_id) values($1,$2)", [post, asset]);
  return db;
}
test("reset binds full histories, rejects stale plans atomically and preserves unrelated records", async () => {
  const db = await fixture();
  try {
    const { storage, deleted } = mockStorage();
    const manifest = await planReset(db, storage, "isolated");
    assert.equal(manifest.rows["arnaud_cms._posts_v"].length, 2);
    assert.equal(manifest.rows["arnaud_cms.legacy_revisions"].length, 1);
    assert.doesNotMatch(JSON.stringify(manifest), /never report|Private title|orphan.*secret/);
    assert.equal((await db.query("select * from arnaud_cms.posts")).rows.length, 1);
    const events: Record<string, unknown>[] = [];
    const journal = async (e: Record<string, unknown>) => { events.push(e); };
    await assert.rejects(resetJournal(db, manifest, "wrong", "isolated", journal), /confirmation/);
    await db.exec("update arnaud_cms._posts_v set version_title='changed'");
    await assert.rejects(resetJournal(db, manifest, manifest.digest, "isolated", journal), /changed/);
    assert.equal((await db.query("select * from public.arnaud_blog_revisions")).rows.length, 2);
    const fresh = await planReset(db, storage, "isolated");
    await resetJournal(db, fresh, fresh.digest, "isolated", journal);
    for (const table of Object.keys(fresh.rows).filter(t => !t.endsWith("_rels"))) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
    assert.equal((await db.query("select * from public.photograph_sentinel")).rows.length, 1);
    assert.equal((await db.query("select * from arnaud_cms.cms_users")).rows.length, 1);
    assert.equal((await db.query("select * from arnaud_cms.payload_locked_documents_rels")).rows.length, 1);
    assert.ok(events.some(e => e.phase === "reset-committed"));
    await assert.rejects(cleanMedia(db, storage, fresh, fresh.digest, false, journal), /receipt/);
    await cleanMedia(db, storage, fresh, fresh.digest, true, journal);
    await cleanMedia(db, storage, fresh, fresh.digest, true, journal);
    assert.deepEqual(deleted, ["upload-1", object.key]);
  } finally { await db.close(); }
});
test("storage cleanup rejects live targets, changed identities and non-journal namespaces", async () => {
  const db = await fixture();
  try {
    const mock = mockStorage();
    const manifest = await planReset(db, mock.storage, "isolated");
    const journal = async () => {};
    await assert.rejects(cleanMedia(db, mock.storage, manifest, manifest.digest, true, journal), /still exist/);
    await resetJournal(db, manifest, manifest.digest, "isolated", journal);
    mock.change();
    await assert.rejects(cleanMedia(db, mock.storage, manifest, manifest.digest, true, journal), /changed/);
    assert.equal(mock.deleted.length, 0);
    const tampered = { ...manifest, objects: [{ ...object, key: "uploads/private.jpg" }] };
    tampered.digest = digest({ version: tampered.version, target: tampered.target, rows: tampered.rows, media: tampered.media, objects: tampered.objects, multipart: tampered.multipart });
    await assert.rejects(cleanMedia(db, mock.storage, tampered, tampered.digest, true, journal), /namespace/);
  } finally { await db.close(); }
});
test("retirement requires native migration and empty legacy content, preserving native and unrelated objects", async () => {
  const db = await fixture();
  const sql = await readFile(new URL("../../deploy/cms/migrations/20261102201000_retire_arnaud_blog.sql", import.meta.url), "utf8");
  try {
    await assert.rejects(db.exec(sql), /Native journal/);
    await db.exec("rollback; create table arnaud_cms.media(id int); alter table arnaud_cms.posts add column edit_revision integer;");
    await assert.rejects(db.exec(sql), /not empty/);
    await db.exec("rollback");
    const { storage } = mockStorage();
    const manifest = await planReset(db, storage, "isolated");
    await resetJournal(db, manifest, manifest.digest, "isolated", async () => {});
    await db.exec(sql);
    assert.equal((await db.query<{ name: string | null }>("select to_regclass('public.arnaud_blog_posts') as name")).rows[0].name, null);
    assert.equal((await db.query("select * from arnaud_cms.cms_users")).rows.length, 1);
    assert.equal((await db.query("select * from public.photograph_sentinel")).rows.length, 1);
    assert.equal((await db.query<{ name: string | null }>("select to_regclass('arnaud_cms.media') as name")).rows[0].name, "arnaud_cms.media");
  } finally { await db.close(); }
});
