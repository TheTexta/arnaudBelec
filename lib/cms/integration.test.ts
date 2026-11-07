import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createLocalReq, getPayload, handleEndpoints, restoreVersionOperation, ValidationError } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { up } from "../../migrations/20261031_200002_payload_journal";
import { up as historyUp } from "../../migrations/20261031_202034_history_precision";
import { up as nativeUp } from "../../migrations/20261102_200000_native_journal";
import type { Post } from "../../payload-types";

export function textBody(text: string, media: string[] = []): Post["body"] {
  return { root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [
    { type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: [{ type: "text", version: 1, text, format: 0, detail: 0, mode: "normal", style: "" }] },
    ...media.map(id => ({ type: "upload", version: 3, relationTo: "media", value: id, fields: {} })),
  ] } };
}

test("native Payload owns posts, private versions and publication; media authorization follows live references", { timeout: 90000 }, async t => {
  const previousEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1", maxConnections: 5 });
  await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
  await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
  await server.start();
  Object.assign(process.env, {
    ARNAUD_CMS_ENABLED: "true", ARNAUD_CMS_DATABASE_URL: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
    PAYLOAD_SECRET: "isolated-test-secret-not-used-outside-tests", ARNAUD_CMS_ORIGIN: "http://localhost:3105",
    SUPABASE_ADMIN_USER_IDS: "32345678-1234-4234-8234-123456789abc", ARNAUD_BLOG_UPLOADS_ENABLED: "true",
    R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "fixture-only", R2_SECRET_ACCESS_KEY: "fixture-only",
    SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-only",
    DISABLE_PAYLOAD_HMR: "true",
  });
  const { default: config } = await import("../../payload.config");
  const payload = await getPayload({ config });
  (payload.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0].release();
  try {
    await payload.db.drizzle.transaction(async db => {
      await db.execute(sql`set local role arnaud_cms_migrator`);
      await up({ db } as unknown as Parameters<typeof up>[0]);
      await historyUp({ db } as unknown as Parameters<typeof historyUp>[0]);
    });
    await t.test("incompatible migration refuses populated legacy content before any schema change", async () => {
      await pg.query("insert into public.arnaud_blog_posts(id,title,slug,body,updated_by) values ($1,'fixture','fixture','[]',$1)", [process.env.SUPABASE_ADMIN_USER_IDS]);
      await assert.rejects(payload.db.drizzle.transaction(db => nativeUp({ db } as unknown as Parameters<typeof nativeUp>[0])), /complete journal reset/);
      assert.equal((await pg.query<{ n: number }>("select count(*)::int n from arnaud_cms.legacy_revisions")).rows[0].n, 0);
      await pg.exec("delete from public.arnaud_blog_posts");
    });
    await payload.db.drizzle.transaction(async db => {
      await db.execute(sql`set local role arnaud_cms_migrator`);
      await nativeUp({ db } as unknown as Parameters<typeof nativeUp>[0]);
    });
    await payload.db.pool.end();
    payload.db.pool = new payload.db.pg!.Pool({ connectionString: process.env.ARNAUD_CMS_DATABASE_URL, max: 1 });
    await payload.db.connect?.({ hotReload: true });
    await payload.db.drizzle.execute(sql`set role arnaud_cms_runtime`);
    assert.equal((await payload.db.drizzle.execute(sql`select current_user`)).rows[0].current_user, "arnaud_cms_runtime");
    const mapped = await payload.create({ collection: "cms-users", data: { id: process.env.SUPABASE_ADMIN_USER_IDS, email: "fixture@example.test" } });
    const user = { ...mapped, collection: "cms-users" as const, _strategy: "supabase" };
    let post = await payload.create({ collection: "posts", draft: true, data: { title: "Private fixture" }, user, overrideAccess: false });
    assert.equal(post.editRevision, 1);
    assert.equal((await payload.find({ collection: "posts", overrideAccess: false })).totalDocs, 0);
    await assert.rejects(payload.findVersions({ collection: "posts", overrideAccess: false }));
    await assert.rejects(payload.create({ collection: "cms-users", data: { email: "other@example.test" }, overrideAccess: false }));

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYVQAAAAASUVORK5CYII=", "base64");
    const settledConfig = await config;
    const uploadConfig = settledConfig.collections.find(item => item.slug === "media")!.upload;
    assert.ok(uploadConfig && typeof uploadConfig === "object");
    let materializations = 0;
    // Only the R2 read is mocked: actual HTTP signing/receipt validation,
    // pre-transaction materialization, native MIME checks and DB writes run.
    uploadConfig.handlers = [async req => {
      assert.equal(await req.transactionID, undefined, "R2 materialization must precede the database transaction");
      materializations++;
      return new Response(png, { headers: { "Content-Type": "image/png", "Content-Length": String(png.length), ETag: '"fixture-original"' } });
    }];
    globalThis.fetch = async input => {
      assert.match(String(input), /^https:\/\/auth\.example\.test\/auth\/v1\/user$/);
      return Response.json(mapped);
    };
    const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
    const headers = { Authorization: `Bearer ${token}`, Origin: "http://localhost:3105" };
    await t.test("operator-sized fileless REST cannot forge native verification or import provenance", async () => {
      const response = await handleEndpoints({ config, path: "/api/cms/media", request: new Request("http://localhost:3105/api/cms/media", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "forged-master.mp4", mimeType: "video/mp4", filesize: 7834547136, verified: true, sha256: "a".repeat(64), uploadIdentity: "forged-operator-receipt", prefix: "journal-native", _objectKey: "large-originals/forged" }),
      }) });
      assert.equal(response.status, 400);
      assert.equal((await payload.find({ collection: "media", user, overrideAccess: false })).totalDocs, 0);
      assert.equal(materializations, 0);
    });
    const upload = async (filename: string) => {
      const signed = await handleEndpoints({ config, path: "/api/cms/storage-s3-generate-signed-url", request: new Request("http://localhost:3105/api/cms/storage-s3-generate-signed-url", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ collectionSlug: "media", filename, filesize: png.length, mimeType: "image/png" }) }) });
      assert.equal(signed.status, 200);
      const signedData = await signed.json();
      assert.match(signedData.url, /If-None-Match|if-none-match/);
      const form = new FormData();
      form.set("_payload", JSON.stringify({ alt: "A small test image" }));
      form.set("file", JSON.stringify({ collectionSlug: "media", filename: signedData.filename, size: png.length, mimeType: "image/png", clientUploadContext: signedData.clientUploadContext }));
      const response = await handleEndpoints({ config, path: "/api/cms/media", request: new Request("http://localhost:3105/api/cms/media", { method: "POST", headers, body: form }) });
      const result = await response.json();
      assert.equal(response.status, 201, JSON.stringify(result));
      return result.doc as import("../../payload-types").Media;
    };
    const media = await upload("first.png");
    const privateMedia = await upload("second.png");
    assert.equal(materializations, 2);
    globalThis.fetch = async () => assert.fail("Native publication must not perform remote Auth, PostgREST or R2 I/O");
    assert.equal(media.verified, true);
    assert.equal(media.sha256?.length, 64);
    assert.equal((await payload.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
    await t.test("verified media publication succeeds through native rows without storage I/O", async () => {
      post = await payload.update({ collection: "posts", id: post.id, data: { title: "Published A", slug: "native-fixture", body: textBody("Public A", [media.id]), editRevision: post.editRevision, _status: "published", firstPublishedAt: "2000-01-01" }, user, overrideAccess: false });
      assert.equal(post.editRevision, 2);
      assert.notEqual(post.firstPublishedAt?.slice(0, 4), "2000");
      assert.equal((await payload.findByID({ collection: "posts", id: post.id, overrideAccess: false })).title, "Published A");
      assert.equal((await payload.find({ collection: "media", overrideAccess: false })).totalDocs, 1);
      assert.equal((await pg.query<{ n: number }>("select count(*)::int n from public.arnaud_blog_posts")).rows[0].n, 0);
    });
    const firstPublishedAt = post.firstPublishedAt;
    const revision = post.editRevision;
    await t.test("private autosaves preserve the live document and live media, rejecting stale forms", async () => {
      post = await payload.update({ collection: "posts", id: post.id, draft: true, autosave: true, data: { title: "Private B", body: textBody("Secret B", [privateMedia.id]), editRevision: post.editRevision }, user, overrideAccess: false });
      assert.equal(post.editRevision, 3);
      const visible = await payload.findByID({ collection: "posts", id: post.id, draft: true, overrideAccess: false });
      assert.equal(visible.title, "Published A");
      assert.doesNotMatch(JSON.stringify(visible), /Secret B|Private B/);
      assert.equal((await payload.find({ collection: "media", overrideAccess: false })).docs[0].id, media.id);
      await assert.rejects(payload.update({ collection: "posts", id: post.id, draft: true, data: { title: "Stale", editRevision: revision }, user, overrideAccess: false }), /another tab/);
      await assert.rejects(payload.update({ collection: "posts", id: post.id, draft: true, data: { slug: "changed", editRevision: post.editRevision }, user, overrideAccess: false }), ValidationError);
    });
    await t.test("invalid publication and forged media verification cannot change live content", async () => {
      await assert.rejects(payload.update({ collection: "posts", id: post.id, data: { body: textBody("Bad", ["62345678-1234-4234-8234-123456789abc"]), editRevision: post.editRevision, _status: "published" }, user, overrideAccess: false }), ValidationError);
      const changed = await payload.update({ collection: "media", id: media.id, data: { verified: false, sha256: "forged", uploadIdentity: "forged", prefix: "uploads", mimeType: "video/mp4", filesize: 1, width: 999 }, user, overrideAccess: false });
      assert.equal(changed.sha256, media.sha256);
      assert.equal(changed.verified, true);
      assert.equal(changed.prefix, "journal-native");
      assert.equal(changed.mimeType, media.mimeType);
      assert.equal(changed.filesize, media.filesize);
      assert.equal(changed.width, media.width);
      await assert.rejects(payload.delete({ collection: "media", id: media.id, user, overrideAccess: false }));
      await assert.rejects(payload.update({ collection: "media", id: media.id, data: {}, file: { name: "replace.png", data: png, size: png.length, mimetype: "image/png" }, user, overrideAccess: false }), /immutable/);
      const latest = await payload.findByID({ collection: "posts", id: post.id, draft: true, user, overrideAccess: false });
      assert.equal(latest.editRevision, post.editRevision);
    });
    await t.test("private native restoration preserves published status, URL and references", async () => {
      const versions = await payload.findVersions({ collection: "posts", where: { parent: { equals: post.id } }, sort: "createdAt", user, overrideAccess: false });
      await assert.rejects(payload.restoreVersion({ collection: "posts", id: versions.docs[0].id, user, overrideAccess: false }), /private draft/);
      const req = await createLocalReq({ user }, payload);
      post = await restoreVersionOperation({ collection: payload.collections.posts, id: versions.docs[0].id, draft: true, overrideAccess: false, req });
      assert.equal(post._status, "draft");
      assert.equal(post.slug, "native-fixture");
      assert.equal(post.firstPublishedAt, firstPublishedAt);
      assert.equal((await payload.findByID({ collection: "posts", id: post.id, overrideAccess: false }))._status, "published");
      assert.equal((await payload.find({ collection: "media", overrideAccess: false })).docs[0].id, media.id);
    });
    await t.test("native status-only unpublish withdraws content/media without deleting originals", async () => {
      const contentRevision = post.editRevision;
      post = await payload.update({ collection: "posts", id: post.id, unpublishAllLocales: true, data: { _status: "draft" }, user, overrideAccess: false });
      assert.equal(post.editRevision, contentRevision, "Status-only native actions do not invalidate the saved form content token");
      assert.equal((await payload.find({ collection: "posts", overrideAccess: false })).totalDocs, 0);
      assert.equal((await payload.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
      assert.equal((await payload.find({ collection: "media", user, overrideAccess: false })).totalDocs, 2);
      post = await payload.update({ collection: "posts", id: post.id, data: { title: "Published again", body: textBody("Again", [media.id]), editRevision: post.editRevision, _status: "published" }, user, overrideAccess: false });
      assert.equal(post.firstPublishedAt, firstPublishedAt);
    });
    await t.test("shared media remains public while referenced by another published post", async () => {
      const other = await payload.create({ collection: "posts", data: { title: "Other", slug: "other", body: textBody("Other", [media.id]), editRevision: 0, _status: "published" }, user, overrideAccess: false });
      await payload.update({ collection: "posts", id: post.id, unpublishAllLocales: true, data: { _status: "draft" }, user, overrideAccess: false });
      assert.equal((await payload.find({ collection: "media", overrideAccess: false })).totalDocs, 1);
      await payload.update({ collection: "posts", id: other.id, unpublishAllLocales: true, data: { _status: "draft" }, user, overrideAccess: false });
      assert.equal((await payload.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await payload.destroy();
    await payload.db.pool.end();
    await server.stop();
    await pg.close();
    process.env = previousEnv;
  }
});
