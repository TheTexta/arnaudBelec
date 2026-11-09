// GET-only anonymous linked-film checks and isolated authenticated Media decoding.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cmsOrigin, importSession } from "./operator-session.mjs";
import { saveNew } from "./publication.mjs";

const [audit, sessionDirectory] = process.argv.slice(2);
const links = JSON.parse(await readFile(join(audit, "links-plan.json"), "utf8")), upload = JSON.parse(await readFile(join(audit, "upload-plan.json"), "utf8")), journal = JSON.parse(await readFile(join(audit, "import-journal.json"), "utf8"));
assert.equal(journal.completed, true);
const session = await importSession(sessionDirectory);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const evidence = join(audit, "browser"); await mkdir(evidence, { mode: 0o700 }); const checks = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.route("**/*", route => ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.name));
    try {
      for (const draft of links.drafts) {
        const r = await page.goto(`${cmsOrigin}/video/${draft.slug}`, { waitUntil: "domcontentloaded", timeout: 120000 }); assert.equal(r.status(), 200);
        await page.getByRole("heading", { level: 1, name: draft.content.title, exact: true }).waitFor();
        assert.equal(await page.locator(`a[href="${draft.youtubeUrl}"]`).count(), 1);
        assert.equal(await page.locator("video,iframe").count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: join(evidence, `${draft.slug}-${width}.png`), fullPage: false });
        checks.push({ kind: "public-linked-video", slug: draft.slug, width, correctYouTubeLink: true, embeddedPlayerClaimed: false });
      }
      await context.addCookies([{ name: "__Host-arnaud-cms-access", value: session.accessToken, domain: new URL(cmsOrigin).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Strict", expires: session.expiresAt }]);
      await page.route(`${cmsOrigin}/__operator-media-check`, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Private operator check</title><body></body>" }));
      await page.goto(`${cmsOrigin}/__operator-media-check`);
      for (const record of journal.media) {
        const item = upload.media.find(m => m.assetId === record.assetId);
        const src = `/api/cms/media/file/${encodeURIComponent(record.filename)}`;
        const result = await page.evaluate(async ({ src, video }) => {
          document.body.replaceChildren();
          if (!video) { const image = document.createElement("img"); image.src = src; document.body.append(image); await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }
          const element = document.createElement("video"); element.muted = true; element.src = src; document.body.append(element); await element.play();
          await new Promise(resolve => { const check = () => element.currentTime > 0 ? resolve() : element.requestVideoFrameCallback(check); check(); });
          element.pause(); await new Promise(resolve => { element.addEventListener("seeked", resolve, { once: true }); element.currentTime = 3; });
          return { width: element.videoWidth, height: element.videoHeight, duration: element.duration, frames: element.getVideoPlaybackQuality().totalVideoFrames };
        }, { src, video: item.mimeType === "video/mp4" });
        assert.ok(result.width > 0 && result.height > 0);
        if (item.mimeType === "video/mp4") assert.ok(result.width === 1920 && result.height === 1080 && result.frames > 0);
        checks.push({ kind: "private-library-media", assetId: item.assetId, width, decoded: true, ...result });
      }
      assert.equal(errors.length, 0);
    } finally { await context.close(); }
  }
  await saveNew(join(evidence, "result.json"), { passed: true, writesPermitted: false, checks });
  console.log(JSON.stringify({ passed: true, publicLinkedVideoChecks: checks.filter(c => c.kind === "public-linked-video").length, privateMediaChecks: checks.filter(c => c.kind === "private-library-media").length, viewports: [390, 1440] }));
} finally { await browser.close(); }
