import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { postgresAdapter, sql, type MigrateUpArgs } from "@payloadcms/db-postgres";
import { APIError, buildConfig, createLocalReq, getPayload, restoreVersionOperation, type CollectionSlug, type GlobalSlug, type Payload, type SanitizedConfig } from "payload";
import { up as baselineUp } from "../../migrations/20261031_200002_payload_journal";
import { up as historyUp } from "../../migrations/20261031_202034_history_precision";
import { up as nativeUp } from "../../migrations/20261102_200000_native_journal";
import { up as categoriesUp } from "../../migrations/20261104_110000_portfolio_categories";
import { up as expansionUp } from "../../migrations/20261104_120000_site_expansion";
import { up as homepageUp } from "../../migrations/20261105_120000_homepage";
import { up as originalsUp } from "../../migrations/20261106_120000_large_originals";
import type { Post } from "../../payload-types";

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const generated = new Set(["payload-kv", "payload-locked-documents", "payload-preferences", "payload-migrations"]);
const originalCollections = new Set(["cms-users", "posts", "media"]);
const body = (text: string, media: string[] = []): Post["body"] => ({ root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [
  { type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: [{ type: "text", version: 1, text, format: 0, detail: 0, mode: "normal", style: "" }] },
  ...media.map(id => ({ type: "upload", version: 3, relationTo: "media", value: id, fields: {} })),
] } });
type Document = { id: string; editRevision: number; title?: string; slug?: string; _status?: string; intro?: string };
type SavedTable = { schema: string; name: string; columns: { column_name: string; data_type: string; udt_name: string }[]; rows: unknown[]; grants: unknown[] };
function permissionDenied(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /permission denied/.test(error.message) || permissionDenied(error.cause);
}
function releaseStartupLease(payload: Payload) {
  (payload.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0].release();
}

async function oldTables(pg: PGlite): Promise<SavedTable[]> {
  const tables = await pg.query<{ table_schema: string; table_name: string }>("select table_schema, table_name from information_schema.tables where table_schema in ('arnaud_cms', 'public', 'auth', 'other_site') and table_type = 'BASE TABLE' order by table_schema, table_name");
  const result: SavedTable[] = [];
  for (const table of tables.rows) {
    const columns = await pg.query<SavedTable["columns"][number]>("select column_name, data_type, udt_name from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position", [table.table_schema, table.table_name]);
    result.push({ schema: table.table_schema, name: table.table_name, columns: columns.rows, rows: [], grants: [] });
  }
  for (const table of result) {
    table.rows = await tableRows(pg, table);
    table.grants = await tableGrants(pg, table);
  }
  return result;
}

async function tableRows(pg: PGlite, table: SavedTable) {
  // Project original columns: the shared lock relation legitimately acquires
  // new nullable columns, but every pre-existing byte/value must survive.
  const columns = table.columns.map(column => identifier(column.column_name)).join(", ");
  return (await pg.query(`select to_jsonb(original) as row from (select ${columns} from ${identifier(table.schema)}.${identifier(table.name)}) original order by to_jsonb(original)::text`)).rows;
}
async function tableGrants(pg: PGlite, table: SavedTable) {
  return (await pg.query("select grantee, privilege_type, is_grantable from information_schema.table_privileges where table_schema = $1 and table_name = $2 order by grantee, privilege_type, is_grantable", [table.schema, table.name])).rows;
}
async function assertPreserved(pg: PGlite, tables: SavedTable[]) {
  for (const table of tables) {
    const label = `${table.schema}.${table.name}`;
    const current = await pg.query<SavedTable["columns"][number]>("select column_name, data_type, udt_name from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position", [table.schema, table.name]);
    assert.deepEqual(current.rows.filter(column => table.columns.some(original => original.column_name === column.column_name)), table.columns, `${label}: original columns/types changed`);
    assert.deepEqual(await tableRows(pg, table), table.rows, `${label}: old rows changed`);
    assert.deepEqual(await tableGrants(pg, table), table.grants, `${label}: old privileges changed`);
  }
}

async function asRuntime(payload: Payload, connectionString: string) {
  // A single socket keeps SET ROLE attached to every subsequent operation.
  await payload.db.pool.end();
  payload.db.pool = new payload.db.pg!.Pool({ connectionString, max: 1 });
  await payload.db.connect?.({ hotReload: true });
  await payload.db.drizzle.execute(sql`set role arnaud_cms_runtime`);
  assert.equal((await payload.db.drizzle.execute(sql`select current_user`)).rows[0].current_user, "arnaud_cms_runtime");
}

async function disabledRegisteredConfig(actual: SanitizedConfig, connectionString: string) {
  // Re-sanitize actual registered collections so Payload generates its shared
  // lock relationship from the OFF configuration rather than reusing ON's
  // already-generated polymorphic relationship. Preserve real hooks/access.
  return buildConfig({
    secret: actual.secret, telemetry: false, admin: { user: "cms-users" },
    routes: actual.routes, serverURL: actual.serverURL, csrf: actual.csrf,
    editor: actual.editor ? () => actual.editor! : undefined, graphQL: { disable: true },
    collections: actual.collections.filter(collection => !generated.has(collection.slug)).map(collection =>
      originalCollections.has(collection.slug) ? collection : { ...collection, lockDocuments: false }),
    globals: actual.globals.map(global => ({ ...global, lockDocuments: false })),
    db: postgresAdapter({ pool: { connectionString, max: 3 }, schemaName: "arnaud_cms", idType: "uuid", allowIDOnCreate: true, push: false, disableCreateDatabase: true }),
    typescript: { ...actual.typescript, autoGenerate: false },
  });
}

test("site migration preserves populated native content, restricted roles and registered OFF old-schema compatibility", { timeout: 120000 }, async t => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1", maxConnections: 5 });
  const payloads: Payload[] = [];
  const close = async (payload: Payload) => {
    await payload.destroy();
    await payload.db.pool.end();
    payloads.splice(payloads.indexOf(payload), 1);
  };
  try {
    await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
    await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
    // Deliberately small stand-ins, not imported application/photo/Auth schemas.
    await pg.exec("create table public.arnaud_photographs (id uuid primary key, filename text not null, metadata jsonb not null); create schema auth; create table auth.users (id uuid primary key, email text); create schema other_site; create table other_site.photographs (id integer primary key, original_path text); insert into public.arnaud_photographs values ('92345678-1234-4234-8234-123456789abc', 'preserve-original.jpg', '{\"palette\":[\"#123456\"],\"published\":true}'); insert into auth.users values ('32345678-1234-4234-8234-123456789abc', 'synthetic@example.test'); insert into other_site.photographs values (7, 'must-not-change.jpg');");
    await server.start();
    const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
    Object.assign(process.env, {
      NODE_ENV: "test", ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true", ARNAUD_NEWSLETTER_ENABLED: "false",
      ARNAUD_CMS_DATABASE_URL: connectionString, PAYLOAD_SECRET: "isolated-populated-migration-test-secret-only", ARNAUD_CMS_ORIGIN: "http://localhost:3105",
      SUPABASE_ADMIN_USER_IDS: "32345678-1234-4234-8234-123456789abc", ARNAUD_BLOG_UPLOADS_ENABLED: "false",
      R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "fixture-only", R2_SECRET_ACCESS_KEY: "fixture-only",
      R2_STAGING_BUCKET: "arnaudbelec-staging", R2_PUBLISHED_BUCKET: "arnaudbelec",
      SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-only", SUPABASE_SERVICE_ROLE_KEY: "fixture-only",
      DISABLE_PAYLOAD_HMR: "true",
    });
    globalThis.fetch = async () => assert.fail("Migration rehearsal must not perform network Auth, storage, photograph or newsletter calls");
    // Import only after installing explicit synthetic settings; no .env loader.
    const actual = await (await import("../../payload.config")).default;
    const additions = actual.collections.filter(collection => !generated.has(collection.slug) && !originalCollections.has(collection.slug));
    assert.ok(additions.some(collection => String(collection.slug) === "videos"));
    assert.ok(additions.some(collection => String(collection.slug) === "fashion-projects"));
    assert.ok(additions.some(collection => String(collection.slug) === "newsletter-subscribers"));
    await t.test("actual newsletter registration permanently excludes shared document locks", () => {
      for (const collection of additions.filter(collection => collection.slug.startsWith("newsletter-"))) assert.equal(collection.lockDocuments, false, "Newsletter resources must never extend shared document locks");
    });
    const offConfig = await disabledRegisteredConfig(actual, connectionString);
    process.env.ARNAUD_SITE_EXPANSION_ENABLED = "false";
    const off = await getPayload({ key: "site-migration-off", config: offConfig });
    payloads.push(off);
    releaseStartupLease(off);
    for (const migrate of [baselineUp, historyUp, nativeUp]) {
      await off.db.drizzle.transaction(async db => {
        await db.execute(sql`set local role arnaud_cms_migrator`);
        await migrate({ db } as unknown as MigrateUpArgs);
      });
    }
    await asRuntime(off, connectionString);
    const mapped = await off.create({ collection: "cms-users", data: { id: process.env.SUPABASE_ADMIN_USER_IDS, email: "synthetic@example.test" } });
    const user = { ...mapped, collection: "cms-users" as const, _strategy: "supabase" };
    // Fixture materialization bypasses upload hooks intentionally: no R2 exists.
    // These immutable verified native rows are included in the preservation check.
    const media = await off.db.create({ collection: "media", data: { filename: "preserved.png", mimeType: "image/png", verified: true, sha256: "a".repeat(64), uploadIdentity: "journal-native/preserved.png", prefix: "journal-native", alt: "Preserved image", filesize: 77, width: 1, height: 1 } });
    const privateMedia = await off.db.create({ collection: "media", data: { filename: "private.png", mimeType: "image/png", verified: true, sha256: "b".repeat(64), uploadIdentity: "journal-native/private.png", prefix: "journal-native", alt: "Private image", filesize: 77 } });
    const audio = await off.db.create({ collection: "media", data: { filename: "ambient.mp3", mimeType: "audio/mpeg", verified: true, sha256: "c".repeat(64), uploadIdentity: "journal-native/ambient.mp3", prefix: "journal-native", filesize: 123 } });
    let post = await off.create({ collection: "posts", draft: true, user, overrideAccess: false, data: { title: "Preserved native post" } });
    post = await off.update({ collection: "posts", id: post.id, user, overrideAccess: false, data: { slug: "preserved-native", body: body("Published native text", [media.id]), editRevision: post.editRevision, _status: "published" } });
    post = await off.update({ collection: "posts", id: post.id, draft: true, autosave: true, user, overrideAccess: false, data: { title: "Retained private autosave", body: body("Private native text", [privateMedia.id]), editRevision: post.editRevision } });
    await off.create({ collection: "posts", draft: true, user, overrideAccess: false, data: { title: "Second incomplete draft" } });

    await t.test("all registered new resources hide and reject reads/writes while OFF", async t => {
      for (const collection of additions) await t.test(collection.slug, async () => {
        const registered = off.config.collections.find(item => item.slug === collection.slug)!;
        assert.equal(registered.lockDocuments, false);
        assert.equal(typeof registered.admin.hidden === "function" ? registered.admin.hidden({ user }) : registered.admin.hidden, true);
        for (const operation of [
          () => off.find({ collection: collection.slug as CollectionSlug, user, overrideAccess: false }),
          () => off.create({ collection: collection.slug as CollectionSlug, user, overrideAccess: false, draft: true, data: {} as never }),
        ]) await assert.rejects(operation, error => error instanceof APIError && [403, 404, 503].includes(error.status), `${collection.slug} must reject before missing-table SQL`);
      });
      await assert.rejects(off.findGlobal({ slug: "site-settings" as GlobalSlug, user, overrideAccess: false }), error => error instanceof APIError && error.status === 503);
      await assert.rejects(off.updateGlobal({ slug: "site-settings" as GlobalSlug, user, overrideAccess: false, draft: true, data: { intro: "Must not reach a missing table" } as never }), error => error instanceof APIError && error.status === 503);
      const registeredSettings = off.config.globals.find(global => global.slug === "site-settings")!;
      assert.equal(typeof registeredSettings.admin.hidden === "function" ? registeredSettings.admin.hidden({ user }) : registeredSettings.admin.hidden, true);
    });
    await t.test("registered OFF configuration supports Posts, Media, identity and admin locks against native-only schema", async () => {
      const nativeOnly = await pg.query<{ exists: string | null }>("select to_regclass('arnaud_cms.videos')::text as exists");
      assert.equal(nativeOnly.rows[0].exists, null);
      const newLockColumns = await pg.query("select column_name from information_schema.columns where table_schema = 'arnaud_cms' and table_name = 'payload_locked_documents_rels' and column_name in ('videos_id', 'fashion_projects_id', 'newsletter_subscribers_id', 'newsletter_deliveries_id', 'newsletter_recipients_id')");
      assert.deepEqual(newLockColumns.rows, []);
      const lock = await off.create({ collection: "payload-locked-documents", user, overrideAccess: false, data: { document: { relationTo: "posts", value: post.id }, user: { relationTo: "cms-users", value: mapped.id } } });
      const locks = await off.find({ collection: "payload-locked-documents", user, overrideAccess: false, depth: 1 });
      assert.equal(locks.docs[0].id, lock.id);
      post = await off.update({ collection: "posts", id: post.id, draft: true, autosave: true, user, overrideAccess: false, data: { excerpt: "Saved with an existing admin lock", editRevision: post.editRevision } });
      assert.equal((await off.findByID({ collection: "posts", id: post.id, draft: true, overrideAccess: false })).title, "Preserved native post");
      assert.deepEqual((await off.find({ collection: "media", depth: 0, overrideAccess: false })).docs.map(item => item.id), [media.id]);
      assert.equal((await off.find({ collection: "cms-users", user, overrideAccess: false })).docs[0].id, mapped.id);
      assert.ok((await off.findVersions({ collection: "posts", user, overrideAccess: false })).totalDocs >= 4);
    });

    const preserved = await oldTables(pg);
    let categoryCheckpoint: SavedTable[] = [];
    let originalJournalCheckpoint: unknown[] = [];
    await t.test("category checkpoint preserves populated native content before the remaining expansion", async () => {
      await off.db.drizzle.transaction(async db => {
        await db.execute(sql`set local role arnaud_cms_migrator`);
        await categoriesUp({ db } as unknown as MigrateUpArgs);
      });
      await assertPreserved(pg, preserved);
      assert.equal((await pg.query<{ name: string | null }>("select to_regclass('arnaud_cms.site_settings') as name")).rows[0].name, null);
      assert.equal((await pg.query<{ name: string | null }>("select to_regclass('arnaud_cms.newsletter_subscribers') as name")).rows[0].name, null);
      // Production may acquire private project drafts between these releases.
      // The later full expansion must preserve their rows, versions and links.
      await off.db.drizzle.execute(sql`insert into arnaud_cms.videos (id,title,slug,cover_id,_status) values ('82345678-1234-4234-8234-123456789ab1','Checkpoint film draft','checkpoint-film',${media.id},'draft')`);
      await off.db.drizzle.execute(sql`insert into arnaud_cms._videos_v (id,parent_id,version_title,version_slug,version__status,latest) values ('82345678-1234-4234-8234-123456789ab2','82345678-1234-4234-8234-123456789ab1','Retained checkpoint version','checkpoint-film','draft',true)`);
      await off.db.drizzle.execute(sql`insert into arnaud_cms.videos_rels (parent_id,path,media_id) values ('82345678-1234-4234-8234-123456789ab1','gallery',${media.id})`);
      await off.db.drizzle.execute(sql`insert into arnaud_cms.fashion_projects (id,title,slug,_status) values ('82345678-1234-4234-8234-123456789ab3','Checkpoint fashion draft','checkpoint-fashion','draft')`);
      // The operator-only checkpoint can precede the still-unreleased full site.
      // Its recovery data and denied runtime grants must survive that later work.
      await off.db.drizzle.transaction(async db => {
        await db.execute(sql`set local role arnaud_cms_migrator`);
        await originalsUp({ db } as unknown as MigrateUpArgs);
        await db.execute(sql`insert into arnaud_cms.media_imports (id,actor_id,idempotency_key,original_filename,expected_bytes,expected_sha256,source_identity,filename,object_key,probe) values ('82345678-1234-4234-8234-123456789ab4',${mapped.id},'retained-original-checkpoint','checkpoint.mp4',7834547136,${"a".repeat(64)},'{}','82345678-1234-4234-8234-123456789ab4.mp4','journal-native/large-originals/82345678-1234-4234-8234-123456789ab4/82345678-1234-4234-8234-123456789ab4.mp4','{}')`);
        originalJournalCheckpoint = (await db.execute(sql`select to_jsonb(t) as row from arnaud_cms.media_imports t order by id`)).rows;
      });
      categoryCheckpoint = await oldTables(pg);
    });
    await t.test("remaining expansion preserves every old column/value/row and table privilege without recreating category tables", async () => {
      await off.db.drizzle.transaction(async db => {
        await db.execute(sql`set local role arnaud_cms_migrator`);
        await expansionUp({ db } as unknown as MigrateUpArgs);
      });
      await assertPreserved(pg, preserved);
      await assertPreserved(pg, categoryCheckpoint);
      await off.db.drizzle.transaction(async db => {
        await db.execute(sql`set local role arnaud_cms_migrator`);
        assert.deepEqual((await db.execute(sql`select to_jsonb(t) as row from arnaud_cms.media_imports t order by id`)).rows, originalJournalCheckpoint, "Full expansion must preserve private original recovery records");
      });
    });
    await t.test("homepage migration preserves expansion columns, settings history and privileges", async () => {
      // Populate the pre-homepage schema directly because the current Payload
      // model already expects the new columns. These are isolated fixture rows.
      const mainId = "72345678-1234-4234-8234-123456789ab1";
      const versionId = "72345678-1234-4234-8234-123456789ab2";
      await off.db.drizzle.execute(sql`insert into arnaud_cms.site_settings (id, intro, contact_email, edit_revision, _status) values (${mainId}, 'Preserved pre-homepage settings', 'before@example.test', 0, 'published')`);
      await off.db.drizzle.execute(sql`insert into arnaud_cms._site_settings_v (id, version_intro, version_edit_revision, version__status, latest) values (${versionId}, 'Preserved pre-homepage history', 0, 'draft', false)`);
      const expanded = await oldTables(pg);
      await off.db.drizzle.transaction(async db => {
        await db.execute(sql`set local role arnaud_cms_migrator`);
        await homepageUp({ db } as unknown as MigrateUpArgs);
      });
      await assertPreserved(pg, expanded);
      await off.db.drizzle.execute(sql`delete from arnaud_cms._site_settings_v where id = ${versionId}`);
      await off.db.drizzle.execute(sql`delete from arnaud_cms.site_settings where id = ${mainId}`);
    });
    await t.test("migrator default grants cover every expansion table/sequence without browser access or cross-schema escalation", async () => {
      const original = new Set(preserved.filter(table => table.schema === "arnaud_cms").map(table => table.name));
      const tables = await pg.query<{ tablename: string; tableowner: string }>("select tablename, tableowner from pg_tables where schemaname = 'arnaud_cms' order by tablename");
      const added = tables.rows.filter(table => !original.has(table.tablename));
      assert.ok(added.some(table => table.tablename === "videos"));
      assert.ok(added.some(table => table.tablename === "site_settings"));
      assert.ok(added.some(table => table.tablename === "newsletter_subscribers"));
      for (const table of added) {
        assert.ok(["arnaud_cms_owner", "arnaud_cms_migrator"].includes(table.tableowner), `${table.tablename}: unexpected owner`);
        const relation = `arnaud_cms.${identifier(table.tablename)}`;
        if (table.tablename === "media_imports") {
          for (const role of ["arnaud_cms_runtime", "anon", "authenticated", "service_role"]) {
            assert.equal((await pg.query<{ allowed: boolean }>("select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') as allowed", [role, relation])).rows[0].allowed, false, "Operator recovery journal must remain private after the full expansion");
          }
          continue;
        }
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
          assert.equal((await pg.query<{ allowed: boolean }>("select has_table_privilege('arnaud_cms_runtime', $1, $2) as allowed", [relation, privilege])).rows[0].allowed, true, `${relation}: runtime ${privilege}`);
          for (const browser of ["anon", "authenticated"]) assert.equal((await pg.query<{ allowed: boolean }>("select has_table_privilege($1, $2, $3) as allowed", [browser, relation, privilege])).rows[0].allowed, false, `${relation}: ${browser} ${privilege}`);
        }
      }
      const sequences = await pg.query<{ sequencename: string }>("select sequencename from pg_sequences where schemaname = 'arnaud_cms'");
      for (const sequence of sequences.rows) {
        const relation = `arnaud_cms.${identifier(sequence.sequencename)}`;
        for (const privilege of ["USAGE", "SELECT"]) assert.equal((await pg.query<{ allowed: boolean }>("select has_sequence_privilege('arnaud_cms_runtime', $1, $2) as allowed", [relation, privilege])).rows[0].allowed, true);
        for (const browser of ["anon", "authenticated"]) assert.equal((await pg.query<{ allowed: boolean }>("select has_sequence_privilege($1, $2, 'USAGE,SELECT') as allowed", [browser, relation])).rows[0].allowed, false);
      }
      for (const role of ["arnaud_cms_owner", "arnaud_cms_migrator", "service_role", "authenticated"]) assert.equal((await pg.query<{ member: boolean }>("select pg_has_role('arnaud_cms_runtime', $1, 'MEMBER') as member", [role])).rows[0].member, false);
      for (const relation of ["public.arnaud_photographs", "auth.users", "other_site.photographs"]) await assert.rejects(off.db.drizzle.execute(sql.raw(`select * from ${relation}`)), permissionDenied);
      await assert.rejects(off.db.drizzle.execute(sql`create table arnaud_cms.forbidden_runtime_ddl (id integer)`), permissionDenied);
    });

    await close(off);
    process.env.ARNAUD_SITE_EXPANSION_ENABLED = "true";
    const on = await getPayload({ key: "site-migration-on", config: actual });
    payloads.push(on);
    releaseStartupLease(on);
    await asRuntime(on, connectionString);
    await t.test("actual ON configuration writes/publishes/restores projects and settings using runtime grants and shared native Media", async () => {
      const videos = "videos" as CollectionSlug;
      const fashion = "fashion-projects" as CollectionSlug;
      const settingsSlug = "site-settings" as GlobalSlug;
      let video = await on.create({ collection: videos, draft: true, user, overrideAccess: false, data: { title: "Migration video draft" } as never }) as unknown as Document;
      const version = (await on.findVersions({ collection: videos, user, overrideAccess: false })).docs[0];
      video = await on.update({ collection: videos, id: video.id, user, overrideAccess: false, data: { title: "Published migration video", cover: media.id, body: body("Migration runtime content"), editRevision: video.editRevision, _status: "published" } as never }) as unknown as Document;
      const restored = await restoreVersionOperation({ collection: on.collections[videos], id: version.id, draft: true, overrideAccess: false, req: await createLocalReq({ user }, on) }) as unknown as Document;
      assert.equal(restored._status, "draft");
      assert.equal((await on.findByID({ collection: videos, id: video.id, overrideAccess: false }) as unknown as Document).title, "Published migration video");
      const project = await on.create({ collection: fashion, user, overrideAccess: false, data: { title: "Shared image project", cover: media.id, _status: "published" } as never });
      assert.deepEqual((await on.find({ collection: "media", overrideAccess: false, depth: 0 })).docs.map(item => item.id), [media.id]);
      let settings = await on.updateGlobal({ slug: settingsSlug, draft: true, user, overrideAccess: false, data: { intro: "Private initial settings" } as never }) as Document;
      const settingsVersion = (await on.findGlobalVersions({ slug: settingsSlug, user, overrideAccess: false })).docs[0];
      settings = await on.updateGlobal({ slug: settingsSlug, user, overrideAccess: false, data: { intro: "Published settings", ambientAudio: audio.id, editRevision: settings.editRevision, _status: "published", newsletterEnabled: false } as never }) as Document;
      const { restoreSiteSettingsVersion } = await import("./site-settings");
      const privateSettings = await restoreSiteSettingsVersion(await createLocalReq({ user }, on), String(settingsVersion.id)) as Document;
      assert.equal(privateSettings._status, "draft");
      assert.equal((await on.findGlobal({ slug: settingsSlug, overrideAccess: false }) as Document).intro, "Published settings");
      assert.deepEqual(new Set((await on.find({ collection: "media", overrideAccess: false, depth: 0 })).docs.map(item => item.id)), new Set([media.id, audio.id]));
      await on.updateGlobal({ slug: settingsSlug, user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } as never });
      for (const [collection, id] of [[videos, video.id], [fashion, project.id]] as const) await on.update({ collection, id, user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } as never });
      assert.deepEqual((await on.find({ collection: "media", overrideAccess: false, depth: 0 })).docs.map(item => item.id), [media.id], "Unpublishing new resources must retain the existing published journal's shared Media");
      assert.equal(settings.intro, "Published settings");
    });
    await assertPreserved(pg, preserved);
  } finally {
    try {
      for (const payload of [...payloads]) await close(payload);
    } finally {
      await server.stop();
      await pg.close();
      process.env = previousEnv;
      globalThis.fetch = previousFetch;
    }
  }
});
