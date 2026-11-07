// Synthetic-only homepage/CMS acceptance. Never loads .env or real credentials.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3111", authOrigin = "http://127.0.0.1:55446";
const fixture = await (await fetch(`${authOrigin}/fixture/state`)).json();
assert.equal(fixture.fixture, "arnaud-site-expansion"); assert.equal(fixture.synthetic, true);
const evidence = fileURLToPath(new URL("../../.local/homepage-browser/", import.meta.url));
await mkdir(evidence, { recursive: true, mode: 0o700 });
const landscape = await readFile(new URL("../../public/test-image.jpg", import.meta.url));
const portrait = await sharp(landscape).resize(720, 1080, { fit: "cover" }).jpeg().toBuffer();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [], errors = [];
let failure;
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  await ctx.route("**/*", route => {
    const url = new URL(route.request().url());
    if (![origin, authOrigin].includes(url.origin)) return route.abort("blockedbyclient");
    if (url.pathname.startsWith("/api/cms/media/file/") && url.pathname.endsWith(".jpg")) return route.fulfill({ contentType: "image/jpeg", body: url.pathname.includes("back") ? portrait : landscape });
    if (url.pathname === "/_next/image" || url.pathname.startsWith("/storage/v1/object/public/")) return route.fulfill({ contentType: "image/jpeg", body: landscape });
    return route.continue();
  });
  return ctx;
}
async function settled(page) {
  await page.locator(".home-entrance").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".home-preview img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
}
async function api(page, path = "", method = "GET", data) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(`/api/cms/globals/site-settings${path}`, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}
async function savedSettings(page, path, matches) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const result = await api(page, path);
    if (result.status === 200 && matches(result.body)) return result.body;
    await delay(150);
  }
  throw new Error(`Native Site settings did not reach the expected state: ${path}`);
}
try {
  for (const width of process.env.HOME_CMS_ONLY ? [] : [390, 1280, 1440]) {
    const ctx = await context({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const page = await ctx.newPage(); page.setDefaultTimeout(60000);
    page.on("pageerror", error => errors.push(`${page.url()}: ${error.stack || error.message}`));
    page.on("console", message => { if (message.type() === "error" && /shader|GL_INVALID|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    try {
      await page.goto(origin, { timeout: 120000 }); await settled(page);
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "visible");
      assert.equal(await page.locator(".home-preview img").count(), 4);
      assert.equal(await page.locator(".home-fluid canvas").count(), 1);
      assert.equal(await page.locator(".site-shell--entrance").count(), 1);
      assert.equal(await page.locator(".public-atmosphere").count(), 0);
      for (const href of ["/photos", "/blog", "/video", "/fashion"]) assert.equal(await page.locator(`.home-scene a[href="${href}"]`).count(), 1);
      const bounds = await page.locator(".home-preview").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; }));
      await page.screenshot({ path: `${evidence}/home-${width}.png`, fullPage: true });
      for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
        const a = bounds[i], b = bounds[j];
        assert.ok(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${width}: previews ${i}/${j} overlap: ${JSON.stringify(bounds)}`);
      }
      assert.ok(new Set(bounds.map(box => Math.round(box.width))).size >= 3, "Varying image sizes, not equal cards");
      if (width > 700) assert.ok(bounds.every(box => box.bottom < 900), "All four section links fit the desktop opening");
      if (width === 1440) {
        await page.mouse.move(80, 350);
        await page.mouse.move(1140, 560, { steps: 35 });
        await page.screenshot({ path: `${evidence}/cursor-1440.png`, fullPage: true });
        assert.equal(await page.locator(".home-fluid canvas").evaluate(canvas => {
          window.__homepageContext = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
          window.__homepageContext?.loseContext();
          return Boolean(window.__homepageContext);
        }), true);
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "hidden");
        await page.evaluate(() => window.__homepageContext.restoreContext());
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "visible");
        assert.equal(await page.locator(".home-fluid canvas").count(), 1);
        checks.push({ check: "homepage-webgl-context-loss-and-recovery" });
        await page.locator(".home-preview").first().focus();
        assert.notEqual(await page.locator(".home-preview").first().evaluate(node => getComputedStyle(node).outlineStyle), "none");
        await page.keyboard.press("Enter"); await page.waitForURL("**/photos");
        assert.equal(await page.locator(".home-fluid").count(), 0);
        assert.equal(await page.locator(".public-atmosphere").count(), 0);
        assert.equal(await page.locator(".site-shell--entrance").count(), 0);
        const missing = await page.goto(`${origin}/not-a-real-section`, { timeout: 120000 });
        assert.equal(missing.status(), 404);
        assert.equal(await page.locator(".site-shell--entrance").count(), 0);
        if (await page.locator(".site-shell").count()) assert.equal(await page.locator(".site-shell").evaluate(node => getComputedStyle(node).getPropertyValue("--site-ink").trim()), "#25334b");
      }
      checks.push({ check: "compact-staggered-layout-links-focus-and-route-isolation", width });
    } finally { await ctx.close(); }
  }
  for (const mode of process.env.HOME_CMS_ONLY ? [] : ["reduced-motion", "webgl-unavailable"]) {
    const ctx = await context({ reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference" });
    if (mode === "webgl-unavailable") await ctx.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return String(kind).includes("webgl") ? null : getContext.call(this, kind, ...args); };
    });
    const page = await ctx.newPage();
    try {
      await page.goto(origin, { timeout: 120000 }); await settled(page);
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "hidden");
      assert.notEqual(await page.locator(".home-fluid").evaluate(node => getComputedStyle(node).backgroundImage), "none");
      await page.mouse.move(900, 400);
      await page.screenshot({ path: `${evidence}/${mode}.png`, fullPage: true });
      checks.push({ check: mode, staticFallback: true });
    } finally { await ctx.close(); }
  }
  const ctx = await context(), page = await ctx.newPage(); page.setDefaultTimeout(60000);
  page.on("pageerror", error => errors.push(`${page.url()}: ${error.stack || error.message}`));
  try {
    await page.goto(origin, { timeout: 120000 }); await settled(page);
    assert.equal((await api(page, "/homepage-photographs")).status, 403);
    await page.goto(`${origin}/cms/login`, { timeout: 120000 });
    await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
    await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(url => !url.pathname.endsWith("/login"));
    await page.goto(`${origin}/cms/globals/site-settings`, { timeout: 120000 });
    await page.getByLabel("Fluid colour A", { exact: true }).waitFor();
    assert.equal(await page.locator('input[type="color"]').count(), 3);
    assert.equal((await api(page, "/homepage-photographs")).body.photographs.length, 2);
    await page.screenshot({ path: `${evidence}/payload-homepage.png`, fullPage: true });
    const initial = await api(page, "?depth=0"); assert.equal(initial.status, 200);
    const working = (await api(page, "?draft=true&depth=0")).body;
    const changedColour = working.homepage.palette.fluidA === "#df187f" ? "#e21880" : "#df187f";
    const originalPalette = initial.body.homepage.palette;
    await page.getByLabel("Fluid colour A", { exact: true }).fill(changedColour);
    await page.getByLabel("Fluid colour A", { exact: true }).blur();
    // Native autosave must persist the field as a private version.
    await savedSettings(page, "?draft=true&depth=0", doc => doc.homepage?.palette?.fluidA === changedColour);
    assert.equal((await api(page, "?depth=0")).body.homepage.palette.fluidA, originalPalette.fluidA);
    checks.push({ check: "payload-colour-picker-native-autosave-is-private" });
    // Select a catalogue photograph through the actual visual picker.
    await page.getByRole("combobox", { name: "Photography image source" }).selectOption("photograph");
    await page.getByRole("button", { name: "Synthetic photo study 2", exact: true }).click();
    const draft = await savedSettings(page, "?draft=true&depth=0", doc => doc.homepage?.photography?.source === "photograph" && doc.homepage?.photography?.photographId === fixture.photoIds[1]);
    assert.equal(draft.homepage.photography.photographId, fixture.photoIds[1], JSON.stringify(draft.homepage));
    // Use the native Publish button, not a privileged test-only write path.
    await page.getByRole("button", { name: /^Publish(?: changes)?$/ }).click();
    await savedSettings(page, "?depth=0", doc => doc.homepage?.photography?.source === "photograph" && doc.homepage?.palette?.fluidA === changedColour);
    await page.goto(origin); await settled(page);
    assert.ok((await page.locator(".home-preview--photography img").getAttribute("src")).includes("synthetic-study-2") || (await page.locator(".home-preview--photography img").getAttribute("src")).includes("uploads"));
    assert.ok((await page.locator(".home-fluid").getAttribute("style")).includes(changedColour));
    checks.push({ check: "payload-visual-photo-picker-publish-and-public-palette" });
    // Empty and image-error states keep every section navigable.
    const current = (await api(page, "?draft=true&depth=0")).body;
    const cleared = Object.fromEntries(["photography", "journal", "video", "fashion"].map(key => [key, { source: "none" }]));
    assert.equal((await api(page, "", "POST", { _status: "published", editRevision: current.editRevision, homepage: { ...cleared, palette: originalPalette } })).status, 200);
    await page.reload(); await settled(page);
    assert.equal(await page.locator(".home-preview img").count(), 0);
    assert.equal(await page.locator(".home-preview").count(), 4);
    await page.screenshot({ path: `${evidence}/empty-homepage.png`, fullPage: true });
    checks.push({ check: "explicit-empty-settings-retain-all-four-links" });
    // Return the disposable fixture to its original published home for other checks.
    const final = (await api(page, "?draft=true&depth=0")).body;
    assert.equal((await api(page, "", "POST", { _status: "published", editRevision: final.editRevision, homepage: initial.body.homepage })).status, 200);
    await page.route("**/api/cms/media/file/*.jpg", route => route.fulfill({ status: 404, body: "Synthetic missing image" }));
    await page.reload(); await page.locator(".home-preview-status").first().waitFor();
    assert.equal(await page.locator(".home-preview").count(), 4);
    await page.screenshot({ path: `${evidence}/image-error.png`, fullPage: true });
    checks.push({ check: "missing-images-retain-labelled-section-links" });
  } catch (error) {
    await page.screenshot({ path: `${evidence}/failed-payload-homepage.png`, fullPage: true });
    throw error;
  } finally { await ctx.close(); }
  assert.deepEqual(errors, []);
} catch (error) { failure = error; }
finally {
  await browser.close();
  const result = { passed: !failure, syntheticOnly: true, realContentAcceptance: false, productionWrites: false, checks, errors, ...(failure ? { error: String(failure.stack || failure) } : {}) };
  await writeFile(`${evidence}/result.json`, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}
if (failure) throw failure;
