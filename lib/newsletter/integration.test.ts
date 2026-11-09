import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { sql, type MigrateUpArgs, type PostgresAdapter } from "@payloadcms/db-postgres";
import { createLocalReq, getPayload, restoreVersionOperation, type Payload } from "payload";
import { up as baselineUp } from "../../migrations/20261031_200002_payload_journal";
import { up as historyUp } from "../../migrations/20261031_202034_history_precision";
import { up as nativeUp } from "../../migrations/20261102_200000_native_journal";
import { up as expansionUp } from "../../migrations/20261104_120000_site_expansion";
import { up as categoriesUp } from "../../migrations/20261104_110000_portfolio_categories";
import { up as homepageUp } from "../../migrations/20261105_120000_homepage";
import { up as customizationUp } from "../../migrations/20261109_120000_page_customization";
import type { Post } from "../../payload-types";
import { newsletterConfigured } from "./config";
import { dispatchBatch } from "./dispatch";
import { hash } from "./provider";
import { queuePostAnnouncement } from "./queue";
import { NewsletterStore } from "./store";

const secret = "isolated-native-newsletter-test-secret-only";
const origin = "https://newsletter.example.test";
const body: Post["body"] = { root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [
  { type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: [{ type: "text", version: 1, text: "Synthetic newsletter entry", format: 0, detail: 0, mode: "normal", style: "" }] },
] } };

test("generated newsletter schema and native publication transaction under private runtime grants", { timeout: 120000 }, async t => {
  const oldEnv = { ...process.env }, oldFetch = globalThis.fetch;
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1", maxConnections: 5 });
  let payload: Payload | undefined;
  try {
    globalThis.fetch = async () => assert.fail("Unexpected network: native newsletter fixture is isolated");
    await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
    await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
    await server.start();
    const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
    Object.assign(process.env, {
      NODE_ENV: "test", DISABLE_PAYLOAD_HMR: "true", ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true", ARNAUD_NEWSLETTER_ENABLED: "true",
      ARNAUD_CMS_DATABASE_URL: connectionString, PAYLOAD_SECRET: secret, ARNAUD_CMS_ORIGIN: origin,
      ARNAUD_NEWSLETTER_API_KEY: "re_synthetic_fixture_not_a_real_key", ARNAUD_NEWSLETTER_FROM: "journal@example.test", ARNAUD_NEWSLETTER_TOKEN_SECRET: secret,
      SUPABASE_ADMIN_USER_IDS: "32345678-1234-4234-8234-123456789abc", ARNAUD_BLOG_UPLOADS_ENABLED: "false",
      R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "fixture-only", R2_SECRET_ACCESS_KEY: "fixture-only", R2_STAGING_BUCKET: "arnaudbelec-staging", R2_PUBLISHED_BUCKET: "arnaudbelec",
      SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-only", SUPABASE_SERVICE_ROLE_KEY: "fixture-only",
    });
    const config = await (await import("../../payload.config")).default;
    assert.ok(config.collections.find(item => item.slug === "posts")!.hooks.afterChange.includes(queuePostAnnouncement));
    const cms = payload = await getPayload({ key: "newsletter-native-integration", config });
    (cms.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0].release();
    for (const up of [baselineUp, historyUp, nativeUp, categoriesUp, expansionUp, homepageUp, customizationUp]) await cms.db.drizzle.transaction(async db => {
      await db.execute(sql`set local role arnaud_cms_migrator`);
      await up({ db } as unknown as MigrateUpArgs);
    });
    await cms.db.pool.end();
    cms.db.pool = new cms.db.pg!.Pool({ connectionString, max: 1 });
    await cms.db.connect?.({ hotReload: true });
    await cms.db.drizzle.execute(sql`set role arnaud_cms_runtime`);
    assert.equal((await cms.db.drizzle.execute(sql`select current_user`)).rows[0].current_user, "arnaud_cms_runtime");
    const mapped = await cms.create({ collection: "cms-users", data: { id: process.env.SUPABASE_ADMIN_USER_IDS, email: "synthetic-admin@example.test" } });
    const user = { ...mapped, collection: "cms-users" as const, _strategy: "supabase" };
    const store = new NewsletterStore((text, values) => cms.db.pool.query(text, values));
    const otherStore = new NewsletterStore((text, values) => cms.db.pool.query(text, values));
    const count = async () => Number((await cms.db.pool.query("select count(*) n from arnaud_cms.newsletter_deliveries")).rows[0].n);
    let post: Post;

    await t.test("only published enabled settings are ready; unpublishing disables", async () => {
      assert.equal(await newsletterConfigured(cms), false);
      let settings = await cms.updateGlobal({ slug: "site-settings", draft: true, user, overrideAccess: false, data: { newsletterEnabled: true } });
      assert.equal(await newsletterConfigured(cms), false, "initial private draft must not enable email");
      let existing = await cms.create({ collection: "posts", draft: true, user, overrideAccess: false, data: { title: "Publication while settings are private", body } });
      existing = await cms.update({ collection: "posts", id: existing.id, user, overrideAccess: false, data: { editRevision: existing.editRevision, _status: "published" } });
      assert.equal(await count(), 0, "draft settings must not enqueue announcements");
      settings = await cms.updateGlobal({ slug: "site-settings", user, overrideAccess: false, data: { newsletterEnabled: true, editRevision: settings.editRevision, _status: "published" } });
      assert.equal(await newsletterConfigured(cms), true);
      await cms.update({ collection: "posts", id: existing.id, user, overrideAccess: false, data: { excerpt: "Not a new first publication", editRevision: existing.editRevision, _status: "published" } });
      assert.equal(await count(), 0, "enabling settings must not backfill an existing publication");
      await cms.updateGlobal({ slug: "site-settings", user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } });
      assert.equal(await newsletterConfigured(cms), false);
      await cms.updateGlobal({ slug: "site-settings", user, overrideAccess: false, data: { newsletterEnabled: true, editRevision: settings.editRevision, _status: "published" } });
      assert.equal(await newsletterConfigured(cms), true);
    });
    await t.test("actual subscriber columns support private double opt-in and runtime-only access", async () => {
      for (const address of ["first@example.test", "second@example.test"]) {
        const token = await store.requestConfirmation(address, secret); assert.ok(token);
        assert.equal(await otherStore.requestConfirmation(address, secret), null);
        const row = (await cms.db.pool.query("select confirmation_hash from arnaud_cms.newsletter_subscribers where email=$1", [address])).rows[0];
        assert.equal(row.confirmation_hash, hash(token));
        assert.equal(await otherStore.confirm(token), true); assert.equal(await store.confirm(token), false);
      }
      await assert.rejects(cms.find({ collection: "newsletter-subscribers", overrideAccess: false }));
      assert.equal((await cms.find({ collection: "newsletter-subscribers", user, overrideAccess: false })).totalDocs, 2);
      for (const table of ["newsletter_subscribers", "newsletter_deliveries", "newsletter_recipients"]) {
        for (const role of ["anon", "authenticated"]) assert.equal((await pg.query<{ allowed: boolean }>("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed", [role, `arnaud_cms.${table}`])).rows[0].allowed, false);
      }
      await assert.rejects(cms.db.pool.query("create table arnaud_cms.forbidden_newsletter_ddl(id integer)"), /permission denied/);
    });
    await t.test("native first publication queues once; draft, autosave, restore and republish do not enqueue", async () => {
      post = await cms.create({ collection: "posts", draft: true, user, overrideAccess: false, data: { title: "Synthetic newsletter post", body } });
      const original = (await cms.findVersions({ collection: "posts", user, overrideAccess: false, where: { parent: { equals: post.id } } })).docs[0];
      assert.equal(await count(), 0);
      post = await cms.update({ collection: "posts", id: post.id, user, overrideAccess: false, data: { body, editRevision: post.editRevision, _status: "published" } });
      assert.equal(await count(), 1);
      for (const autosave of [false, true]) post = await cms.update({ collection: "posts", id: post.id, draft: true, autosave, user, overrideAccess: false, data: { excerpt: "Private edit", editRevision: post.editRevision } });
      post = await restoreVersionOperation({ collection: cms.collections.posts, id: original.id, draft: true, overrideAccess: false, req: await createLocalReq({ user }, cms) });
      await cms.update({ collection: "posts", id: post.id, user, overrideAccess: false, data: { _status: "draft" } });
      post = await cms.update({ collection: "posts", id: post.id, user, overrideAccess: false, data: { body, editRevision: post.editRevision, _status: "published" } });
      assert.equal(await count(), 1);
    });
    await t.test("explicit parent transaction rollback removes publication and outbox together", async () => {
      const draft = await cms.create({ collection: "posts", draft: true, user, overrideAccess: false, data: { title: "Rolled back publication" } });
      const req = await createLocalReq({ user }, cms);
      const transaction = await cms.db.beginTransaction(); assert.ok(transaction);
      req.transactionID = transaction;
      try {
        await cms.update({ collection: "posts", id: draft.id, req, overrideAccess: false, data: { body, editRevision: draft.editRevision, _status: "published" } });
        const transactionDB = cms.db.sessions?.[transaction]?.db as PostgresAdapter["drizzle"] | undefined; assert.ok(transactionDB);
        const inside = await transactionDB.execute(sql`select post_id from arnaud_cms.newsletter_deliveries where post_id=${draft.id}::uuid`);
        assert.equal(inside.rows.length, 1, "outbox must be visible in the supplied publication transaction");
      } finally { await cms.db.rollbackTransaction(transaction); delete req.transactionID; }
      assert.equal(await count(), 1);
      const after = await cms.findByID({ collection: "posts", id: draft.id, draft: true, user, overrideAccess: false });
      assert.equal(after._status, "draft"); assert.equal(after.firstPublishedAt, null);
    });
    await t.test("two store instances claim distinct recipients and dispatch once through mocked Resend", async () => {
      const delivery = await store.nextDelivery(); assert.ok(delivery);
      await store.seed(delivery.id, 10);
      // Both calls are simultaneous, but the one-connection PGlite socket fixture
      // serializes sessions: this proves durable lease exclusion, not real PG parallel isolation.
      const claims = await Promise.all([store.claim(delivery.id), otherStore.claim(delivery.id)]);
      assert.ok(claims[0]); assert.ok(claims[1]); assert.notEqual(claims[0].id, claims[1].id);
      assert.equal(await otherStore.claim(delivery.id), null);
      let sends = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(String(url), "https://api.resend.com/emails"); assert.equal(options?.method, "POST");
        assert.match((options?.headers as Record<string, string>)["Idempotency-Key"], /^arnaud-newsletter:/);
        sends++; return Response.json({ id: `mock-native-${sends}` });
      };
      const deps = { store, config: { origin, secret, from: "journal@example.test" }, readPost: (id: string) => cms.findByID({ collection: "posts", id, draft: false, depth: 0, overrideAccess: true }) };
      assert.equal((await dispatchBatch(deps)).processed, 0); assert.equal(sends, 0, "active claims must not send twice");
      for (const claim of claims) { assert.ok(claim); await store.finish(claim, "retry", "fixture_released_without_send"); }
      await cms.db.pool.query("update arnaud_cms.newsletter_recipients set retry_at=now()-interval '1 second'");
      assert.equal((await dispatchBatch(deps)).outcomes.sent, 2);
      assert.equal((await dispatchBatch(deps)).processed, 0); assert.equal(sends, 2);
      assert.equal((await cms.find({ collection: "newsletter-recipients", user, overrideAccess: false })).docs.filter(row => row.status === "sent" && row.providerId).length, 2);
    });
  } finally {
    try { if (payload) { await payload.destroy(); await payload.db.pool.end(); } }
    finally { await server.stop(); await pg.close(); process.env = oldEnv; globalThis.fetch = oldFetch; }
  }
});
