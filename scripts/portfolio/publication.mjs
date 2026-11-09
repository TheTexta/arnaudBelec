// Owner-approved, scoped publication using native CMS and photograph endpoints.
// No schema/config changes, privileged storage writes, deletion or deployment.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { cmsOrigin, importSession, publicStorageConfiguration } from "./operator-session.mjs";
import { api, nativeInventory } from "./upload.mjs";

export const sha = value => createHash("sha256").update(value).digest("hex");
export const saveNew = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
export async function checkpoint(file, value) {
  await writeFile(`${file}.writing`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(`${file}.writing`, file);
}
export const canonical = value => JSON.stringify(value, (key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
export const same = (a, b) => assert.equal(canonical(a), canonical(b), "Pinned content changed; stop rather than overwrite.");

export async function catalogue(config) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const query = new URLSearchParams({ select: "*,palette:arnaud_photo_palette_colours(rank,hex,lab_l,lab_a,lab_b,weight)", order: "id.asc", limit: "500", offset: String(offset) });
    const r = await fetch(`${config.url}/rest/v1/arnaud_photographs?${query}`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` }, signal: AbortSignal.timeout(60000) });
    assert.equal(r.status, 200); const batch = await r.json(); assert.ok(Array.isArray(batch)); rows.push(...batch);
    if (batch.length < 500) return rows;
    assert.ok(offset < 10000);
  }
}
export function originalUrl(row) {
  assert.match(row.storage_path, /^uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
  assert.ok(["supabase", "r2"].includes(row.storage_provider));
  return row.storage_provider === "r2" ? `https://media.dextery.dev/arnaudbelec/${row.storage_path}` : `https://api.dextery.dev/storage/v1/object/public/arnaudbelec/${row.storage_path}`;
}
export async function readback(row, expected) {
  const r = await fetch(originalUrl(row), { redirect: "error", signal: AbortSignal.timeout(180000) }); assert.equal(r.status, 200);
  const hash = createHash("sha256"); let bytes = 0;
  for await (const chunk of r.body) { bytes += chunk.length; assert.ok(bytes <= expected.bytes); hash.update(chunk); }
  assert.equal(bytes, expected.bytes); assert.equal(hash.digest("hex"), expected.sha256);
}

const commonFields = ["title", "slug", "excerpt", "body"];
export function editable(doc, collection) {
  const fields = collection === "posts" ? commonFields : [...commonFields, "cover", "film", "gallery", "turntableFrames", "credits", "year"];
  // Include nulls and empty arrays: publishing status alone can resurrect stale main-row fields.
  return Object.fromEntries(fields.map(field => [field, doc[field] ?? (["gallery", "turntableFrames"].includes(field) ? [] : null)]));
}
export function publicationPayload(doc, collection) {
  assert.equal(doc._status, "draft"); assert.ok(!doc.firstPublishedAt); assert.ok(Number.isSafeInteger(doc.editRevision));
  return { ...editable(doc, collection), _status: "published", editRevision: doc.editRevision };
}
async function disabledNewsletter(request) {
  const { data } = await request("/api/cms/globals/site-settings?depth=0&draft=false");
  assert.equal(data.newsletterEnabled, false, "Newsletter must remain disabled before publishing.");
  return data;
}
export async function publishDrafts(audit, sessionDirectory, confirmation) {
  const bytes = await readFile(join(audit, "publication-plan.json")); assert.equal(sha(bytes), confirmation);
  const plan = JSON.parse(bytes); assert.equal(plan.origin, cmsOrigin);
  assert.deepEqual(plan.drafts.map(d => d.slug).sort(), ["digital-tableaux", "phassion", "sunday-missile", "tableaux", "xix-visuals-for-december"]);
  const request = api(await importSession(sessionDirectory));
  await disabledNewsletter(request);
  const journalPath = join(audit, "draft-publication.json");
  let journal;
  try { journal = JSON.parse(await readFile(journalPath, "utf8")); same(journal.planSha256, confirmation); }
  catch (e) { if (e.code !== "ENOENT") throw e; journal = { planSha256: confirmation, drafts: [], completed: false }; await saveNew(journalPath, journal); }
  for (const target of plan.drafts) {
    const { data: current } = await request(`/api/cms/${target.collection}/${target.id}?depth=0&draft=true`);
    same(editable(current, target.collection), target.content);
    let record = journal.drafts.find(d => d.id === target.id);
    if (current._status !== "published") {
      assert.ok(!record, "Uncertain publication requires explicit reconciliation, not a blind retry.");
      same(current.editRevision, target.editRevision);
      await disabledNewsletter(request);
      record = { id: target.id, slug: target.slug, state: "publishing" }; journal.drafts.push(record); await checkpoint(journalPath, journal);
      await request(`/api/cms/${target.collection}/${target.id}?depth=0`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publicationPayload(current, target.collection)) });
    } else assert.ok(record, "Unexpected intervening publication; stop for review.");
    const response = await fetch(`${cmsOrigin}/api/cms/${target.collection}/${target.id}?depth=0`, { signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200); const published = await response.json();
    assert.equal(published._status, "published"); assert.ok(published.firstPublishedAt); same(editable(published, target.collection), target.content);
    const prefix = target.collection === "posts" ? "/blog" : target.collection === "videos" ? "/video" : "/fashion";
    const page = await fetch(`${cmsOrigin}${prefix}/${target.slug}`, { signal: AbortSignal.timeout(60000) }); assert.equal(page.status, 200); await page.arrayBuffer();
    Object.assign(record, { state: "verified-public", href: `${prefix}/${target.slug}`, verifiedAt: new Date().toISOString() }); await checkpoint(journalPath, journal);
  }
  const after = await nativeInventory(await importSession(sessionDirectory));
  for (const [collection, docs] of Object.entries(plan.cmsBaseline)) for (const doc of docs) {
    if (!plan.drafts.some(d => d.id === doc.id)) same(after[collection].find(d => d.id === doc.id), doc);
  }
  same(await disabledNewsletter(request), plan.settings);
  journal.completed = true; journal.otherRecordsPreserved = true; await checkpoint(journalPath, journal);
  return { published: journal.drafts.length, otherRecordsPreserved: true, newsletterEnabled: false };
}

export function verifyPhoto(row, photo, record) {
  assert.equal(row.id, record.id); assert.equal(row.filename, photo.filename); assert.equal(row.storage_path, record.path); assert.equal(row.storage_provider, "supabase");
  assert.equal(row.image_width, photo.width); assert.equal(row.image_height, photo.height);
  assert.equal(row.alt_text, photo.altText); assert.equal(row.title, photo.title); assert.equal(row.sort_order, photo.sortOrder); assert.equal(row.captured_at, null);
  assert.ok(row.palette.length >= 1 && row.palette.length <= 7 && /^#[0-9a-f]{6}$/i.test(row.background_hex));
}
async function adminRequest(sessionDirectory, path, options) {
  assert.ok(["/api/admin/uploads/prepare", "/api/admin/uploads/publish"].includes(path));
  const session = await importSession(sessionDirectory);
  const r = await fetch(cmsOrigin + path, { ...options, redirect: "error", headers: { Authorization: `Bearer ${session.accessToken}`, Origin: cmsOrigin, ...options.headers }, signal: AbortSignal.timeout(300000) });
  const data = await r.json().catch(() => null);
  assert.ok(r.status === 200, `Photo native request HTTP ${r.status}; reconcile journal before retry.`);
  return data;
}
export async function transferSupabase(source, prepared, config, privatePath) {
  // Storage v1.14.6 rejects signed TUS requests. Use the standard signed-upload
  // capability issued by native prepare instead; never elevate roles or change RLS.
  const client = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(180000), redirect: "error" }) } });
  const { data, error } = await client.storage.from("arnaudbelec").uploadToSignedUrl(prepared.path, prepared.token, source,
    { contentType: prepared.mimeType, cacheControl: "31536000", upsert: false });
  if (error) {
    prepared.lastSignedUploadError = { name: error.name, status: error.statusCode, message: error.message };
    await checkpoint(privatePath, prepared);
    throw new Error("Signed transfer stopped; reconcile the existing path/ticket.");
  }
  assert.equal(data.path, prepared.path);
}
export async function publishPhotos(audit, sessionDirectory, confirmation) {
  const planBytes = await readFile(join(audit, "publication-plan.json")); assert.equal(sha(planBytes), confirmation);
  const plan = JSON.parse(planBytes); assert.equal(plan.origin, cmsOrigin); assert.equal(plan.photos.length, 78);
  const config = await publicStorageConfiguration();
  const journalPath = join(audit, "photo-publication.json");
  let journal;
  try { journal = JSON.parse(await readFile(journalPath, "utf8")); same(journal.planSha256, confirmation); }
  catch (e) { if (e.code !== "ENOENT") throw e; journal = { planSha256: confirmation, photos: [], completed: false }; await saveNew(journalPath, journal); }
  let rows = await catalogue(config);
  for (const before of plan.photoBaseline) same(rows.find(r => r.id === before.id), before);
  for (const photo of plan.photos) {
    // Never allocate a replacement ticket when an existing transfer is uncertain.
    let record = journal.photos.find(p => p.assetId === photo.assetId);
    let published = rows.find(r => r.filename === photo.filename);
    if (published) {
      assert.ok(record?.id, "Filename appeared without our known ticket; stop for review.");
      verifyPhoto(published, photo, record); await readback(published, photo);
      record.state = "verified-public"; await checkpoint(journalPath, journal); continue;
    }
    assert.ok(!record || ["uploaded", "confirmed-absent-expired"].includes(record.state), "Unfinished photo transfer requires explicit ticket reconciliation.");
    const source = await readFile(join(plan.imageDirectory, photo.file)); assert.equal(sha(source), photo.sha256); assert.equal(source.length, photo.bytes);
    const sample = await readFile(join(audit, photo.sample)); assert.equal(sha(sample), photo.sampleSha256);
    // Recheck new filename and preservation just before reserving/uploading.
    rows = await catalogue(config); assert.ok(!rows.some(r => r.filename === photo.filename));
    const privatePath = join(sessionDirectory, `photo-${photo.assetId}.private.json`);
    const resumeUploaded = record?.state === "uploaded";
    if (!record) { record = { assetId: photo.assetId, filename: photo.filename, state: "preparing" }; journal.photos.push(record); await checkpoint(journalPath, journal); }
    const prepared = resumeUploaded ? JSON.parse(await readFile(privatePath, "utf8")) : await adminRequest(sessionDirectory, "/api/admin/uploads/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: photo.filename, size: photo.bytes }) });
    assert.ok(prepared.provider !== "r2" && typeof prepared.token === "string", "Provider changed; stop for review, do not migrate providers.");
    const ticket = JSON.parse(Buffer.from(prepared.ticket.split(".")[0], "base64url").toString());
    assert.equal(ticket.filename, photo.filename); assert.equal(ticket.size, photo.bytes);
    assert.match(ticket.photographId, /^[0-9a-f-]{36}$/); assert.equal(prepared.path, `uploads/${ticket.photographId}.${photo.filename.split(".").pop()}`);
    if (resumeUploaded) { assert.equal(record.id, ticket.photographId); assert.equal(record.path, prepared.path); await readback({ storage_path: record.path, storage_provider: record.provider }, photo); }
    else {
      Object.assign(record, { id: ticket.photographId, path: prepared.path, provider: "supabase", state: "prepared" });
      prepared.mimeType = photo.mimeType;
      await saveNew(privatePath, prepared); await checkpoint(journalPath, journal);
      await transferSupabase(source, prepared, config, privatePath);
    }
    record.state = "uploaded"; await checkpoint(journalPath, journal);
    const form = new FormData(); form.set("ticket", prepared.ticket); form.set("width", String(photo.width)); form.set("height", String(photo.height));
    form.set("sample", new Blob([sample], { type: "image/png" }), "sample.png"); form.set("title", photo.title); form.set("altText", photo.altText);
    form.set("capturedAt", ""); form.set("sortOrder", String(photo.sortOrder));
    record.state = "publishing"; await checkpoint(journalPath, journal);
    const result = await adminRequest(sessionDirectory, "/api/admin/uploads/publish", { method: "POST", body: form });
    assert.equal(result.filename, photo.filename); assert.equal(result.href, `/photos/${encodeURIComponent(photo.filename)}`);
    rows = await catalogue(config); published = rows.find(r => r.id === record.id); assert.ok(published);
    verifyPhoto(published, photo, record); await readback(published, photo);
    record.state = "verified-public"; record.sha256 = photo.sha256; record.bytes = photo.bytes; record.href = result.href; await checkpoint(journalPath, journal);
    console.log(JSON.stringify({ photographsPublished: journal.photos.filter(p => p.state === "verified-public").length, total: plan.photos.length, originalReadbackVerified: true }));
  }
  rows = await catalogue(config);
  for (const before of plan.photoBaseline) same(rows.find(r => r.id === before.id), before);
  assert.equal(rows.length, plan.photoBaseline.length + plan.photos.length);
  assert.ok(journal.photos.length === plan.photos.length && journal.photos.every(p => p.state === "verified-public"));
  journal.completed = true; journal.existingRowsAndPalettesPreserved = true; await checkpoint(journalPath, journal);
  await saveNew(join(audit, "photos-after.json"), rows);
  return { published: journal.photos.length, catalogueTotal: rows.length, existingRowsAndPalettesPreserved: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, audit, sessionDirectory, confirmation] = process.argv.slice(2);
  try {
    assert.ok(confirmation?.startsWith("--confirm="));
    const fn = action === "drafts" ? publishDrafts : action === "photos" ? publishPhotos : null; assert.ok(fn);
    console.log(JSON.stringify(await fn(audit, sessionDirectory, confirmation.slice(10)), null, 2));
  } catch (error) {
    console.error(`Publication stopped (${error.code || error.name}); reconcile the durable journal. No credentials or signed URLs printed.`);
    process.exitCode = 1;
  }
}
