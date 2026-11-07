import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor, UploadFeature } from "@payloadcms/richtext-lexical";
import { buildConfig, createLocalReq, getPayload, handleEndpoints, restoreVersionOperation, ValidationError, type CollectionSlug, type GlobalSlug, type PayloadRequest } from "payload";
import { Videos, FashionProjects } from "./projects";
import { SiteSettings, restoreSiteSettingsVersion } from "./site-settings";
import { Media } from "./media";
import { Posts } from "./posts";
import { toPublicSiteSettings } from "../site/public";

const body = (text: string) => ({ root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [{ type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: [{ type: "text", version: 1, text, format: 0, detail: 0, mode: "normal", style: "" }] }] } });

test("isolated native projects/settings keep publication, private autosaves/restores and media references atomic", { timeout: 90000 }, async () => {
  const env = { ...process.env };
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1", maxConnections: 5 });
  await server.start();
  Object.assign(process.env, { ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true", SUPABASE_ADMIN_USER_IDS: "32345678-1234-4234-8234-123456789abc", DISABLE_PAYLOAD_HMR: "true" });
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined;
  let fixtureUser: PayloadRequest["user"] | null = null;
  try {
    // Schema push is deliberately confined to this fresh in-memory database.
    // No repository config, migration files, .env or production endpoints load.
    payload = await getPayload({ config: buildConfig({
      secret: "isolated-site-expansion-test-secret-only", telemetry: false,
      typescript: { autoGenerate: false }, graphQL: { disable: true },
      admin: { user: "cms-users" },
      collections: [{ slug: "cms-users", auth: { disableLocalStrategy: true, strategies: [{ name: "supabase", authenticate: async ({ headers }) => ({ user: headers.get("authorization") === "Bearer isolated-fixture" ? fixtureUser : null }) }] }, fields: [{ name: "email", type: "email" }] }, Posts, Media, ...[Videos, FashionProjects].map(config => ({ ...config, lockDocuments: { duration: 300 } }))],
      globals: [{ ...SiteSettings, lockDocuments: { duration: 300 } }],
      editor: lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures.filter(feature => feature.key !== "upload"), UploadFeature({ enabledCollections: ["media"] })] }),
      db: postgresAdapter({ pool: { connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`, max: 3 }, schemaName: "arnaud_cms", idType: "uuid", push: true }),
    }) });
    const cms = payload;
    (cms.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0].release();
    const identity = await cms.create({ collection: "cms-users", data: { email: "fixture@example.test" } });
    process.env.SUPABASE_ADMIN_USER_IDS = identity.id;
    const user = { ...identity, collection: "cms-users" as const, _strategy: "supabase" };
    fixtureUser = user;
    const image = await cms.db.create({ collection: "media", data: { filename: "fixture.png", mimeType: "image/png", verified: true, sha256: "a".repeat(64), uploadIdentity: "fixture.png", alt: "Fixture image" } });
    const otherImage = await cms.db.create({ collection: "media", data: { filename: "private.png", mimeType: "image/png", verified: true, sha256: "b".repeat(64), uploadIdentity: "private.png", alt: "Private image" } });
    const audio = await cms.db.create({ collection: "media", data: { filename: "fixture.mp3", mimeType: "audio/mpeg", verified: true, sha256: "c".repeat(64), uploadIdentity: "fixture.mp3" } });
    for (const collection of ["videos", "fashion-projects"].map(slug => slug as CollectionSlug)) {
      let project = await cms.create({ collection, draft: true, user, overrideAccess: false, data: { title: "Private" } as never }) as unknown as Record<string, unknown>;
      assert.equal(project.editRevision, 1);
      assert.equal((await cms.find({ collection, overrideAccess: false })).totalDocs, 0);
      await assert.rejects(cms.update({ collection, id: String(project.id), user, overrideAccess: false, data: { _status: "published", editRevision: project.editRevision } as never }), ValidationError);
      await assert.rejects(cms.update({ collection, id: String(project.id), user, overrideAccess: false, data: { _status: "published", film: image.id, editRevision: project.editRevision } as never }), ValidationError);
      project = await cms.update({ collection, id: String(project.id), user, overrideAccess: false, data: { _status: "published", slug: `${collection}-fixture`, cover: image.id, body: body("Public"), editRevision: project.editRevision } as never }) as unknown as Record<string, unknown>;
      const published = { ...project };
      assert.equal((await cms.find({ collection: "media", overrideAccess: false })).totalDocs, 1);
      project = await cms.update({ collection, id: String(project.id), draft: true, autosave: true, user, overrideAccess: false, data: { title: "Private autosave", cover: otherImage.id, editRevision: project.editRevision } as never }) as unknown as Record<string, unknown>;
      assert.equal((await cms.findByID({ collection, id: String(project.id), draft: true, overrideAccess: false }) as unknown as Record<string, unknown>).title, "Private");
      assert.deepEqual((await cms.find({ collection: "media", overrideAccess: false })).docs.map(item => item.id), [image.id]);
      await assert.rejects(cms.update({ collection, id: String(project.id), draft: true, user, overrideAccess: false, data: { title: "Stale", editRevision: published.editRevision } as never }), /another tab/);
      await assert.rejects(cms.update({ collection, id: String(project.id), draft: true, user, overrideAccess: false, data: { slug: "changed", editRevision: project.editRevision } as never }), ValidationError);
      const versions = await cms.findVersions({ collection, user, overrideAccess: false, sort: "createdAt" });
      const req = await createLocalReq({ user }, cms);
      const restored = await restoreVersionOperation({ collection: cms.collections[collection], id: versions.docs[0].id, draft: true, overrideAccess: false, req }) as unknown as Record<string, unknown>;
      assert.equal(restored._status, "draft");
      assert.equal(restored.slug, published.slug);
      assert.equal((await cms.findByID({ collection, id: String(project.id), depth: 0, overrideAccess: false }) as unknown as Record<string, unknown>).cover, image.id);
      await cms.update({ collection, id: String(project.id), user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } as never });
      assert.equal((await cms.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
    }
    const ordered = await cms.create({ collection: "fashion-projects" as CollectionSlug, user, overrideAccess: false, data: { title: "Ordered frames", _status: "published", turntableFrames: [otherImage.id, image.id] } as never });
    const orderedRead = await cms.findByID({ collection: "fashion-projects" as CollectionSlug, id: ordered.id, depth: 0, overrideAccess: false }) as unknown as Record<string, unknown>;
    assert.deepEqual(orderedRead.turntableFrames, [otherImage.id, image.id]);
    await cms.update({ collection: "fashion-projects" as CollectionSlug, id: ordered.id, user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } as never });
    const slug = "site-settings" as GlobalSlug;
    let settings = await cms.updateGlobal({ slug, draft: true, user, overrideAccess: false, data: { intro: "Private initial" } as never }) as unknown as Record<string, unknown>;
    assert.equal(settings.editRevision, 1);
    const firstVersion = (await cms.findGlobalVersions({ slug, user, overrideAccess: false })).docs[0];
    assert.equal((await cms.findGlobal({ slug, overrideAccess: false }) as unknown as Record<string, unknown>).intro, undefined);
    settings = await cms.updateGlobal({ slug, user, overrideAccess: false, data: { intro: "Public settings", _status: "published", editRevision: settings.editRevision, ambientAudio: audio.id } as never }) as unknown as Record<string, unknown>;
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).docs[0].id, audio.id);
    settings = await cms.updateGlobal({ slug, draft: true, user, overrideAccess: false, data: { intro: "Private settings", ambientAudio: null, editRevision: settings.editRevision } as never }) as unknown as Record<string, unknown>;
    await assert.rejects(cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", editRevision: settings.editRevision, ambientAudio: image.id } as never }), ValidationError);
    await assert.rejects(cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", editRevision: settings.editRevision, socialLinks: [{ label: "Unsafe", url: "javascript:alert(1)" }] } as never }), ValidationError);
    assert.equal((await cms.findGlobal({ slug, overrideAccess: false }) as unknown as Record<string, unknown>).intro, "Public settings");
    await assert.rejects(cms.findGlobal({ slug, draft: true, overrideAccess: false }), /drafts are private/);
    await assert.rejects(cms.updateGlobal({ slug, draft: true, user, overrideAccess: false, data: { intro: "Stale", editRevision: 1 } as never }), /another tab/);
    await assert.rejects(cms.restoreGlobalVersion({ slug, id: firstVersion.id, user, overrideAccess: false }), /private Site Settings restore endpoint/);
    const req = await createLocalReq({ user }, cms);
    const restored = await restoreSiteSettingsVersion(req, String(firstVersion.id)) as unknown as Record<string, unknown>;
    assert.equal(restored._status, "draft");
    assert.equal(restored.intro, "Private initial");
    assert.equal(restored.editRevision, Number(settings.editRevision) + 1);
    assert.equal((await cms.findGlobal({ slug, overrideAccess: false }) as unknown as Record<string, unknown>).intro, "Public settings");
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).docs[0].id, audio.id);
    const restorePath = `/api/globals/site-settings/versions/${firstVersion.id}`;
    const denied = await handleEndpoints({ config: cms.config, path: restorePath, request: new Request(`http://localhost${restorePath}`, { method: "POST" }) });
    assert.equal(denied.status, 403);
    const response = await handleEndpoints({ config: cms.config, path: restorePath, request: new Request(`http://localhost${restorePath}?draft=false`, { method: "POST", headers: { Authorization: "Bearer isolated-fixture" } }) });
    assert.equal(response.status, 200, await response.clone().text());
    const responseDoc = (await response.json()).doc;
    assert.equal(responseDoc._status, "draft");
    assert.equal((await cms.findGlobal({ slug, overrideAccess: false }) as unknown as Record<string, unknown>).intro, "Public settings");
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).docs[0].id, audio.id);
    await cms.updateGlobal({ slug, user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } as never });
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).totalDocs, 0);

    // Homepage images become public through published settings, not their mere
    // presence in Media or an autosaved group. Palette and image changes commit together.
    const home = { palette: { fluidA: "#ff278f", fluidB: "#ffe52f", background: "#c8e6ff" }, photography: { source: "media", image: image.id } };
    settings = await cms.updateGlobal({ slug, user, overrideAccess: false, draft: true, data: { homepage: home, ambientAudio: null, editRevision: responseDoc.editRevision } as never }) as unknown as Record<string, unknown>;
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
    settings = await cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", editRevision: settings.editRevision } as never }) as unknown as Record<string, unknown>;
    assert.deepEqual((await cms.find({ collection: "media", overrideAccess: false })).docs.map(item => item.id), [image.id]);
    const snapshot = (await cms.findGlobalVersions({ slug, user, overrideAccess: false, sort: "-createdAt" })).docs[0];
    settings = await cms.updateGlobal({ slug, user, overrideAccess: false, draft: true, data: { homepage: { palette: { fluidA: "#112233" }, photography: { source: "media", image: otherImage.id } }, editRevision: settings.editRevision } as never }) as unknown as Record<string, unknown>;
    let publicHome = toPublicSiteSettings(await cms.findGlobal({ slug, overrideAccess: false, depth: 1 }));
    assert.equal(publicHome.homepage.palette.fluidA, "#ff278f");
    assert.equal(publicHome.homepage.photography.image?.id, image.id);
    assert.deepEqual((await cms.find({ collection: "media", overrideAccess: false })).docs.map(item => item.id), [image.id]);
    await assert.rejects(cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", homepage: { palette: { fluidA: "url(bad)" } }, editRevision: settings.editRevision } as never }), ValidationError);
    await assert.rejects(cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", homepage: { photography: { source: "media", image: audio.id } }, editRevision: settings.editRevision } as never }), ValidationError);
    await assert.rejects(cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", homepage: { photography: { source: "photograph", photographId: "not-a-photo" } }, editRevision: settings.editRevision } as never }), ValidationError);
    settings = await cms.updateGlobal({ slug, user, overrideAccess: false, data: { _status: "published", editRevision: settings.editRevision } as never }) as unknown as Record<string, unknown>;
    publicHome = toPublicSiteSettings(await cms.findGlobal({ slug, overrideAccess: false, depth: 1 }));
    assert.equal(publicHome.homepage.palette.fluidA, "#112233");
    assert.equal(publicHome.homepage.palette.fluidB, "#ffe52f", "A partial group edit retains the sibling palette role");
    assert.equal(publicHome.homepage.photography.image?.id, otherImage.id);
    assert.deepEqual((await cms.find({ collection: "media", overrideAccess: false })).docs.map(item => item.id), [otherImage.id]);
    await restoreSiteSettingsVersion(await createLocalReq({ user }, cms), String(snapshot.id));
    assert.equal(toPublicSiteSettings(await cms.findGlobal({ slug, overrideAccess: false, depth: 1 })).homepage.photography.image?.id, otherImage.id, "Restore remains private");
    await cms.updateGlobal({ slug, user, overrideAccess: false, unpublishAllLocales: true, data: { _status: "draft" } as never });
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
    delete process.env.ARNAUD_SITE_EXPANSION_ENABLED;
    assert.equal((await cms.find({ collection: "media", overrideAccess: false })).totalDocs, 0);
  } finally {
    if (payload) {
      await payload.destroy();
      await payload.db.pool.end();
    }
    await server.stop();
    await pg.close();
    process.env = env;
  }
});
