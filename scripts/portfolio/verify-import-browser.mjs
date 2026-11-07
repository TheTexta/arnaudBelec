// Read-only live preview acceptance. Use only this import's temporary API session.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cmsOrigin, importSession } from "./operator-session.mjs";
import { parsedSourceBundle } from "./upload.mjs";

const [auditDirectory, sessionDirectory, evidenceName = "browser"] = process.argv.slice(2);
assert.ok(auditDirectory && sessionDirectory, "Supply the import audit and external private session directories.");
assert.match(evidenceName, /^browser(?:-[a-z0-9-]+)?$/);
const journal = JSON.parse(await readFile(join(auditDirectory, "import-journal.json"), "utf8"));
const plan = JSON.parse(await readFile(join(auditDirectory, "upload-plan.json"), "utf8"));
const source = await parsedSourceBundle(plan.bundles.images.directory, JSON.parse(await readFile(join(plan.bundles.images.directory, "manifest.json"), "utf8")));
assert.equal(journal.completed, true, "Complete native API/readback/privacy acceptance first.");
const session = await importSession(sessionDirectory);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const evidence = join(auditDirectory, evidenceName);
await mkdir(evidence, { mode: 0o700 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "__Host-arnaud-cms-access", value: session.accessToken, domain: new URL(cmsOrigin).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Strict", expires: session.expiresAt }]);
    let blockedMutations = 0;
    await context.route("**/*", route => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { blockedMutations++; return route.abort("blockedbyclient"); }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.name));
    try {
      for (const record of journal.drafts) {
        const draft = plan.drafts.find(item => item.key === record.key);
        const path = record.collection === "posts" ? `/cms/preview?id=${record.id}` : `/cms/project-preview?collection=${record.collection}&id=${record.id}`;
        const response = await page.goto(cmsOrigin + path, { timeout: 120000, waitUntil: "domcontentloaded" });
        assert.equal(response.status(), 200, "Private preview request failed.");
        const content = page.locator(record.collection === "posts" ? ".journal-article" : ".site-project-preview").first();
        await content.locator("h1").filter({ hasText: draft.data.title }).waitFor({ timeout: 60000 });
        const loadedImages = await content.locator("img").evaluateAll(async images => {
          for (const image of images) { image.loading = "eager"; await image.decode(); }
          return images.map(image => ({ loaded: image.complete && image.naturalWidth > 0, alt: image.alt, width: image.naturalWidth, height: image.naturalHeight }));
        });
        const visibleSource = source.pages.find(page => page.path === draft.sourcePath);
        let expectedImages = visibleSource ? visibleSource.images.filter(image => draft.orderedAssets.includes(image.id)).length : 0;
        if (draft.filmAsset) expectedImages--;
        assert.equal(loadedImages.length, expectedImages, "Preview image membership differs from the reviewed source selection.");
        assert.ok(loadedImages.every(image => image.loaded && image.alt.trim()));
        if (record.key === "digital-tableaux") assert.equal(await content.locator('a[href*="/photos/will%20in%20living.png"]').count(), 1);
        let playback = null;
        if (draft.filmAsset) {
          const video = content.locator("video").first();
          await video.evaluate(async video => { video.muted = true; await video.play(); });
          await page.waitForFunction(() => [...document.querySelectorAll("video")].some(video => video.readyState >= 2 && video.currentTime > 0));
          playback = await video.evaluate(async video => {
            video.pause();
            await new Promise(resolve => { video.addEventListener("seeked", resolve, { once: true }); video.currentTime = Math.min(4, video.duration / 2); });
            return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames, error: !!video.error };
          });
          assert.ok(!playback.error && playback.width === 1920 && playback.height === 1080 && playback.duration > 8 && playback.duration < 10 && playback.decodedFrames > 0);
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Preview viewport overflow.");
        await page.screenshot({ path: join(evidence, `${record.key}-${width}.png`), fullPage: false });
        checks.push({ key: record.key, width, privatePreview: true, images: loadedImages.length, imagesDecoded: true, ...(playback ? { playback } : {}), screenshot: `${record.key}-${width}.png` });
      }
      assert.equal(errors.length, 0, "Browser page exceptions occurred.");
      checks.push({ width, pageExceptions: errors.length, mutationRequestsBlocked: blockedMutations, writesPermitted: false });
    } finally { await context.close(); }
  }
  await writeFile(join(evidence, "result.json"), `${JSON.stringify({ passed: true, livePrivateContent: true, publication: false, checks }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ passed: true, privatePreviewChecks: checks.filter(check => check.key).length, viewports: [390, 1440], publication: false }));
} finally { await browser.close(); }
