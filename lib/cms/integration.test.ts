import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { getPayload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { up } from "../../migrations/20261031_200002_payload_journal";
import { up as historyUp } from "../../migrations/20261031_202034_history_precision";
import { importLegacy } from "./import";

test("Payload and the legacy registry commit together; drafts, history and publication stay private", { timeout: 60000 }, async t => {
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1", maxConnections: 5 });
  await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
  await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
  await server.start();
  process.env.ARNAUD_CMS_DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
  process.env.PAYLOAD_SECRET = "isolated-test-secret-not-used-outside-tests";
  process.env.ARNAUD_CMS_ORIGIN = "http://localhost:3105";
  process.env.SUPABASE_ADMIN_USER_IDS = "32345678-1234-4234-8234-123456789abc";
  const { default: config } = await import("../../payload.config");
  const payload = await getPayload({ config });
  // Payload 3.92.1 reserves an unused startup client (connect.ts). Release that
  // test-only lease so pg.Pool.end can drain this ephemeral socket server.
  const startup = (payload.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0];
  startup.release();
  try {
    await payload.db.drizzle.transaction(async db => {
      await db.execute(sql`set local role arnaud_cms_migrator`);
      await up({ db } as unknown as Parameters<typeof up>[0]);
      await historyUp({ db } as unknown as Parameters<typeof historyUp>[0]);
    });
    await payload.db.pool.end();
    payload.db.pool = new payload.db.pg!.Pool({ connectionString: process.env.ARNAUD_CMS_DATABASE_URL, options: "-c role=arnaud_cms_runtime", max: 3 });
    await payload.db.connect?.({ hotReload: true });
    // PGlite's socket transport ignores startup `options`; exercise the real
    // restricted role with SET ROLE rather than silently testing as postgres.
    await payload.db.drizzle.execute(sql`set role arnaud_cms_runtime`);
    assert.equal((await payload.db.drizzle.execute(sql`select current_user`)).rows[0].current_user, "arnaud_cms_runtime");
    const seedId = "42345678-1234-4234-8234-123456789abc";
    const seed = { title: "Imported recovery fixture", slug: "imported-fixture", excerpt: "", body: [{ id: "seed", type: "paragraph", props: {}, content: [{ type: "text", text: "Original public text", styles: {} }], children: [] }] };
    await pg.query("select public.arnaud_save_blog_post($1,0,$2::jsonb,$3)", [seedId, JSON.stringify(seed), process.env.SUPABASE_ADMIN_USER_IDS]);
    await pg.query("select public.arnaud_publish_blog_post($1,1,'{}'::uuid[])", [seedId]);
    await pg.query("select public.arnaud_save_blog_post($1,1,$2::jsonb,$3)", [seedId, JSON.stringify({ ...seed, title: "Imported private changes" }), process.env.SUPABASE_ADMIN_USER_IDS]);
    await pg.query("update public.arnaud_blog_revisions set saved_at='2026-10-30 10:11:12.123456+00' where post_id=$1 and version=1", [seedId]);
    const report = await importLegacy(payload);
    assert.equal(report.applied, false);
    assert.equal((await payload.count({ collection: "posts" })).totalDocs, 0);
    await importLegacy(payload, true);
    const imported = await payload.findByID({ collection: "posts", id: seedId, draft: true });
    assert.equal(imported.title, "Imported private changes");
    const history = await payload.find({ collection: "legacy-revisions", sort: "revision" });
    assert.equal(history.docs.length, 2);
    assert.match(history.docs[0].sourceTimestamp, /123456/);
    assert.equal(history.docs[0].savedBy, process.env.SUPABASE_ADMIN_USER_IDS);
    assert.equal((await importLegacy(payload)).sourceSha256, report.sourceSha256);
    await assert.rejects(importLegacy(payload, true), /not empty/);
    const mapped = await payload.create({ collection: "cms-users", data: { id: process.env.SUPABASE_ADMIN_USER_IDS, email: "fixture@example.test" } });
    assert.equal((await payload.find({ collection: "cms-users", where: { id: { equals: mapped.id } }, overrideAccess: true })).docs.length, 1);
    const user = { ...mapped, collection: "cms-users" as const, _strategy: "supabase" };
    await t.test("native me, refresh and logout bridge never exposes tokens or Payload credentials", async () => {
      const previous = { ...process.env };
      const originalFetch = globalThis.fetch;
      const { authBridge } = await import("./bridge");
      const { cookieNames } = await import("./session");
      try {
        Object.assign(process.env, { ARNAUD_CMS_ENABLED: "true", SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only" });
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
        globalThis.fetch = async input => String(input).includes("/token") ? Response.json({ access_token: token, refresh_token: "private-refresh", expires_at: exp, expires_in: 3600, token_type: "bearer", user: mapped }) : Response.json(mapped);
        const headers = { origin: "http://localhost:3105", cookie: `${cookieNames().access}=${token}; ${cookieNames().refresh}=private-refresh` };
        const me = await authBridge(new Request("http://localhost:3105/api/cms/cms-users/me", { headers }), "me");
        assert.equal(me.status, 200);
        assert.equal((await me.json()).exp, exp);
        const refresh = await authBridge(new Request("http://localhost:3105/api/cms/cms-users/refresh-token", { method: "POST", headers }), "refresh");
        assert.equal(refresh.status, 200);
        assert.equal((await refresh.text()).includes(token), false);
        assert.doesNotMatch(refresh.headers.get("set-cookie") ?? "", /payload-token/);
        assert.match(refresh.headers.get("set-cookie") ?? "", /HttpOnly/);
        const csrf = await authBridge(new Request("http://localhost:3105/api/cms/cms-users/refresh-token", { method: "POST", headers: { ...headers, origin: "https://attacker.example.test" } }), "refresh");
        assert.equal(csrf.status, 403);
        const logout = await authBridge(new Request("http://localhost:3105/api/cms/cms-users/logout", { method: "POST", headers }), "logout");
        assert.equal(logout.status, 200);
        assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);
      } finally { process.env = previous; globalThis.fetch = originalFetch; }
    });
    const doc = { title: "Private fixture", slug: "isolated-fixture", excerpt: "", body: [{ id: "text", type: "paragraph", props: {}, content: [{ type: "text", text: "A private sentence.", styles: {} }], children: [] }] };
    const created = await payload.create({ collection: "posts", data: doc, draft: true, user, overrideAccess: false });
    assert.equal(created.legacyVersion, 1);
    assert.equal((await pg.query("select * from public.arnaud_blog_posts where id=$1", [created.id])).rows.length, 1);
    await t.test("anonymous content, versions and identity provisioning are denied", async () => {
      await assert.rejects(payload.findByID({ collection: "posts", id: created.id, overrideAccess: false }));
      await assert.rejects(payload.findVersions({ collection: "posts", overrideAccess: false }));
      await assert.rejects(payload.create({ collection: "cms-users", data: { email: "intruder@example.test" }, overrideAccess: false }));
    });
    await t.test("native publish creates only the validated public snapshot", async () => {
      const published = await payload.update({ collection: "posts", id: created.id, data: { ...doc, legacyVersion: 1, _status: "published" }, user, overrideAccess: false });
      assert.equal(published.legacyVersion, 2);
      assert.equal((await pg.query<{ title: string }>("select title from public.arnaud_blog_publications where id=$1", [created.id])).rows[0].title, doc.title);
    });
    await t.test("autosave never changes the public snapshot and stale saves roll back", async () => {
      const saved = await payload.update({ collection: "posts", id: created.id, draft: true, autosave: true, data: { title: "Unpublished change", legacyVersion: 2 }, user, overrideAccess: false });
      assert.equal(saved.legacyVersion, 3);
      assert.equal((await pg.query<{ title: string }>("select title from public.arnaud_blog_publications where id=$1", [created.id])).rows[0].title, doc.title);
      await assert.rejects(payload.update({ collection: "posts", id: created.id, draft: true, data: { title: "Stale overwrite", legacyVersion: 2 }, user, overrideAccess: false }), /another editor/);
      assert.equal((await pg.query<{ version: number }>("select version from public.arnaud_blog_posts where id=$1", [created.id])).rows[0].version, 3);
    });
    await t.test("invalid media publication rolls back both documents and history", async () => {
      const bad = [{ id: "media", type: "image", props: { url: "/blog/media/22345678-1234-1234-1234-123456789abc", caption: "Missing upload" }, children: [] }];
      await assert.rejects(payload.update({ collection: "posts", id: created.id, data: { body: bad, legacyVersion: 3, _status: "published" }, user, overrideAccess: false }));
      assert.equal((await pg.query<{ version: number }>("select version from public.arnaud_blog_posts where id=$1", [created.id])).rows[0].version, 3);
      const latest = await payload.findByID({ collection: "posts", id: created.id, draft: true, user, overrideAccess: false });
      assert.equal(latest.legacyVersion, 3);
    });
    await t.test("version restore creates a new draft, retaining the live snapshot and fixed URL", async () => {
      const versions = await payload.findVersions({ collection: "posts", where: { parent: { equals: created.id } }, sort: "createdAt", user, overrideAccess: false });
      const restored = await payload.restoreVersion({ collection: "posts", id: versions.docs[0].id, user, overrideAccess: false });
      assert.equal(restored._status, "draft");
      assert.equal(restored.legacyVersion, 4);
      assert.equal((await pg.query("select * from public.arnaud_blog_publications where id=$1", [created.id])).rows.length, 1);
      await assert.rejects(payload.update({ collection: "posts", id: created.id, draft: true, data: { slug: "changed-url", legacyVersion: 4 }, user, overrideAccess: false }), /URLs cannot/);
    });
    await t.test("explicit unpublish withdraws public content without deleting originals or revisions", async () => {
      await payload.update({ collection: "posts", id: created.id, data: { _status: "draft", legacyVersion: 4 }, user, overrideAccess: false });
      assert.equal((await pg.query("select * from public.arnaud_blog_publications where id=$1", [created.id])).rows.length, 0);
      assert.equal((await pg.query("select * from public.arnaud_blog_revisions where post_id=$1", [created.id])).rows.length, 5);
    });
  } finally {
    await payload.destroy();
    await payload.db.pool.end();
    await server.stop();
    await pg.close();
  }
});
