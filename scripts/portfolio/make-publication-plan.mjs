// Local-only: bind approved publication to imported IDs, corrected source and reviewed metadata.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cmsOrigin } from "./operator-session.mjs";
import { draftData, parsedSourceBundle } from "./upload.mjs";
import { verifyBundle } from "./prepare.mjs";
import { editable, same, saveNew, sha } from "./publication.mjs";
import { photographDescriptions } from "./photo-editorial.mjs";

const [audit, importAudit] = process.argv.slice(2);
const readJSON = async (dir, file) => JSON.parse(await readFile(join(dir, file), "utf8"));
const before = await readJSON(audit, "cms-before.json"), original = await readJSON(importAudit, "upload-plan.json"), journal = await readJSON(importAudit, "import-journal.json");
assert.equal(journal.completed, true); assert.equal(sha(await readFile(join(importAudit, "upload-plan.json"))), journal.planSha256);
const imageDirectory = original.bundles.images.directory;
await verifyBundle(imageDirectory);
const manifest = await readJSON(imageDirectory, "manifest.json");
assert.equal(sha(await readFile(join(imageDirectory, "manifest.json"))), original.bundles.images.manifestSha256);
const source = await parsedSourceBundle(imageDirectory, manifest), ids = Object.fromEntries(journal.media.map(m => [m.assetId, m.id]));
const allowed = { phassion: "fashion-projects", tableaux: "posts", "digital-tableaux": "posts", "sunday-missile": "posts", "xix-visuals-for-december": "videos" };
const drafts = Object.entries(allowed).map(([slug, collection]) => {
  const imported = journal.drafts.find(d => d.key === slug), mapping = original.drafts.find(d => d.key === slug);
  assert.equal(imported.collection, collection); assert.equal(mapping.collection, collection);
  const current = before.inv[collection].find(d => d.id === imported.id); assert.equal(current.slug, slug); assert.equal(current._status, "draft"); assert.ok(!current.firstPublishedAt);
  // Fix only the two already-corrected template-inclusive order lists in this historical plan.
  const page = source.pages.find(p => p.path === mapping.sourcePath);
  const corrected = mapping.kind === "project" ? { ...mapping, orderedAssets: page.images.filter(i => mapping.orderedAssets.includes(i.id)).map(i => i.id) } : mapping;
  const expected = draftData(corrected, source, ids);
  for (const [key, value] of Object.entries(expected)) same(current[key], value);
  return { id: imported.id, slug, collection, editRevision: current.editRevision, content: editable(current, collection) };
});
const samples = await readJSON(audit, "photograph-samples.json"), originals = await readJSON(audit, "existing-original-hashes.json"), photoBaseline = await readJSON(audit, "photos-before.json");
assert.equal(originals.length, photoBaseline.length); assert.equal(photoBaseline.length, 16);
const counters = {};
const groupNames = { "street-photography": "Street photography", "black-and-white": "Black and white", portraiture: "Portraiture", multicaf: "Multicaf", "theatre-costuming": "Theatre costuming" };
const photos = samples.map((photo, index) => {
  const asset = source.assets.find(a => a.id === photo.assetId);
  assert.ok(asset.status === "staged" && asset.placements.some(p => p.group === photo.group));
  assert.equal(photo.sha256, asset.sha256); assert.equal(photo.bytes, asset.bytes); assert.equal(photo.file, asset.file);
  assert.equal(photo.exactMatches.length, 0); assert.ok(!originals.some(o => o.sha256 === photo.sha256));
  assert.ok(!before.inv.media.some(m => m.sha256 === photo.sha256), "Existing CMS original requires placement review instead of another upload.");
  assert.ok(!photoBaseline.some(p => p.filename === photo.filename));
  counters[photo.group] = (counters[photo.group] || 0) + 1;
  const altText = photographDescriptions[photo.group][counters[photo.group] - 1]; assert.ok(altText && altText.length <= 500);
  return { ...photo, altText, title: `${groupNames[photo.group]} ${String(photo.order).padStart(2, "0")}`, capturedAt: null, sortOrder: index + 1 };
});
assert.equal(photos.length, 78); assert.equal(new Set(photos.map(p => p.sha256)).size, photos.length);
for (const [group, count] of Object.entries(counters)) assert.equal(count, photographDescriptions[group].length);
assert.equal(before.settings.newsletterEnabled, false);
const plan = { version: 1, createdAt: new Date().toISOString(), origin: cmsOrigin, ownerApproval: "i approve all — five completed scraped drafts and unmatched photograph publication; no placeholders or unassigned assets",
  sourceImportPlanSha256: journal.planSha256, imageDirectory: resolve(imageDirectory), imageManifestSha256: original.bundles.images.manifestSha256,
  drafts, photos, photoBaseline, cmsBaseline: before.inv, settings: before.settings,
  duplicateReview: { existingOriginalsHashed: 16, exactDuplicates: 0, contactSheetsReviewed: ["existing", ...Object.keys(photographDescriptions)],
    result: "78 distinct staged candidates visually reviewed against the 16 published originals; known composition exclusions and cross-gallery aliases remain excluded.", cameraOriginalClaim: false },
  newsletterBefore: { deliveries: 0, subscribers: 0 }, excluded: ["Four incomplete YouTube-reference drafts", "All unrelated existing drafts", "Unassigned support images and background clips", "Password-protected source"] };
await saveNew(join(audit, "publication-plan.json"), plan);
console.log(JSON.stringify({ sha256: sha(await readFile(join(audit, "publication-plan.json"))), completedDrafts: drafts.length, photographs: photos.length, bytes: photos.reduce((n, p) => n + p.bytes, 0), groups: counters, newsletterEnabled: false }, null, 2));
