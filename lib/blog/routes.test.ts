import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as list, POST as create } from "../../app/api/admin/posts/route";
import { GET as read, PUT as save } from "../../app/api/admin/posts/[id]/route";
import { POST as publish, DELETE as unpublish } from "../../app/api/admin/posts/[id]/publish/route";
import { POST as media } from "../../app/api/admin/posts/[id]/media/route";
import { GET as revisions } from "../../app/api/admin/posts/[id]/revisions/route";
import { GET as publicMedia } from "../../app/blog/media/[id]/route";
import { EMPTY_BODY } from "./document";

const id = "12345678-1234-1234-1234-123456789abc";
const context = { params: Promise.resolve({ id }) };
const values = { SUPABASE_URL: "https://supabase.example.test", NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon", SUPABASE_SERVICE_ROLE_KEY: "test-service", SUPABASE_ADMIN_USER_IDS: id, ARNAUD_BLOG_UPLOADS_ENABLED: "false", R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "test-key", R2_SECRET_ACCESS_KEY: "test-secret" };

async function environment(run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  const fetch = globalThis.fetch;
  Object.assign(process.env, values);
  try { await run(); }
  finally {
    globalThis.fetch = fetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

test("every admin endpoint rejects unauthenticated requests before parsing, database or R2", async () => environment(async () => {
  globalThis.fetch = async () => assert.fail("No remote access before authorization");
  const endpoints = [list, create, read, save, publish, unpublish, media, revisions];
  for (const endpoint of endpoints) {
    const response = await endpoint(new Request("https://app.example.test/api/admin/posts", { method: "POST", body: "not-json" }), context);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
}));

test("a valid Supabase identity without site allowlist membership cannot reach any blog data", async () => environment(async () => {
  globalThis.fetch = async (input) => {
    assert.match(String(input), /\/auth\/v1\/user/);
    return Response.json({ id: "22345678-1234-1234-1234-123456789abc", email: "other@example.test" });
  };
  for (const endpoint of [save, media, publish]) {
    const response = await endpoint(new Request("https://app.example.test/api/admin/posts", { method: "POST", headers: { Authorization: "Bearer test-access" }, body: "{}" }), context);
    assert.equal(response.status, 403);
  }
}));

test("disabled journal uploads reject every write action before reservation or storage access", async () => environment(async () => {
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id });
    assert.match(url, /\/rest\/v1\/arnaud_blog_posts\?/);
    return Response.json({ id });
  };
  for (const action of ["prepare", "parts", "complete"]) {
    const response = await media(new Request("https://app.example.test/api/admin/posts/media", { method: "POST", headers: { Authorization: "Bearer test-access" }, body: JSON.stringify({ action, mediaId: id, filename: "photo.jpg", size: 10 }) }), context);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not enabled/);
  }
}));

test("verified private previews remain available while new journal uploads are disabled", async () => environment(async () => {
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id });
    if (url.includes("/arnaud_blog_posts?")) return Response.json({ id });
    assert.match(url, /\/rest\/v1\/arnaud_blog_media\?/);
    return Response.json({ id, post_id: id, state: "ready", storage_path: `blog/${id}.jpg`, content_type: "image/jpeg" });
  };
  const response = await media(new Request("https://app.example.test/api/admin/posts/media", { method: "POST", headers: { Authorization: "Bearer test-access" }, body: JSON.stringify({ action: "read", mediaId: id }) }), context);
  assert.equal(response.status, 200);
  const signed = new URL((await response.json()).url);
  assert.equal(signed.pathname, `/arnaudbelec-staging/blog/${id}.jpg`);
  assert.equal(signed.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
}));

test("enabled uploads cannot sign media outside the current post or an expired reservation", async () => environment(async () => {
  process.env.ARNAUD_BLOG_UPLOADS_ENABLED = "true";
  let missing = true;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id });
    if (url.includes("/arnaud_blog_posts?")) return Response.json({ id });
    assert.match(url, /\/rest\/v1\/arnaud_blog_media\?/);
    assert.ok(new URL(url).searchParams.get("post_id") === `eq.${id}`);
    return Response.json(missing ? null : { id, post_id: id, state: "uploading", storage_path: `blog/${id}.jpg`, content_type: "image/jpeg", created_at: "2000-01-01T00:00:00Z" });
  };
  const request = () => new Request("https://app.example.test/api/admin/posts/media", { method: "POST", headers: { Authorization: "Bearer test-access" }, body: JSON.stringify({ action: "parts", mediaId: id, partNumber: 1 }) });
  assert.equal((await media(request(), context)).status, 404);
  missing = false;
  const expired = await media(request(), context);
  assert.equal(expired.status, 410);
  assert.equal((await expired.json()).code, "upload_expired");
}));

test("the public media gateway uses anonymous RLS and never signs private or unreferenced media", async () => environment(async () => {
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /\/rest\/v1\/arnaud_blog_media/);
    assert.equal(new Headers(init?.headers).get("apikey"), "test-anon");
    return Response.json(null);
  };
  const response = await publicMedia(new Request("https://app.example.test/blog/media"), context);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Location"), null);
}));

test("save responds with that write's exact version, never a subsequent writer's version", async () => environment(async () => {
  const document = { title: "My edit", slug: "my-post", excerpt: "", body: EMPTY_BODY };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id });
    if (url.includes("/rpc/arnaud_save_blog_post")) {
      assert.equal(JSON.parse(init?.body as string).p_version, 1);
      return Response.json({ ...document, id, version: 2, updated_at: "2026-10-30T00:00:00Z", first_published_at: null });
    }
    assert.match(url, /\/arnaud_blog_publications\?/);
    // Another writer could already have moved publication/draft metadata on.
    return Response.json({ slug: "my-post", source_version: 3 });
  };
  const response = await save(new Request("https://app.example.test/api/admin/posts", { method: "PUT", headers: { Authorization: "Bearer test-access" }, body: JSON.stringify({ ...document, version: 1 }) }), context);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).post.version, 2);
}));
