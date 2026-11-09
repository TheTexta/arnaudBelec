// Explicit follow-up: four YouTube-linked Video publications; remaining assets to private Media only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { api, nativeInventory, parsedSourceBundle } from "./upload.mjs";
import { cmsOrigin, importSession } from "./operator-session.mjs";
import { verifyBundle } from "./prepare.mjs";
import { checkpoint, editable, publicationPayload, same, saveNew, sha } from "./publication.mjs";

const alt = [
  "A person with curly hair sits beside windows holding a bunch of flowers.",
  "Yellow and orange light washes over a stairway beside blue-grey walls.",
  "People stand on a dark street beneath an orange streetlamp.",
  "A person in a dark red top works on fabric beside dress forms.",
  "A cropped runway photograph shows a loose dark garment with yellow fabric details.",
  "A grey circular collage frames people standing behind netting.",
  "A blurred face, circular light trails and translucent rectangles form an abstract collage.",
  "Orange and yellow light streaks wash over an indoor stairway.",
  "Thin trees rise from dark ground beneath a saturated blue sky.",
  "A mirrored portrait and interior create a symmetrical kaleidoscopic image.",
  "A person's face and arms repeat around a patterned kaleidoscopic centre.",
  "Hands and phones repeat around a kaleidoscopic centre.",
  "A person sits beside a large metal column on a platform above green water.",
  "A densely textured dark mixed-media artwork hangs against a pale wall.",
  "A face is illuminated by red light against a black background.",
  "Soft reddish forms dissolve into a grainy dark abstract background.",
  "A pedestrian passes a brightly lit convenience store at night.",
];
const [action, audit, sessionDirectory, confirmation] = process.argv.slice(2);
const readJSON = async file => JSON.parse(await readFile(file, "utf8"));
const request = api(await importSession(sessionDirectory));
try {
  if (action === "plan") {
    const imagesDirectory = resolve(".local/adobe-portfolio-prep-20261106-bundle"), videoDirectory = resolve(".local/adobe-portfolio-video-supplement-20261107");
    await verifyBundle(imagesDirectory); await verifyBundle(videoDirectory);
    const imageBytes = await readFile(join(imagesDirectory, "manifest.json")), videoBytes = await readFile(join(videoDirectory, "manifest.json"));
    const images = await parsedSourceBundle(imagesDirectory, JSON.parse(imageBytes)), videos = JSON.parse(videoBytes);
    assert.equal(videos.sourceBundle.manifestSha256, sha(imageBytes));
    const baseline = await nativeInventory(await importSession(sessionDirectory));
    const { data: settings } = await request("/api/cms/globals/site-settings?depth=0&draft=false"); assert.equal(settings.newsletterEnabled, false);
    const imported = await readJSON(".local/adobe-portfolio-upload-20261107/import-journal.json"); assert.equal(imported.completed, true);
    const frozen = await readJSON(".local/adobe-portfolio-upload-20261107/upload-plan.json");
    assert.equal(sha(await readFile(".local/adobe-portfolio-upload-20261107/upload-plan.json")), imported.planSha256);
    const drafts = frozen.drafts.filter(d => d.kind === "youtube-placeholder").map(d => {
      const id = imported.drafts.find(record => record.key === d.key).id;
      const current = baseline.videos.find(v => v.id === id); assert.equal(current.slug, d.key); assert.equal(current._status, "draft"); assert.ok(!current.film);
      for (const [field, value] of Object.entries(d.data)) same(current[field], value);
      return { id, slug: current.slug, youtubeUrl: d.externalSource, content: editable(current, "videos"), editRevision: current.editRevision };
    });
    assert.equal(drafts.length, 4);
    const skips = await readJSON(join(audit, "duplicate-decisions.json"));
    const candidates = images.assets.filter(a => a.status === "staged" && a.placements.some(p => p.group === "placement-review")); assert.equal(candidates.length, alt.length);
    const media = candidates.flatMap((asset, index) => skips.some(s => s.assetId === asset.id) ? [] : [{ assetId: asset.id, bundle: "images", file: asset.file, sha256: asset.sha256,
      bytes: asset.bytes, mimeType: asset.mimeType, group: "placement-review", alt: alt[index], caption: `Adobe Portfolio source: ${asset.placements.map(p => `https://arnaudnaudbel.myportfolio.com${p.page} (${p.role})`).join("; ")}. Unassigned library asset.` }]);
    const unique = new Set();
    for (const video of videos.videos.filter(v => v.group === "placement-review" && v.status === "staged")) {
      if (unique.has(video.sha256)) continue; unique.add(video.sha256);
      media.push({ assetId: `adobe:${video.id}`, bundle: "videos", file: video.file, sha256: video.sha256, bytes: video.bytes, mimeType: "video/mp4", group: "placement-review", alt: "",
        caption: `Adobe Portfolio background clip ${video.id}. Unassigned library asset; not a standalone film publication.` });
    }
    assert.equal(unique.size, 2);
    for (const skipped of skips) assert.ok(candidates.some(a => a.id === skipped.assetId) && skipped.reason && skipped.existingReference);
    const upload = { version: 1, createdAt: new Date().toISOString(), origin: cmsOrigin, scope: "unassigned-journal-media-only", publication: "FORBIDDEN", existingContentUpdates: "FORBIDDEN",
      bundles: { images: { directory: imagesDirectory, manifestSha256: sha(imageBytes) }, videos: { directory: videoDirectory, manifestSha256: sha(videoBytes) } },
      baseline: Object.fromEntries(Object.entries(baseline).map(([collection, docs]) => [collection, docs.map(doc => ({ id: doc.id, fingerprint: sha(JSON.stringify(doc)) }))])), media, drafts: [], skippedExistingCompositions: skips };
    await saveNew(join(audit, "upload-plan.json"), upload);
    const links = { origin: cmsOrigin, drafts, baseline, settings, noNewJournalPost: true, noSitePlacementChanges: true };
    await saveNew(join(audit, "links-plan.json"), links);
    console.log(JSON.stringify({ uploadPlanSha256: sha(await readFile(join(audit, "upload-plan.json"))), linksPlanSha256: sha(await readFile(join(audit, "links-plan.json"))), selectedMedia: media.length, skippedCompositions: skips.length, videosToPublish: drafts.length }, null, 2));
  } else if (action === "publish-links") {
    const bytes = await readFile(join(audit, "links-plan.json")); assert.equal(confirmation, `--confirm=${sha(bytes)}`);
    const plan = JSON.parse(bytes); assert.equal(plan.origin, cmsOrigin); assert.equal(plan.drafts.length, 4);
    const journal = { planSha256: sha(bytes), drafts: [], completed: false }; const journalPath = join(audit, "linked-videos-publication.json"); await saveNew(journalPath, journal);
    for (const target of plan.drafts) {
      const { data: settings } = await request("/api/cms/globals/site-settings?depth=0&draft=false"); same(settings, plan.settings); assert.equal(settings.newsletterEnabled, false);
      const { data: current } = await request(`/api/cms/videos/${target.id}?draft=true&depth=0`); same(editable(current, "videos"), target.content); same(current.editRevision, target.editRevision);
      const record = { id: target.id, slug: target.slug, state: "publishing" }; journal.drafts.push(record); await checkpoint(journalPath, journal);
      await request(`/api/cms/videos/${target.id}?depth=0`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publicationPayload(current, "videos")) });
      const r = await fetch(`${cmsOrigin}/api/cms/videos/${target.id}?depth=0`, { signal: AbortSignal.timeout(60000) }); assert.equal(r.status, 200); const published = await r.json();
      assert.equal(published._status, "published"); same(editable(published, "videos"), target.content);
      const page = await fetch(`${cmsOrigin}/video/${target.slug}`, { signal: AbortSignal.timeout(60000) }); assert.equal(page.status, 200); assert.ok((await page.text()).includes(target.youtubeUrl.replaceAll("&", "&amp;")));
      record.state = "verified-public-link"; await checkpoint(journalPath, journal);
    }
    const after = await nativeInventory(await importSession(sessionDirectory));
    for (const [collection, docs] of Object.entries(plan.baseline)) for (const doc of docs) if (!plan.drafts.some(d => d.id === doc.id)) same(after[collection].find(d => d.id === doc.id), doc);
    const { data: settings } = await request("/api/cms/globals/site-settings?depth=0&draft=false"); same(settings, plan.settings);
    journal.completed = true; journal.unrelatedContentAndSettingsPreserved = true; await checkpoint(journalPath, journal);
    console.log(JSON.stringify({ publishedYouTubeLinkedVideos: journal.drafts.length, unrelatedContentAndSettingsPreserved: true, embeddedPlayersAdded: false }));
  } else throw new Error("Use plan or publish-links with exact plan checksum.");
} catch (error) {
  console.error(`Follow-up stopped (${error.code || error.name}). Reconcile journal before retry; no credentials printed.`); process.exitCode = 1;
}
