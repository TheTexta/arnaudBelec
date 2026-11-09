// Explicit, hash-confirmed PRIVATE content import through the deployed native API.
// Never publishes, PATCHes existing content, uses storage credentials, or injects verification.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cmsOrigin, importSession } from "./operator-session.mjs";
import { descriptions, document, importGroups, journalBody, linkedParagraph, paragraph, youtubeCopy } from "./editorial.mjs";
import { groupForImage, groups } from "./mapping.mjs";
import { verifyBundle } from "./prepare.mjs";
import { parsePage } from "./source.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const writeJSON = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
const fingerprint = doc => hash(Buffer.from(JSON.stringify(doc)));
const collections = ["media", "posts", "videos", "fashion-projects"];

export function api(session) {
  return async (path, options = {}) => {
    assert.ok(path.startsWith("/api/cms/"));
    const response = await fetch(cmsOrigin + path, { ...options, redirect: "manual", headers: { Authorization: `Bearer ${session.accessToken}`, Origin: cmsOrigin, ...options.headers }, signal: AbortSignal.timeout(180000) });
    const data = await response.json().catch(() => null);
    assert.ok([200, 201].includes(response.status), `Native API returned HTTP ${response.status}; stop and reconcile the journal.`);
    return { status: response.status, data };
  };
}

export async function parsedSourceBundle(directory, manifest) {
  // Reparse pinned raw snapshots, rather than treating an earlier parser's
  // template-inclusive placements as authoritative visible gallery occurrences.
  const pages = await Promise.all(manifest.pages.map(async page => ({ ...parsePage(await readFile(join(directory, page.snapshot), "utf8"), page.path), snapshot: page.snapshot, snapshotSha256: page.snapshotSha256 })));
  const placements = new Map();
  for (const page of pages) for (const [index, image] of page.images.entries()) {
    if (!placements.has(image.id)) placements.set(image.id, []);
    placements.get(image.id).push({ page: page.path, group: groupForImage(page, image), order: index + 1,
      role: page.path === "/work" ? "collection-cover" : ["/contact", "/previous-service-request"].includes(page.path) ? "placement-review" : "content" });
  }
  const assets = manifest.assets.map(asset => ({ ...asset, placements: [...asset.placements.filter(item => item.role === "background"), ...(placements.get(asset.id) || [])] }));
  return { ...manifest, pages, assets };
}

export function validateUploadScope(plan) {
  if (plan.scope === "unassigned-journal-media-only") {
    assert.equal(plan.drafts.length, 0, "Library-only intake cannot create editorial content.");
    assert.ok(plan.media.length > 0 && plan.media.length <= 19);
    assert.ok(plan.media.every(item => item.group === "placement-review"));
    assert.ok(plan.media.filter(item => item.bundle === "images").length <= 17);
    assert.ok(plan.media.filter(item => item.bundle === "videos").length <= 2);
    assert.equal(new Set(plan.media.map(item => item.sha256)).size, plan.media.length);
  } else {
    assert.ok(!plan.scope, "Unknown intake scope.");
    assert.ok(plan.media.every(item => importGroups.includes(item.group)));
  }
}

export async function nativeInventory(session) {
  const request = api(session), result = {};
  for (const collection of collections) {
    const docs = [];
    for (let page = 1; ; page++) {
      assert.ok(page <= 20, "Unexpected inventory pagination.");
      const { data } = await request(`/api/cms/${collection}?limit=100&page=${page}&depth=0&draft=true`);
      assert.ok(Array.isArray(data?.docs));
      docs.push(...data.docs);
      if (!data.hasNextPage) break;
    }
    result[collection] = docs;
  }
  return result;
}

export function buildSelection(images, videos, inventory) {
  const selected = images.assets.filter(asset => asset.status === "staged" && asset.placements.some(p => importGroups.includes(p.group)));
  const media = selected.map(asset => {
    assert.ok(descriptions[asset.id], "Selected image needs a visually reviewed description.");
    const existing = inventory.media.filter(doc => doc.sha256 === asset.sha256 && doc.filesize === asset.bytes && doc.verified);
    return { assetId: asset.id, bundle: "images", file: asset.file, sha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType,
      alt: descriptions[asset.id], caption: "", existingId: existing[0]?.id || null, group: asset.placements.find(p => importGroups.includes(p.group)).group };
  });
  const film = videos.videos.find(video => video.id === "An-nBB7Dn58" && video.status === "staged");
  assert.ok(film, "Verified XIX clip is missing.");
  const existingFilm = inventory.media.find(doc => doc.sha256 === film.sha256 && doc.filesize === film.bytes && doc.verified);
  media.push({ assetId: `adobe:${film.id}`, bundle: "videos", file: film.file, sha256: film.sha256, bytes: film.bytes, mimeType: "video/mp4", alt: "", caption: "", group: "xix-visuals-for-december", existingId: existingFilm?.id || null });
  const drafts = [];
  for (const key of importGroups) {
    const group = groups[key];
    const sourcePage = images.pages.find(page => page.path === (key === "phassion" ? "/copie-de-sewing" : key === "xix-visuals-for-december" ? "/fondation-multicaf-2024" : `/${key}`));
    assert.ok(sourcePage, "Missing reviewed source page.");
    const ordered = sourcePage.images.filter(image => selected.some(asset => asset.id === image.id && asset.placements.some(p => p.group === key))).map(image => image.id);
    assert.ok(ordered.length, "Empty selected project.");
    const matching = inventory[group.kind].filter(doc => doc.slug === key);
    assert.equal(matching.length, 0, `Existing slug ${key} must be reviewed, never overwritten.`);
    const excerpt = key === "phassion" ? sourcePage.texts.find(block => block.text.startsWith("PHASSION,"))?.text : undefined;
    if (key === "phassion") assert.ok(excerpt && excerpt.length <= 500);
    drafts.push({ key, collection: group.kind, kind: group.kind === "posts" ? "journal" : "project", sourcePath: sourcePage.path, orderedAssets: ordered,
      data: { title: group.title, slug: key, ...(group.year ? { year: group.year } : {}), ...(excerpt ? { excerpt } : {}), _status: "draft" },
      ...(key === "xix-visuals-for-december" ? { filmAsset: `adobe:${film.id}` } : {}) });
  }
  for (const video of images.videos.filter(video => video.provider === "youtube")) {
    assert.ok(video.title && youtubeCopy[video.id], "YouTube title/source copy needs review.");
    assert.ok(!inventory.videos.some(doc => doc.slug === video.slug), "Existing Video slug must not be overwritten.");
    drafts.push({ key: video.slug, collection: "videos", kind: "youtube-placeholder", originalFileMissing: true, externalSource: video.url,
      data: { title: video.title, slug: video.slug, year: video.year, ...youtubeCopy[video.id], _status: "draft",
        body: document([linkedParagraph(video.title, video.url), paragraph(`Source channel: ${video.author}`)]) } });
  }
  return { media, drafts };
}

export async function makeUploadPlan(imageDirectory, videoDirectory, auditDirectory, sessionDirectory) {
  await verifyBundle(imageDirectory); await verifyBundle(videoDirectory);
  const imageBytes = await readFile(join(imageDirectory, "manifest.json")), videoBytes = await readFile(join(videoDirectory, "manifest.json"));
  const images = await parsedSourceBundle(imageDirectory, JSON.parse(imageBytes)), videos = JSON.parse(videoBytes);
  assert.equal(videos.sourceBundle.manifestSha256, hash(imageBytes), "Video supplement belongs to another image inventory.");
  const inventory = await nativeInventory(await importSession(sessionDirectory));
  const selection = buildSelection(images, videos, inventory);
  const plan = { version: 1, createdAt: new Date().toISOString(), origin: cmsOrigin, publication: "FORBIDDEN", existingContentUpdates: "FORBIDDEN",
    bundles: { images: { directory: resolve(imageDirectory), manifestSha256: hash(imageBytes) }, videos: { directory: resolve(videoDirectory), manifestSha256: hash(videoBytes) } },
    baseline: Object.fromEntries(collections.map(collection => [collection, inventory[collection].map(doc => ({ id: doc.id, fingerprint: fingerprint(doc) }))])), ...selection,
    held: { photography: "Not imported: photograph uploader publishes immediately.", placementReview: "Covers/backgrounds/contact images not assigned or uploaded.", existingProjects: "Circle of Fashion, existing Fashion selection and both existing films are unchanged.", youtube: "Four private placeholders only; original files missing." } };
  const path = join(auditDirectory, "upload-plan.json");
  await writeJSON(path, plan);
  const bytes = await readFile(path), sha256 = hash(bytes);
  await writeFile(join(auditDirectory, "upload-plan.sha256"), `${sha256}  upload-plan.json\n`, { flag: "wx", mode: 0o600 });
  return { plan: path, sha256, selectedMedia: plan.media.length, existingExactMedia: plan.media.filter(item => item.existingId).length, newPrivateDrafts: plan.drafts.length, bytes: plan.media.reduce((sum, item) => sum + item.bytes, 0), publication: "FORBIDDEN" };
}

export function draftData(draft, images, ids) {
  if (draft.kind === "youtube-placeholder") return draft.data;
  const page = images.pages.find(page => page.path === draft.sourcePath);
  if (draft.kind === "journal") return { ...draft.data, body: journalBody(page, ids) };
  const media = draft.orderedAssets.map(id => ids[id]);
  assert.ok(media.every(Boolean));
  if (draft.filmAsset) assert.ok(ids[draft.filmAsset], "Unresolved verified film relationship.");
  return { ...draft.data, cover: media[0], gallery: media.slice(1), ...(draft.filmAsset ? { film: ids[draft.filmAsset] } : {}) };
}

export function verifyDraftContent(expected, actual) {
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value, `Native draft did not retain ${field}.`);
  assert.equal(actual._status, "draft");
  assert.ok(!actual.firstPublishedAt, "New private draft unexpectedly has a publication date.");
}

export async function verifyRecordedDraft(record, expected, request, anonymousGet = fetch) {
  const { data: doc } = await request(`/api/cms/${record.collection}/${record.id}?draft=true&depth=0`);
  verifyDraftContent(expected, doc);
  const prefix = record.collection === "posts" ? "/blog" : record.collection === "videos" ? "/video" : "/fashion";
  const denied = await anonymousGet(`${cmsOrigin}${prefix}/${doc.slug}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  await denied.arrayBuffer();
  assert.equal(denied.status, 404, "A new draft became publicly accessible.");
  return { contentVerified: true, anonymousDenied: true };
}

export async function requireNoPendingReceipt(sessionDirectory) {
  try { await stat(join(sessionDirectory, "pending-upload-receipt.private.json")); throw new Error("Outstanding receipt requires reconciliation before signing anything new."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

export async function reconcileRegisteredReceipt(sessionDirectory, journal, plan, request) {
  const path = join(sessionDirectory, "pending-upload-receipt.private.json");
  let receipt;
  try { receipt = JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  const record = journal.media.find(item => item.filename === receipt.filename && item.id && !item.reused);
  assert.ok(record, "Unregistered/ambiguous pending receipt requires explicit reconciliation.");
  const expected = plan.media.find(item => item.assetId === record.assetId);
  assert.ok(expected && receipt.size === expected.bytes && receipt.mimeType === expected.mimeType, "Pending receipt does not match its import entry.");
  const { data: doc } = await request(`/api/cms/media/${record.id}?depth=0`);
  assert.ok(doc.id === record.id && doc.filename === receipt.filename && doc.verified && doc.sha256 === expected.sha256 && doc.filesize === expected.bytes && doc.mimeType === expected.mimeType);
  assert.equal(record.key, `journal-native/${doc.uploadIdentity}/${doc.filename}`);
  await unlink(path); // Exactly this already-registered receipt; no original is removed.
}

function originalKey(value) {
  const url = new URL(value);
  assert.ok(url.protocol === "https:" && /^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(url.hostname) && !url.username && !url.password, "Unexpected original storage host.");
  const path = decodeURIComponent(url.pathname);
  assert.ok(path.startsWith("/arnaudbelec-staging/journal-native/"), "Unexpected original bucket/namespace.");
  return path.slice("/arnaudbelec-staging/".length);
}

async function verifyOriginal(session, record, expected, newlyCreated) {
  const path = `${cmsOrigin}/api/cms/media/file/${encodeURIComponent(record.filename)}`;
  if (newlyCreated) {
    const denied = await fetch(path, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    await denied.arrayBuffer(); assert.ok([403, 404].includes(denied.status), "New private original leaked anonymously.");
  }
  const response = await fetch(path, { redirect: "manual", headers: { Authorization: `Bearer ${session.accessToken}` }, signal: AbortSignal.timeout(30000) });
  assert.ok([302, 307].includes(response.status));
  assert.match(response.headers.get("cache-control") || "", /private/);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const location = response.headers.get("location");
  assert.equal(originalKey(location), `journal-native/${record.uploadIdentity}/${record.filename}`);
  const full = await fetch(location, { redirect: "error", signal: AbortSignal.timeout(180000) });
  assert.equal(full.status, 200);
  const sum = createHash("sha256"); let size = 0;
  for await (const chunk of full.body) { size += chunk.length; assert.ok(size <= expected.bytes); sum.update(chunk); }
  assert.equal(size, expected.bytes); assert.equal(sum.digest("hex"), expected.sha256);
  if (expected.mimeType === "video/mp4") {
    const range = await fetch(location, { headers: { Range: "bytes=0-1023" }, redirect: "error", signal: AbortSignal.timeout(30000) });
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 1024);
  }
}

export async function applyUploadPlan(planPath, confirmation, sessionDirectory) {
  const bytes = await readFile(planPath);
  assert.equal(hash(bytes), confirmation, "Exact reviewed plan checksum required.");
  const plan = JSON.parse(bytes);
  assert.equal(plan.origin, cmsOrigin); assert.equal(plan.publication, "FORBIDDEN"); assert.equal(plan.existingContentUpdates, "FORBIDDEN");
  for (const bundle of Object.values(plan.bundles)) {
    await verifyBundle(bundle.directory);
    assert.equal(hash(await readFile(join(bundle.directory, "manifest.json"))), bundle.manifestSha256);
  }
  const images = await parsedSourceBundle(plan.bundles.images.directory, JSON.parse(await readFile(join(plan.bundles.images.directory, "manifest.json"), "utf8")));
  const videos = JSON.parse(await readFile(join(plan.bundles.videos.directory, "manifest.json"), "utf8"));
  validateUploadScope(plan);
  for (const media of plan.media) {
    assert.ok(["images", "videos"].includes(media.bundle));
    const source = media.bundle === "images" ? images.assets.find(asset => asset.id === media.assetId) : videos.videos.find(video => `adobe:${video.id}` === media.assetId);
    assert.ok(source?.status === "staged" && source.file === media.file && source.sha256 === media.sha256 && source.bytes === media.bytes, "Plan file is not a pinned staged asset.");
    assert.equal(media.mimeType, media.bundle === "images" ? source.mimeType : "video/mp4");
    if (plan.scope === "unassigned-journal-media-only") assert.ok(media.bundle === "images" ? source.placements.some(p => p.group === "placement-review") : source.group === "placement-review");
  }
  for (const draft of plan.drafts) assert.ok(["posts", "videos", "fashion-projects"].includes(draft.collection) && draft.data._status === "draft" && !draft.data.id, "Only new private content records are permitted.");
  const session = await importSession(sessionDirectory), request = api(session), audit = dirname(planPath);
  const journalPath = join(audit, "import-journal.json");
  let journal;
  try { journal = JSON.parse(await readFile(journalPath, "utf8")); assert.equal(journal.planSha256, confirmation); }
  catch (error) { if (error.code !== "ENOENT") throw error; journal = { planSha256: confirmation, startedAt: new Date().toISOString(), media: [], drafts: [], completed: false }; }
  const checkpoint = async () => { const pending = `${journalPath}.writing`; await writeFile(pending, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 }); await rename(pending, journalPath); };
  const current = await nativeInventory(session);
  for (const collection of collections) for (const before of plan.baseline[collection]) assert.equal(fingerprint(current[collection].find(doc => doc.id === before.id)), before.fingerprint, "Existing CMS content changed before import; refresh/review instead of overwriting.");
  await checkpoint();
  await reconcileRegisteredReceipt(sessionDirectory, journal, plan, request);
  for (const media of plan.media) {
    let record = journal.media.find(item => item.assetId === media.assetId);
    const matches = current.media.filter(doc => doc.sha256 === media.sha256 && doc.filesize === media.bytes && doc.verified);
    if (matches.length && !record) { record = { assetId: media.assetId, id: matches[0].id, filename: matches[0].filename, reused: true }; journal.media.push(record); await checkpoint(); }
    if (record?.id) {
      const { data: doc } = await request(`/api/cms/media/${record.id}?depth=0`);
      assert.ok(doc.verified && doc.sha256 === media.sha256 && doc.filesize === media.bytes && doc.mimeType === media.mimeType);
      await verifyOriginal(session, doc, media, !record.reused);
      record.readbackVerified = true; if (!record.reused) record.anonymousDenied = true;
      record.state = "verified"; await checkpoint(); continue;
    }
    assert.ok(!record, "Unfinished transfer requires exact receipt/filename reconciliation; do not upload again.");
    const source = await readFile(join(plan.bundles[media.bundle].directory, media.file));
    assert.equal(source.length, media.bytes); assert.equal(hash(source), media.sha256);
    await requireNoPendingReceipt(sessionDirectory);
    record = { assetId: media.assetId, sha256: media.sha256, bytes: media.bytes, state: "signing" };
    journal.media.push(record); await checkpoint();
    const { data: signed } = await request("/api/cms/storage-s3-generate-signed-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectionSlug: "media", filename: basename(media.file), filesize: media.bytes, mimeType: media.mimeType }) });
    assert.ok(Object.entries(signed.headers || {}).some(([key, value]) => key.toLowerCase() === "if-none-match" && value === "*"), "Native upload must remain non-overwriting.");
    record.filename = signed.filename; record.key = originalKey(signed.url); record.state = "signed";
    const receiptPath = join(sessionDirectory, "pending-upload-receipt.private.json");
    await writeJSON(receiptPath, { filename: signed.filename, size: media.bytes, mimeType: media.mimeType, clientUploadContext: signed.clientUploadContext });
    await checkpoint();
    const put = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: source, redirect: "error", signal: AbortSignal.timeout(180000) });
    await put.arrayBuffer(); assert.equal(put.status, 200, "Native original transfer failed; retain and reconcile its receipt.");
    record.state = "uploaded"; await checkpoint();
    const form = new FormData();
    form.set("_payload", JSON.stringify({ alt: media.alt, caption: media.caption }));
    form.set("file", JSON.stringify({ collectionSlug: "media", filename: signed.filename, size: media.bytes, mimeType: media.mimeType, clientUploadContext: signed.clientUploadContext }));
    const created = await request("/api/cms/media?depth=0", { method: "POST", body: form });
    assert.equal(created.status, 201);
    const doc = created.data.doc;
    record.id = doc.id; record.state = "registered"; await checkpoint();
    assert.ok(doc.verified && doc.sha256 === media.sha256 && doc.filesize === media.bytes && doc.mimeType === media.mimeType, "Native server byte verification mismatch.");
    assert.equal(record.key, `journal-native/${doc.uploadIdentity}/${doc.filename}`);
    await unlink(receiptPath);
    await verifyOriginal(session, doc, media, true);
    record.state = "verified"; record.readbackVerified = true; record.anonymousDenied = true; await checkpoint();
    current.media.push(doc);
    console.log(JSON.stringify({ mediaUploaded: journal.media.filter(item => !item.reused && item.readbackVerified).length, sourceGroup: media.group, serverAndReadbackVerified: true, anonymousDenied: true }));
  }
  const ids = Object.fromEntries(journal.media.map(item => [item.assetId, item.id]));
  for (const draft of plan.drafts) {
    let record = journal.drafts.find(item => item.key === draft.key);
    const data = draftData(draft, images, ids);
    if (record?.id) {
      Object.assign(record, await verifyRecordedDraft(record, data, request));
      await checkpoint(); continue;
    }
    assert.ok(!record, "An uncertain draft creation requires slug/content reconciliation before retry.");
    const { data: conflict } = await request(`/api/cms/${draft.collection}?where[slug][equals]=${encodeURIComponent(draft.data.slug)}&depth=0&draft=true`);
    assert.equal(conflict.totalDocs, 0, "Draft slug now exists; do not overwrite.");
    assert.equal(data._status, "draft");
    record = { key: draft.key, collection: draft.collection, slug: data.slug, state: "creating", submittedContentSha256: hash(Buffer.from(JSON.stringify(data))) };
    journal.drafts.push(record); await checkpoint();
    const created = await request(`/api/cms/${draft.collection}?draft=true&depth=0`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    assert.equal(created.status, 201);
    const doc = created.data.doc;
    record.id = doc.id; record.state = "created-private"; await checkpoint();
    Object.assign(record, await verifyRecordedDraft(record, data, request));
    await checkpoint();
  }
  const after = await nativeInventory(session);
  const preservation = {};
  for (const collection of collections) {
    preservation[collection] = plan.baseline[collection].every(before => {
      const doc = after[collection].find(doc => doc.id === before.id);
      return doc && fingerprint(doc) === before.fingerprint;
    });
  }
  assert.ok(Object.values(preservation).every(Boolean), "Existing CMS records changed; inspect preservation evidence, never revert user edits.");
  const newIds = new Set(journal.media.filter(record => !record.reused).map(record => record.id));
  const publishedMedia = await fetch(`${cmsOrigin}/api/cms/media?limit=100&depth=0&draft=true`, { signal: AbortSignal.timeout(30000) });
  assert.equal(publishedMedia.status, 200);
  assert.ok((await publishedMedia.json()).docs.every(doc => !newIds.has(doc.id)), "New private Media was exposed anonymously.");
  assert.ok(journal.media.length === plan.media.length && journal.media.every(record => record.id && record.readbackVerified && (record.reused || record.anonymousDenied)), "Media acceptance is incomplete.");
  assert.ok(journal.drafts.length === plan.drafts.length && journal.drafts.every(record => record.id && record.contentVerified && record.anonymousDenied), "Draft acceptance is incomplete.");
  journal.completed = true; journal.completedAt = new Date().toISOString(); journal.existingRecordsPreserved = preservation;
  await checkpoint();
  const receipt = { planSha256: confirmation, completedAt: journal.completedAt, uploadedMedia: journal.media.filter(item => !item.reused).length, reusedMedia: journal.media.filter(item => item.reused).length, privateDrafts: journal.drafts.length,
    existingRecordsPreserved: preservation, allNewMediaReadbackVerified: journal.media.every(item => item.readbackVerified), allNewDraftsDeniedAnonymously: journal.drafts.every(item => item.anonymousDenied), publication: false };
  try { await writeJSON(join(audit, "import-completed.json"), receipt); }
  catch (error) { if (error.code !== "EEXIST") throw error; assert.equal(JSON.parse(await readFile(join(audit, "import-completed.json"), "utf8")).planSha256, confirmation); }
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, ...args] = process.argv.slice(2);
  try {
    if (action === "plan" && args.length === 4) console.log(JSON.stringify(await makeUploadPlan(...args), null, 2));
    else if (action === "apply" && args.length === 3 && args[1].startsWith("--confirm=")) console.log(JSON.stringify(await applyUploadPlan(args[0], args[1].slice("--confirm=".length), args[2]), null, 2));
    else throw new Error("Use plan IMAGE-BUNDLE VIDEO-BUNDLE AUDIT-DIRECTORY PRIVATE-SESSION-DIRECTORY or apply PLAN --confirm=SHA256 PRIVATE-SESSION-DIRECTORY.");
  } catch (error) {
    // No response bodies, receipt contexts, signed URLs, auth tokens or request headers.
    console.error(`Private import stopped (${error.code || error.name}). Reconcile the exact journal/receipt before retry. No existing content was overwritten or published by this importer.`);
    process.exitCode = 1;
  }
}
