// Anonymous, GET-only browser acceptance of this approved content publication.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cmsOrigin } from "./operator-session.mjs";
import { saveNew } from "./publication.mjs";

const [audit, mode = "drafts"] = process.argv.slice(2);
assert.ok(["drafts", "photos"].includes(mode));
const plan = JSON.parse(await readFile(join(audit, "publication-plan.json"), "utf8"));
const evidence = join(audit, `browser-${mode}`); await mkdir(evidence, { mode: 0o700 });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.route("**/*", route => ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort("blockedbyclient"));
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", e => errors.push(e.name));
    const targets = mode === "drafts" ? plan.drafts.map(d => ({ slug: d.slug, title: d.content.title, path: `${d.collection === "posts" ? "/blog" : d.collection === "videos" ? "/video" : "/fashion"}/${d.slug}`, selector: d.collection === "posts" ? ".journal-article" : ".site-project-detail", images: d.collection === "posts" ? ({ tableaux: 10, "digital-tableaux": 2, "sunday-missile": 3 })[d.slug] : d.slug === "phassion" ? 5 : 3 }))
      : [ ...Object.keys(Object.groupBy(plan.photos, p => p.group)).map(group => { const p = plan.photos.find(p => p.group === group); return { slug: group, title: p.title, path: `/photos/${encodeURIComponent(p.filename)}`, selector: 'section[aria-label="Photograph and its palette gradients"]', images: 1 }; }) ];
    try {
      for (const target of targets) {
        const r = await page.goto(cmsOrigin + target.path, { waitUntil: "domcontentloaded", timeout: 120000 }); assert.equal(r.status(), 200);
        const content = page.locator(target.selector).first();
        await content.waitFor();
        if (mode === "drafts") await content.locator("h1").filter({ hasText: target.title }).waitFor();
        const images = await content.locator("img").evaluateAll(async elements => {
          for (const image of elements) { image.loading = "eager"; await image.decode(); }
          return elements.map(image => ({ loaded: image.complete && image.naturalWidth > 0, alt: image.alt }));
        });
        if (target.images !== null) assert.equal(images.length, target.images);
        assert.ok(images.length > 0 && images.every(i => i.loaded && i.alt.trim()));
        let playback = null;
        if (target.slug === "xix-visuals-for-december") {
          const video = content.locator("video").first(); await video.evaluate(async v => { v.muted = true; await v.play(); });
          await page.waitForFunction(() => [...document.querySelectorAll("video")].some(v => v.currentTime > 0 && v.readyState >= 2));
          playback = await video.evaluate(async v => { v.pause(); await new Promise(resolve => { v.addEventListener("seeked", resolve, { once: true }); v.currentTime = 4; }); return { width: v.videoWidth, height: v.videoHeight, duration: v.duration, decodedFrames: v.getVideoPlaybackQuality().totalVideoFrames }; });
          assert.ok(playback.width === 1920 && playback.height === 1080 && playback.duration > 8 && playback.duration < 10 && playback.decodedFrames > 0);
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: join(evidence, `${target.slug}-${width}.png`), fullPage: false });
        checks.push({ width, path: target.path, anonymous: true, imagesDecoded: images.length, ...(playback ? { playback } : {}), overflow: false });
      }
      if (mode === "photos") {
        const response = await page.goto(`${cmsOrigin}/photos`, { waitUntil: "domcontentloaded", timeout: 120000 }); assert.equal(response.status(), 200);
        await page.getByText("Showing 94 photographs in All.", { exact: true }).waitFor({ timeout: 60000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: join(evidence, `archive-${width}.png`), fullPage: false });
        checks.push({ width, path: "/photos", anonymous: true, catalogueTotal: 94, overflow: false });
      }
      assert.equal(errors.length, 0, "Browser page exceptions occurred.");
    } finally { await context.close(); }
  }
  await saveNew(join(evidence, "result.json"), { passed: true, mode, checks, writesPermitted: false });
  console.log(JSON.stringify({ passed: true, mode, anonymousChecks: checks.length, viewports: [390, 1440] }));
} finally { await browser.close(); }
