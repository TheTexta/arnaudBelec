// Only the loopback memory fixture; never logs in to or contacts production.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3111";
const filesOrigin = "http://127.0.0.1:55446";
const fixture = await (await fetch(`${filesOrigin}/fixture/state`)).json();
assert.equal(fixture.fixture, "arnaud-site-expansion");
assert.equal(fixture.localFashion?.slug, "circle-of-fashion");
assert.equal(fixture.localFashion.filenames.length, 10);
assert.equal(fixture.newsletterSending, false);
const evidence = fileURLToPath(new URL("../../.local/fashion-browser/", import.meta.url));
await mkdir(evidence, { recursive: true, mode: 0o700 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
let failure;
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (![origin, filesOrigin].includes(url.origin)) return route.abort("blockedbyclient");
      if (url.pathname.startsWith("/api/cms/media/file/circle-of-fashion-")) {
        const response = await route.fetch({ url: `${filesOrigin}${url.pathname}` });
        return route.fulfill({ response });
      }
      if (url.pathname.endsWith("synthetic-film.mp4")) return route.fulfill({ status: 404, body: "Local playback regression fixture." });
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    try {
      const response = await page.goto(`${origin}/fashion/circle-of-fashion`, { timeout: 120000 });
      assert.equal(response.status(), 200);
      await page.getByRole("heading", { name: "Circle of Fashion", exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const article = page.locator(".site-project-detail--fashion");
      const images = article.locator("img");
      assert.equal(await images.count(), 10);
      const expected = fixture.localFashion.filenames.map(filename => `/api/cms/media/file/${filename}`);
      assert.deepEqual(await images.evaluateAll(nodes => nodes.map(node => node.getAttribute("src"))), expected);
      assert.equal(await article.locator("img[loading=eager]").count(), 1);
      assert.equal(await article.locator("img[loading=lazy]").count(), 9);
      await images.evaluateAll(nodes => Promise.all(nodes.map(async node => { node.loading = "eager"; await node.decode(); })));
      assert.ok(await images.evaluateAll(nodes => nodes.every(node => node.naturalWidth === 1920 && node.naturalHeight === 3416 && node.alt)));
      assert.equal(await article.getByText(fixture.localFashion.excerpt, { exact: true }).count(), 1);
      assert.ok(await page.evaluate(() => {
        const main = document.querySelector(".site-project-detail--fashion");
        const intro = main.querySelector(".site-project-excerpt");
        const image = main.querySelector("img");
        return Boolean(intro.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING);
      }));
      checks.push({ width, check: "exact-copy-ten-ordered-images-and-lazy-loading" });
      const layout = await article.evaluate(node => {
        const box = node.getBoundingClientRect();
        const gallery = node.querySelector(".site-project-gallery");
        return { width: box.width, left: box.left, right: innerWidth - box.right,
          columns: getComputedStyle(gallery).gridTemplateColumns.split(" ").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          naturalRatios: [...node.querySelectorAll("img")].every(image => {
            const box = image.getBoundingClientRect();
            return Math.abs(box.width / box.height - 1920 / 3416) < 0.001 && getComputedStyle(image).objectFit === "contain";
          }) };
      });
      assert.ok(layout.width <= 672 && layout.width <= width - 40);
      assert.ok(Math.abs(layout.left - layout.right) < 1);
      assert.equal(layout.columns, 1); assert.equal(layout.overflow, false); assert.equal(layout.naturalRatios, true);
      checks.push({ width, check: "centred-column-uncropped-ratios-no-overflow", layout });
      const session = await context.newCDPSession(page);
      await session.send("DOM.enable"); await session.send("CSS.enable");
      const { root } = await session.send("DOM.getDocument");
      const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: "main h1" });
      const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
      assert.ok(fonts.some(font => font.isCustomFont && /P22 Cezanne Pro/.test(font.familyName) && font.glyphCount > 0));
      await session.detach();
      checks.push({ width, check: "existing-cezanne-font-retained" });
      const back = page.getByRole("link", { name: "All fashion projects", exact: true });
      await back.focus();
      assert.notEqual(await back.evaluate(node => getComputedStyle(node).outlineStyle), "none");
      await page.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); });
      await page.screenshot({ path: join(evidence, `fashion-${width}-viewport.png`) });
      await page.screenshot({ path: join(evidence, `fashion-${width}-full.png`), fullPage: true });
      await back.click(); await page.waitForURL(`${origin}/fashion`);
      await page.getByRole("heading", { name: "Circle of Fashion", exact: true }).waitFor();
      assert.equal(await page.getByText("Private synthetic project", { exact: true }).count(), 0);
      checks.push({ width, check: "keyboard-focus-and-fashion-index-round-trip" });
      for (const path of ["/fashion/private-synthetic-fashion-projects", "/fashion/not-a-project"]) {
        assert.equal((await page.goto(origin + path, { timeout: 120000 })).status(), 404);
      }
      checks.push({ width, check: "draft-and-unknown-slug-remain-404" });
      if (width === 1440) {
        await page.goto(`${origin}/video/synthetic-film-study`, { timeout: 120000 });
        await page.getByRole("heading", { name: "Synthetic film study", exact: true }).waitFor();
        assert.equal(await page.locator("video[controls]").count(), 1);
        assert.equal(await page.locator(".site-project-gallery").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length), 2);
        assert.ok((await page.locator("main").boundingBox()).width > 672);
        checks.push({ width, check: "video-wide-layout-two-column-gallery-and-controls-unchanged" });
      }
      let failedImageRequests = 0;
      await context.route("**/circle-of-fashion-02.jpg?fixture-failure=1", route => { failedImageRequests++; return route.fulfill({ status: 404, body: "Intentional local failure." }); });
      await page.goto(`${origin}/fashion/circle-of-fashion`, { timeout: 120000 });
      await page.locator("main img").evaluateAll(nodes => nodes.forEach(node => { node.loading = "eager"; }));
      // Confirm hydration before inducing an image error; don't race SSR events
      // that can happen before React attaches its existing onError handler.
      await page.getByRole("button", { name: "Colour sound off", exact: true }).click();
      await page.getByRole("button", { name: "Colour sound on", exact: true }).waitFor();
      await page.locator("main img").nth(1).evaluate(node => { node.src = `${node.getAttribute("src")}?fixture-failure=1`; });
      await page.getByText("This media could not be displayed.", { exact: true }).waitFor();
      assert.ok(failedImageRequests > 0);
      assert.equal(await page.getByRole("link", { name: "Open the original file" }).getAttribute("href"), expected[1]);
      checks.push({ width, check: "failed-image-retains-original-file-link" });
      assert.deepEqual(errors, []);
    } catch (error) {
      await page.screenshot({ path: join(evidence, `failure-${width}.png`), fullPage: false });
      await writeFile(join(evidence, `failure-${width}.json`), JSON.stringify({ errors, images: await page.locator("main img").evaluateAll(nodes => nodes.map(node => ({ src: node.src, complete: node.complete, width: node.naturalWidth }))) }, null, 2));
      throw error;
    } finally { await context.close(); }
  }
} catch (error) { failure = error; }
finally {
  await browser.close();
  await writeFile(join(evidence, "result.json"), `${JSON.stringify({ passed: !failure, checks, localFilesOnly: true, productionImport: false, productionPublication: false, error: failure ? String(failure) : null }, null, 2)}\n`);
}
if (failure) throw failure;
console.log(`Passed ${checks.length} Fashion browser checks at 390px and 1440px. Evidence: ${evidence}`);
