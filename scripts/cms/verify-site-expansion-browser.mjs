// Run only against site-expansion-fixture.ts. Assets/content are synthetic.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3111";
const authOrigin = "http://127.0.0.1:55446";
const fixture = await (await fetch(`${authOrigin}/fixture/state`)).json();
assert.equal(fixture.fixture, "arnaud-site-expansion");
assert.equal(fixture.synthetic, true);
assert.equal(fixture.newsletterSending, false);
const evidence = fileURLToPath(new URL("../../.local/site-expansion-browser/", import.meta.url));
await mkdir(evidence, { recursive: true, mode: 0o700 });
const image = await readFile(new URL("../../public/test-image.jpg", import.meta.url));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
let failure;
try {
  // Browser-generated PCM silence: no downloaded, licensed or real audio asset.
  const generator = await browser.newPage();
  const wav = Buffer.from(await generator.evaluate(() => {
    const size = 8000 * 2 * 30;
    const bytes = new Uint8Array(44 + size); const view = new DataView(bytes.buffer);
    const text = (offset, value) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, 36 + size, true); text(8, "WAVE"); text(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, "data"); view.setUint32(40, size, true); return Array.from(bytes);
  }));
  await generator.close();
  async function contextFor(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
    await context.addInitScript(() => {
      window.__fixtureVoices = 0;
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...args) {
        window.__fixtureVoices++;
        return original.apply(this, args);
      };
    });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      // Block all outside traffic, even if a production URL leaks into markup.
      if (![origin, authOrigin].includes(url.origin)) return route.abort("blockedbyclient");
      if (url.pathname === "/_next/image" || url.pathname.startsWith("/storage/v1/object/public/")) return route.fulfill({ contentType: "image/jpeg", body: image });
      if (url.pathname.startsWith("/api/cms/media/file/")) {
        if (url.pathname.endsWith(".jpg")) return route.fulfill({ contentType: "image/jpeg", body: image });
        if (url.pathname.endsWith(".wav")) return route.fulfill({ contentType: "audio/wav", headers: { "accept-ranges": "bytes" }, body: wav });
        // Deliberate local media failure tests honest player errors, not provider playback.
        return route.fulfill({ status: 404, contentType: "text/plain", body: "Synthetic video bytes are intentionally unavailable." });
      }
      return route.continue();
    });
    return context;
  }
  async function inspect(page, path, name, width, expected) {
    const response = await page.goto(`${origin}${path}`, { timeout: 120000 });
    assert.equal(response?.status(), 200, path);
    await page.locator("main").first().waitFor();
    if (expected) await page.getByRole("heading", { name: expected }).first().waitFor();
    assert.ok(await page.getByRole("heading").count(), `${path} needs a heading`);
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, undefined, { timeout: 10000 });
    assert.ok(await page.locator(".public-atmosphere canvas").count() <= 1, `${path}: stacked atmosphere`);
    if (path.startsWith("/photos")) assert.equal(await page.locator(".public-atmosphere").count(), 0);
    assert.equal(await page.getByText("Private synthetic project", { exact: true }).count(), 0);
    await page.evaluate(() => document.fonts.ready);
    await page.locator("img").evaluateAll(nodes => Promise.all(nodes.map(async node => { node.loading = "eager"; await node.decode(); })));
    try {
      await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].every(node => !node.textContent.includes("Loading image"))
        && [...document.querySelectorAll("video")].every(video => video.error || video.readyState >= 2));
    } catch (error) {
      await page.screenshot({ path: join(evidence, `failed-settled-${name}-${width}.png`), fullPage: true });
      await writeFile(join(evidence, `failed-settled-${name}-${width}.json`), JSON.stringify(await page.evaluate(() => ({
        url: location.href, statuses: [...document.querySelectorAll('[role="status"]')].map(node => node.textContent),
        images: [...document.images].map(node => ({ src: node.src, complete: node.complete, width: node.naturalWidth, height: node.naturalHeight })),
      })), null, 2));
      throw error;
    }
    await page.screenshot({ path: join(evidence, `${name}-${width}.png`), fullPage: true });
    checks.push({ check: "route", path, width, noOverflow: true, syntheticContent: true });
  }
  async function assertCezanne(page, selector) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("DOM.enable"); await session.send("CSS.enable");
      const { root } = await session.send("DOM.getDocument");
      const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      assert.ok(nodeId, `Font target exists: ${selector}`);
      const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
      assert.ok(fonts.some(font => font.isCustomFont && /P22 Cezanne Pro/.test(font.familyName) && font.glyphCount > 0), `P22 Cezanne Pro renders ${selector}`);
    } finally { await session.detach(); }
  }
  for (const width of [390, 1440]) {
    const context = await contextFor({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    try {
      await inspect(page, "/", "home", width);
      await page.getByText("Synthetic local portfolio studies.", { exact: false }).first().waitFor();
      const sound = page.getByRole("region", { name: "Optional sound" });
      await sound.getByRole("button", { name: "Colour sound off", exact: true }).waitFor();
      assert.equal(await sound.getByRole("button", { name: "Colour sound off" }).getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator("audio").evaluateAll(nodes => nodes.every(node => node.paused)), true);
      checks.push({ check: "sound-off-by-default", width });

      await inspect(page, "/photos", "photos", width);
      await assertCezanne(page, 'button[aria-pressed]');
      checks.push({ check: "photography-controls-use-cezanne", width });
      // The fixture has actual curated IDs, not flattened string arrays.
      for (const label of ["Colour", "Black & white", "All"]) {
        const control = page.getByRole("button", { name: label, exact: true });
        if (await control.count()) await control.click();
        else await page.getByRole("link", { name: label, exact: true }).first().click();
        await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
      }
      await page.locator("button[data-colour-orb]").first().focus(); await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => window.__fixtureVoices), 0, "Colour selection must stay silent before opt-in");
      await inspect(page, "/photos/synthetic-study-1.jpg", "photo-detail", width);
      await inspect(page, "/blog", "blog", width);
      await inspect(page, "/blog/synthetic-journal-study", "journal", width, "Synthetic journal study");
      await page.getByText("This synthetic journal entry checks readable editorial content", { exact: false }).waitFor();
      const paragraph = page.getByText("This synthetic journal entry checks readable editorial content", { exact: false });
      const typography = await paragraph.evaluate(node => ({ size: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }));
      assert.ok(typography.size >= 16 && typography.line >= typography.size * 1.35, "Journal body must remain readable");
      const fonts = await context.newCDPSession(page);
      await fonts.send("DOM.enable"); await fonts.send("CSS.enable");
      const { root: documentNode } = await fonts.send("DOM.getDocument");
      const platformFonts = {};
      for (const [label, selector, expected] of [["display", "main h1", /P22 Cezanne Pro/], ["body", ".journal-content p", /P22 Cezanne Pro/]]) {
        const { nodeId } = await fonts.send("DOM.querySelector", { nodeId: documentNode.nodeId, selector });
        const { fonts: used } = await fonts.send("CSS.getPlatformFontsForNode", { nodeId });
        assert.ok(used.some(font => font.isCustomFont && expected.test(font.familyName) && font.glyphCount > 0), `${label}: real intended custom font must render glyphs, not fallback`);
        platformFonts[label] = used;
      }
      await writeFile(join(evidence, `platform-fonts-${width}.json`), JSON.stringify(platformFonts, null, 2));
      await fonts.detach();
      checks.push({ check: "local-cezanne-pro-rendered-glyphs", width });
      await inspect(page, "/video", "video", width);
      await inspect(page, "/video/synthetic-film-study", "video-detail", width, "Synthetic film study");
      assert.ok(await page.locator("video[controls]").count(), "Film retains usable native controls on media failure");
      await inspect(page, "/fashion", "fashion", width);
      await inspect(page, "/fashion/synthetic-garment-study", "fashion-detail", width, "Synthetic garment study");
      const sequence = page.getByRole("group", { name: /image sequence/ });
      await sequence.focus(); await page.keyboard.press("End");
      await page.getByRole("status").filter({ hasText: "View 2 of 2" }).waitFor();
      await page.keyboard.press("Home");
      await page.getByRole("status").filter({ hasText: "View 1 of 2" }).waitFor();
      await page.keyboard.press("ArrowRight");
      await page.getByRole("status").filter({ hasText: "View 2 of 2" }).waitFor();
      checks.push({ check: "turntable-keyboard", width });
      if (width === 390) {
        await sequence.focus(); await page.keyboard.press("Home");
        await sequence.scrollIntoViewIfNeeded();
        const box = await sequence.boundingBox(); assert.ok(box);
        const touch = await context.newCDPSession(page);
        const point = { x: box.x + 40, y: box.y + Math.min(box.height / 2, 80) };
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
        await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + 80 }] });
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.getByRole("status").filter({ hasText: "View 2 of 2" }).waitFor();
        await touch.detach();
        checks.push({ check: "turntable-touch-drag", width });
      }

      // Prove a client navigation retains the same actual audio DOM node and state.
      await page.goto(origin, { timeout: 120000 });
      await page.getByRole("button", { name: "Colour sound off", exact: true }).click();
      await page.getByRole("button", { name: "Colour sound on", exact: true }).waitFor();
      await page.evaluate(() => { window.__fixtureAudio = document.querySelector("audio"); });
      await page.getByRole("button", { name: "Play music", exact: true }).click();
      await page.getByRole("button", { name: "Pause music", exact: true }).waitFor();
      await page.locator('a[href="/photos"]').first().click();
      await page.waitForURL(url => url.pathname === "/photos");
      assert.equal(await page.evaluate(() => window.__fixtureAudio === document.querySelector("audio")), true);
      await page.getByRole("button", { name: "Colour sound on", exact: true }).waitFor();
      assert.equal(await page.locator(".public-atmosphere").count(), 0);
      await page.locator("button[data-colour-orb]").first().focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__fixtureVoices === 4);
      checks.push({ check: "audio-provider-client-navigation-and-chord-opt-in", width });
      await page.evaluate(async () => {
        const other = document.createElement("audio");
        other.id = "fixture-other-audio";
        other.src = "/api/cms/media/file/synthetic-ambient.wav";
        document.body.append(other);
        await other.play();
      });
      await page.getByText("Music paused for other media.", { exact: false }).waitFor();
      assert.equal(await page.evaluate(() => window.__fixtureAudio.paused), true);
      await page.evaluate(() => { const other = document.querySelector("#fixture-other-audio"); other.pause(); other.remove(); });
      assert.equal(await page.evaluate(() => window.__fixtureAudio.paused), true, "Music must not restart automatically");
      checks.push({ check: "native-audio-pauses-ambient-without-auto-resume", width });
      for (const path of ["/video/private-synthetic-videos", "/fashion/private-synthetic-fashion-projects", "/blog/private-synthetic-journal"]) {
        const response = await page.goto(origin + path, { timeout: 120000 });
        assert.equal(response?.status(), 404, `Draft leaked: ${path}`);
        checks.push({ check: "draft-404", path, width });
      }
      await page.goto(origin + "/cms/login", { timeout: 120000 });
      await page.getByLabel("Email", { exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await assertCezanne(page, ".cms-session button");
      checks.push({ check: "native-admin-controls-use-cezanne", width });
      assert.equal(await page.locator(".public-atmosphere").count(), 0);
      await page.screenshot({ path: join(evidence, `admin-isolation-${width}.png`), fullPage: true });
      checks.push({ check: "admin-atmosphere-isolation", width });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  for (const mode of ["reduced-motion", "webgl-unavailable"]) {
    const context = await contextFor({ reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference" });
    if (mode === "webgl-unavailable") await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        if (String(kind).includes("webgl")) return null;
        return original.call(this, kind, ...args);
      };
    });
    const page = await context.newPage();
    try {
      await inspect(page, "/", mode, 1440);
      await inspect(page, "/blog/synthetic-journal-study", `${mode}-journal`, 1440, "Synthetic journal study");
      assert.ok(await page.locator(".public-atmosphere").count() === 1);
      if (mode === "webgl-unavailable") {
        await page.waitForFunction(() => [...document.querySelectorAll(".public-atmosphere canvas")].every(node => getComputedStyle(node).visibility === "hidden"));
        assert.notEqual(await page.locator(".public-atmosphere").evaluate(node => getComputedStyle(node).backgroundImage), "none");
      } else {
        assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".public-atmosphere canvas")).visibility === "visible");
        const before = await page.locator(".public-atmosphere canvas").evaluate(canvas => canvas.toDataURL());
        await page.mouse.move(100, 100);
        await page.waitForTimeout(250);
        assert.equal(await page.locator(".public-atmosphere canvas").evaluate(canvas => canvas.toDataURL()), before, "Reduced-motion texture stays frozen after pointer movement");
      }
      checks.push({ check: mode, readableJournal: true });
    } finally { await context.close(); }
  }
  const recoveryContext = await contextFor();
  const recovery = await recoveryContext.newPage();
  try {
    await inspect(recovery, "/", "context-recovery-before", 1440);
    await recovery.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "visible");
    assert.equal(await recovery.locator(".home-fluid canvas").evaluate(canvas => {
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      window.__fixtureContextLoss = gl?.getExtension("WEBGL_lose_context");
      window.__fixtureContextLoss?.loseContext();
      return Boolean(window.__fixtureContextLoss);
    }), true);
    await recovery.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "hidden");
    await recovery.screenshot({ path: join(evidence, "context-lost-1440.png"), fullPage: true });
    await recovery.evaluate(() => window.__fixtureContextLoss.restoreContext());
    await recovery.waitForFunction(() => getComputedStyle(document.querySelector(".home-fluid canvas")).visibility === "visible");
    assert.equal(await recovery.locator(".home-fluid canvas").count(), 1);
    await recovery.screenshot({ path: join(evidence, "context-restored-1440.png"), fullPage: true });
    checks.push({ check: "webgl-context-loss-and-recovery", width: 1440 });
  } finally { await recoveryContext.close(); }
} catch (error) { failure = error; }
finally {
  await browser.close();
  const result = { passed: !failure, syntheticOnly: true, realContentAcceptance: false, realMediaTransfer: false,
    realFilmPlayback: false, emptySectionsExercised: false, journalInlineMediaExercised: false,
    externalFontsBlockedFallbackUsed: false, fontSource: "owner-supplied P22 Cezanne Pro via next/font/local", checks, ...(failure ? { error: String(failure.stack || failure) } : {}) };
  await writeFile(join(evidence, "result.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}
if (failure) throw failure;
