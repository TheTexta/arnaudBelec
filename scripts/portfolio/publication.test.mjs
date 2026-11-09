import assert from "node:assert/strict";
import { test } from "node:test";
import { editable, originalUrl, publicationPayload, same, transferSupabase, verifyPhoto } from "./publication.mjs";

test("publication carries every latest editable field, including explicit nulls and empty relationships", () => {
  const current = { title: "Title", slug: "slug", body: { root: { children: [{ type: "text", text: "latest saved content" }] } }, cover: "latest-cover", gallery: [], _status: "draft", firstPublishedAt: null, editRevision: 3 };
  const data = publicationPayload(current, "videos");
  assert.equal(data._status, "published"); assert.equal(data.editRevision, 3); assert.deepEqual(data.body, current.body);
  assert.deepEqual(data.gallery, []); assert.deepEqual(data.turntableFrames, []); assert.equal(data.film, null); assert.equal(data.excerpt, null);
  assert.ok(!("firstPublishedAt" in data));
  for (const invalid of [{ ...current, _status: "published" }, { ...current, firstPublishedAt: "2026-01-01" }, { ...current, editRevision: null }]) assert.throws(() => publicationPayload(invalid, "videos"));
});
test("JSON key ordering does not create false preservation failures, but actual edits stop publication", () => {
  same({ title: "a", body: { version: 1, children: [] } }, { body: { children: [], version: 1 }, title: "a" });
  assert.throws(() => same({ gallery: ["a", "b"] }, { gallery: ["b", "a"] }));
  assert.deepEqual(Object.keys(editable({ title: "Title" }, "posts")), ["title", "slug", "excerpt", "body"]);
});
test("original read-back uses provider-aware canonical paths only", () => {
  const row = { storage_path: "uploads/11111111-2222-4333-8444-555555555555.jpg", storage_provider: "supabase" };
  assert.match(originalUrl(row), /^https:\/\/api.dextery.dev\/storage/);
  assert.match(originalUrl({ ...row, storage_provider: "r2" }), /^https:\/\/media.dextery.dev\/arnaudbelec/);
  assert.throws(() => originalUrl({ ...row, storage_provider: "unknown" }));
  assert.throws(() => originalUrl({ ...row, storage_path: "uploads/../private.jpg" }));
});
test("photo acceptance rejects metadata, provider, capture-date and palette mismatches", () => {
  const photo = { filename: "photo.jpg", width: 1920, height: 1080, altText: "Descriptive alt", title: "Source collection 01", sortOrder: 1 };
  const record = { id: "id", path: "uploads/id.jpg" };
  const row = { id: record.id, filename: photo.filename, storage_path: record.path, storage_provider: "supabase", image_width: 1920, image_height: 1080,
    alt_text: photo.altText, title: photo.title, sort_order: 1, captured_at: null, palette: [{ hex: "#ffffff" }], background_hex: "#000000" };
  verifyPhoto(row, photo, record);
  for (const diff of [{ id: "other" }, { storage_path: "other" }, { storage_provider: "r2" }, { captured_at: "2026-01-01" }, { palette: [] }, { alt_text: "changed" }]) assert.throws(() => verifyPhoto({ ...row, ...diff }, photo, record));
});

test("standard transfer uses only the native signed path capability and never enables overwrite", async t => {
  const source = Buffer.from("synthetic-original");
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input); assert.equal(url.origin, "https://storage.example.test");
    assert.equal(url.pathname, "/storage/v1/object/upload/sign/arnaudbelec/uploads/test.jpg");
    assert.equal(url.searchParams.get("token"), "synthetic-signed-capability");
    assert.equal(init.method, "PUT"); const headers = new Headers(init.headers);
    assert.equal(headers.get("x-upsert"), "false"); assert.equal(headers.get("content-type"), "image/jpeg");
    assert.equal(headers.get("authorization"), "Bearer synthetic-anon-key"); assert.equal(init.body, source);
    return new Response(JSON.stringify({ Key: "arnaudbelec/uploads/test.jpg" }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  await transferSupabase(source, { path: "uploads/test.jpg", token: "synthetic-signed-capability", mimeType: "image/jpeg" },
    { url: "https://storage.example.test", anonKey: "synthetic-anon-key" }, "unused-for-success.json");
});
