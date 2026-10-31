import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("isolated Postgres enforces private drafts/revisions, optimistic saves, atomic publication and media withdrawal", async () => {
  const db = new PGlite();
  const postId = "12345678-1234-1234-1234-123456789abc";
  const mediaId = "22345678-1234-1234-1234-123456789abc";
  const userId = "32345678-1234-1234-1234-123456789abc";
  const body = [{ id: "image", type: "image", props: { url: `/blog/media/${mediaId}`, caption: "A photograph" }, children: [] }];
  const document = { title: "Published title", slug: "first-post", excerpt: "", body };
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;");
    await db.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const table of ["arnaud_blog_posts", "arnaud_blog_revisions"]) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_save_blog_post($1,0,$2::jsonb,$3)", [postId, JSON.stringify(document), userId]), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_publish_blog_post($1,1,$2::uuid[])", [postId, [mediaId]]), /permission denied/);
      await assert.rejects(db.query("select public.arnaud_unpublish_blog_post($1,1)", [postId]), /permission denied/);
      await assert.rejects(db.query("select filename from public.arnaud_blog_media"), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    const saveOnce = (version: number, data = document) => db.query("select public.arnaud_save_blog_post($1,$2,$3::jsonb,$4)", [postId, version, JSON.stringify(data), userId]);
    await saveOnce(0);
    await db.query("insert into public.arnaud_blog_media (id,post_id,storage_path,filename,content_type,size_bytes) values ($1,$2,$3,'private.jpg','image/jpeg',3)", [mediaId, postId, `blog/${mediaId}.jpg`]);
    const publish = (version: number, ids = [mediaId]) => db.query("select public.arnaud_publish_blog_post($1,$2,$3::uuid[])", [postId, version, ids]);
    await assert.rejects(publish(1), /not verified/);
    await assert.rejects(publish(1, []), /references do not match/);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from public.arnaud_blog_publications")).rows.length, 0);
    assert.equal((await db.query("select id,storage_path from public.arnaud_blog_media")).rows.length, 0);
    await db.exec("reset role; set role service_role");
    await db.query("update public.arnaud_blog_media set state='published',sha256=$1,source_etag='source',published_etag='destination' where id=$2", ["a".repeat(64), mediaId]);
    await publish(1);
    await publish(1); // Lost response retry keeps the same public snapshot.
    await saveOnce(1, { ...document, title: "Private new title" });
    await assert.rejects(saveOnce(1, { ...document, title: "Stale overwrite" }), /blog_conflict/);
    await assert.rejects(saveOnce(2, { ...document, slug: "broken-link" }), /URLs cannot/);
    assert.equal((await db.query("select * from public.arnaud_blog_revisions")).rows.length, 2);
    await assert.rejects(publish(1), /blog_conflict/);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query<{ title: string }>("select title from public.arnaud_blog_publications")).rows[0].title, "Published title");
    assert.equal((await db.query("select id,storage_path from public.arnaud_blog_media")).rows.length, 1);
    await db.exec("reset role; set role service_role");
    await db.query("select public.arnaud_unpublish_blog_post($1,2)", [postId]);
    assert.equal((await db.query("select * from public.arnaud_blog_media")).rows.length, 1);
    assert.equal((await db.query("select * from public.arnaud_blog_revisions")).rows.length, 2);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from public.arnaud_blog_publications")).rows.length, 0);
    assert.equal((await db.query("select id,storage_path from public.arnaud_blog_media")).rows.length, 0);
  } finally { await db.close(); }
});
