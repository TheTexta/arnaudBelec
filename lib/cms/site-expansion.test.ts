import assert from "node:assert/strict";
import { test } from "node:test";
import type { PayloadRequest } from "payload";
import { Media } from "./media";
import { FashionProjects, projectMediaUses, Videos } from "./projects";
import { SiteSettings, validContactEmail, validPhotoId, validSocialUrl } from "./site-settings";
import { siteExpansionEnabled, siteRead, validateSiteMedia } from "./site-access";
import { privateRestoreRequest } from "./restore";
import { getPublicProject, getPublicProjects, getPublicSiteSettings, toPublicProject, toPublicSiteSettings } from "../site/public";
import { defaultSiteSettings } from "../site/types";
import { homepageMediaUses, homepagePhotographs, validHomeColour } from "./homepage";

const id = "12345678-1234-4234-8234-123456789abc";
const image = { id, filename: "image.png", verified: true, sha256: "a".repeat(64), mimeType: "image/png", alt: "An image", url: "https://private.invalid/signed", uploadIdentity: "secret-key" };

test("site expansion readiness is explicit; disabled public readers never initialize Payload", async () => {
  const env = { ...process.env };
  try {
    assert.equal(siteExpansionEnabled({ ARNAUD_CMS_ENABLED: "true" }), false);
    assert.equal(siteExpansionEnabled({ ARNAUD_SITE_EXPANSION_ENABLED: "true" }), false);
    assert.equal(siteExpansionEnabled({ ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true" }), true);
    process.env.ARNAUD_CMS_ENABLED = "true";
    delete process.env.ARNAUD_SITE_EXPANSION_ENABLED;
    process.env.ARNAUD_CMS_DATABASE_URL = "postgresql://127.0.0.1:1/must-not-connect";
    assert.deepEqual(await getPublicProjects("video"), []);
    assert.equal(await getPublicProject("fashion", "fixture"), null);
    assert.deepEqual(await getPublicSiteSettings(), defaultSiteSettings);
    assert.equal(siteRead({ req: { user: null } as PayloadRequest }), false);
    for (const config of [Videos, FashionProjects, SiteSettings]) {
      assert.equal(typeof config.admin?.hidden === "function" && config.admin.hidden({ user: null } as never), true);
      const hook = config.hooks!.beforeOperation![0];
      await assert.rejects(async () => hook({ args: {}, operation: "read", req: { context: {} } } as never), /not enabled/);
    }
    const mediaRead = Media.access!.read!;
    const queries: string[] = [];
    const req = { user: null, payload: { find: async ({ collection }: { collection: string }) => { queries.push(collection); return { docs: [] }; }, findGlobal: () => assert.fail("Disabled gate queried a global") } } as unknown as PayloadRequest;
    await mediaRead({ req });
    assert.deepEqual(queries, ["posts"]);
  } finally { process.env = env; }
});

test("field validators accept only UUID curation, plain email and safe https/mail links", () => {
  assert.equal(validPhotoId(id), true);
  assert.equal(validPhotoId(""), true);
  assert.notEqual(validPhotoId("photo.jpg"), true);
  assert.equal(validContactEmail("arnaud@example.test"), true);
  assert.notEqual(validContactEmail("mailto:arnaud@example.test"), true);
  for (const url of ["https://example.test/path", "mailto:arnaud@example.test"]) assert.equal(validSocialUrl(url), true);
  for (const url of ["javascript:alert(1)", "http://example.test", "//example.test", "https://user:password@example.test", "mailto:arnaud@example.test?body=bad", "mailto:", "https://example.test\n"]) assert.notEqual(validSocialUrl(url), true, url);
});

test("project references include ordered upload fields and Lexical uploads, never client mediaReferences", async () => {
  const uses = projectMediaUses({ cover: image, film: id, gallery: [id], turntableFrames: [id, id], body: { root: { type: "root", children: [{ type: "upload", relationTo: "media", value: id }] } }, mediaReferences: ["forged"] });
  assert.deepEqual(uses.map(use => use.kind), ["image", "video", "image", "image", "image", undefined]);
  assert.deepEqual(projectMediaUses({}), []);
  assert.throws(() => projectMediaUses({ cover: { id: 5 } }), /verified media/);
  assert.throws(() => projectMediaUses({ body: { root: { type: "root", children: [{ type: "upload", relationTo: "cms-users", value: id }] } } }));
  const env = { ...process.env };
  try {
    Object.assign(process.env, { ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true" });
    let selected = { ...image };
    const req = { payload: { find: async () => ({ docs: [selected] }) } } as unknown as PayloadRequest;
    assert.deepEqual(await validateSiteMedia(req, [{ id, kind: "image" }], true), [id]);
    await assert.rejects(validateSiteMedia(req, [{ id, kind: "video" }], false), /video media/);
    selected = { ...image, sha256: "forged" };
    await assert.rejects(validateSiteMedia(req, [{ id }], true), /verified original/);
    selected = { ...image, verified: false };
    await assert.rejects(validateSiteMedia(req, [{ id }], false), /verified original/);
    selected = { ...image, alt: "" };
    assert.deepEqual(await validateSiteMedia(req, [{ id }], false), [id]);
    await assert.rejects(validateSiteMedia(req, [{ id }], true), /description/);
    const unavailable = new Error("Database unavailable");
    const writeReq = { context: {}, user: { id, collection: "cms-users", _strategy: "supabase" }, payload: { find: async () => { throw unavailable; } } } as unknown as PayloadRequest;
    process.env.SUPABASE_ADMIN_USER_IDS = id;
    await Videos.hooks!.beforeOperation![0]({ operation: "create", args: {}, req: writeReq } as never);
    await assert.rejects(async () => Videos.hooks!.beforeChange![0]({ operation: "create", data: { cover: id, _status: "published" }, req: writeReq } as never), error => error === unavailable, "Infrastructure failures must not be disguised as validation errors");
  } finally { process.env = env; }
});

test("anonymous Media union reads only current published rows, never versions or settings drafts", async () => {
  const env = { ...process.env };
  try {
    Object.assign(process.env, { ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true" });
    const queries: string[] = [];
    let published = true;
    const req = { user: null, payload: {
      find: async (options: { collection: string; draft: boolean; depth: number; where: unknown }) => {
        queries.push(options.collection);
        assert.equal(options.draft, false);
        assert.equal(options.depth, 0);
        assert.deepEqual(options.where, { _status: { equals: "published" } });
        return { docs: [{ mediaReferences: [options.collection] }] };
      },
      findGlobal: async (options: { draft: boolean; depth: number }) => {
        queries.push("site-settings");
        assert.equal(options.draft, false);
        assert.equal(options.depth, 0);
        return { _status: published ? "published" : "draft", mediaReferences: ["ambient"] };
      },
    } } as unknown as PayloadRequest;
    const result = await Media.access!.read!({ req });
    assert.deepEqual(queries, ["posts", "videos", "fashion-projects", "site-settings"]);
    assert.deepEqual(result, { and: [{ verified: { equals: true } }, { id: { in: ["posts", "videos", "fashion-projects", "ambient"] } }] });
    published = false;
    assert.doesNotMatch(JSON.stringify(await Media.access!.read!({ req })), /ambient/);
  } finally { process.env = env; }
});

test("public DTOs omit private media metadata, preserve frame order and isolate curation lists", () => {
  const raw = { id, title: "Fixture", cover: image, turntableFrames: [{ ...image, id: "second" }, image], body: { root: { type: "root", children: [{ type: "upload", relationTo: "media", value: image }] } } };
  const project = toPublicProject(raw, "fashion");
  assert.equal(project.cover?.url, "/api/cms/media/file/image.png");
  assert.deepEqual(project.turntableFrames.map(frame => frame.id), ["second", id]);
  assert.doesNotMatch(JSON.stringify(project), /secret-key|sha256|private.invalid|uploadIdentity/);
  assert.equal(raw.body.root.children[0].value.uploadIdentity, "secret-key", "Mapping must not mutate Payload documents");
  const settings = toPublicSiteSettings({ colourPhotoIds: [{ photographId: id }, { photographId: id }], monochromePhotoIds: [], ambientAudio: { ...image, mimeType: "audio/mpeg" }, newsletterEnabled: false });
  assert.deepEqual(settings.colourPhotoIds, [id]);
  assert.deepEqual(settings.monochromePhotoIds, []);
  assert.equal(settings.newsletterEnabled, false);
  const home = toPublicSiteSettings({ homepage: { palette: { fluidA: "url(bad)", background: "#000000" }, photography: { source: "media", image }, journal: { source: "none", image } } });
  assert.equal(home.homepage.palette.fluidA, "#ff278f");
  assert.equal(home.homepage.photography.image?.url, "/api/cms/media/file/image.png");
  assert.equal(home.homepage.journal.image, null);
  assert.doesNotMatch(JSON.stringify(home), /secret-key|sha256|private.invalid|uploadIdentity/);
});

test("homepage validates palette/source values, tracks only active image references and protects its catalogue picker", async () => {
  assert.equal(validHomeColour("#FF278F"), true);
  assert.notEqual(validHomeColour("red"), true);
  assert.deepEqual(await homepageMediaUses({ photography: { source: "none", image: id }, journal: { source: "media", image: id } }, true), [{ id, kind: "image" }]);
  await assert.rejects(homepageMediaUses({ palette: { fluidA: "url(bad)" } }, true), /hex colour/);
  await assert.rejects(homepageMediaUses({ photography: { source: "media" } }, true), /Choose an image/);
  await assert.rejects(homepageMediaUses({ photography: { source: "unsafe" } }, false), /supported image source/);
  await assert.rejects(homepagePhotographs({ user: null } as PayloadRequest), /Sign in/);
});

test("project REST restores are normalized private; unsafe native settings restore is rejected", async () => {
  for (const collection of ["videos", "fashion-projects"]) {
    const request = new Request(`http://localhost/api/cms/${collection}/versions/${id}?draft=false`, { method: "POST" });
    assert.equal(new URL(privateRestoreRequest(request, [collection, "versions", id]).url).searchParams.get("draft"), "true");
  }
  const env = { ...process.env };
  try {
    Object.assign(process.env, { ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true" });
    const hook = SiteSettings.hooks!.beforeOperation![0];
    await assert.rejects(async () => hook({ args: { draft: true }, operation: "restoreVersion", req: { context: {} } } as never), /private Site Settings restore endpoint/);
    await assert.rejects(async () => hook({ args: { draft: true }, operation: "read", req: { user: null, context: {} } } as never), /drafts are private/);
  } finally { process.env = env; }
});
