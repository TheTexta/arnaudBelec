// One bounded correction of this import's TWO new private projects only.
// No uploads, publication, other project edits, deletion or source-bundle rewriting.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { api, draftData, nativeInventory, parsedSourceBundle, verifyDraftContent } from "./upload.mjs";
import { cmsOrigin, importSession } from "./operator-session.mjs";
import { draftMappings, verifyBundle } from "./prepare.mjs";

const [audit, sessionDirectory, confirmation] = process.argv.slice(2);
assert.equal(confirmation, "--confirm=own-two-private-galleries");
const sha = value => createHash("sha256").update(value).digest("hex");
const planBytes = await readFile(join(audit, "upload-plan.json"));
const plan = JSON.parse(planBytes);
const journal = JSON.parse(await readFile(join(audit, "import-journal.json"), "utf8"));
assert.equal(journal.planSha256, sha(planBytes));
assert.equal(journal.completed, true);
assert.equal(plan.origin, cmsOrigin);
await verifyBundle(plan.bundles.images.directory);
const sourceBytes = await readFile(join(plan.bundles.images.directory, "manifest.json"));
assert.equal(sha(sourceBytes), plan.bundles.images.manifestSha256);
const source = await parsedSourceBundle(plan.bundles.images.directory, JSON.parse(sourceBytes));
const mappings = draftMappings(source);
const writeJSON = (file, value) => writeFile(join(audit, file), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
await writeJSON("visible-cms-drafts.json", mappings.templates);
await writeJSON("visible-photographs-queue.json", mappings.photographs);
const session = await importSession(sessionDirectory), request = api(session);
const before = await nativeInventory(session);
const ids = Object.fromEntries(journal.media.map(item => [item.assetId, item.id]));
const receipt = { startedAt: new Date().toISOString(), sourcePlanSha256: journal.planSha256, reason: "Ignore inert Adobe lightbox script templates, not genuine visible image occurrences.", projects: [], completed: false };
const receiptPath = join(audit, "gallery-correction.json");
await writeJSON("gallery-correction.json", receipt);
const save = async () => { await writeFile(`${receiptPath}.writing`, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 }); await rename(`${receiptPath}.writing`, receiptPath); };
for (const key of ["phassion", "xix-visuals-for-december"]) {
  const imported = journal.drafts.find(item => item.key === key);
  const draft = plan.drafts.find(item => item.key === key);
  assert.ok(imported?.id && draft && imported.collection === draft.collection);
  const current = before[draft.collection].find(doc => doc.id === imported.id);
  // Do not overwrite any intervening user edit, or any pre-existing project.
  assert.ok(!plan.baseline[draft.collection].some(doc => doc.id === imported.id));
  verifyDraftContent(draftData(draft, source, ids), current);
  const page = source.pages.find(page => page.path === draft.sourcePath);
  const actualOrder = page.images.filter(image => draft.orderedAssets.includes(image.id)).map(image => image.id);
  assert.equal(actualOrder.length, key === "phassion" ? 5 : 4);
  const expected = draftData({ ...draft, orderedAssets: actualOrder }, source, ids);
  assert.equal(expected.cover, current.cover);
  if (draft.filmAsset) assert.equal(expected.film, current.film);
  assert.ok(Number.isSafeInteger(current.editRevision));
  const record = { key, collection: draft.collection, id: imported.id, state: "patching-own-private-draft", beforeGalleryLength: current.gallery.length, expectedGalleryLength: expected.gallery.length, beforeRevision: current.editRevision };
  receipt.projects.push(record); await save();
  await request(`/api/cms/${draft.collection}/${imported.id}?draft=true&depth=0`, { method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _status: "draft", editRevision: current.editRevision, gallery: expected.gallery }) });
  const { data: after } = await request(`/api/cms/${draft.collection}/${imported.id}?draft=true&depth=0`);
  verifyDraftContent(expected, after);
  const prefix = draft.collection === "videos" ? "/video" : "/fashion";
  const denied = await fetch(`${cmsOrigin}${prefix}/${after.slug}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  await denied.arrayBuffer(); assert.equal(denied.status, 404);
  Object.assign(record, { state: "corrected-private", afterRevision: after.editRevision, galleryLength: after.gallery.length, anonymousDenied: true }); await save();
}
const after = await nativeInventory(session);
const permitted = new Set(receipt.projects.map(item => item.id));
receipt.otherRecordsPreserved = Object.fromEntries(Object.keys(before).map(collection => [collection, before[collection].filter(doc => !permitted.has(doc.id)).every(doc => {
  const current = after[collection].find(item => item.id === doc.id);
  return current && sha(JSON.stringify(current)) === sha(JSON.stringify(doc));
})]));
assert.ok(Object.values(receipt.otherRecordsPreserved).every(Boolean));
receipt.completed = true; receipt.completedAt = new Date().toISOString(); receipt.publication = false; await save();
console.log(JSON.stringify({ correctedOwnPrivateProjects: receipt.projects.length, phassionGalleryImages: 4, xixGalleryImages: 3, otherRecordsPreserved: receipt.otherRecordsPreserved, publication: false }));
