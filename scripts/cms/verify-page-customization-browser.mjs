// Loopback-only synthetic fixture; mock YouTube transport, never real provider acceptance.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3111", auth = "http://127.0.0.1:55446";
const fixture = await (await fetch(`${auth}/fixture/state`)).json();
assert.equal(fixture.fixture, "arnaud-site-expansion");
assert.equal(fixture.synthetic, true);
assert.equal(fixture.newsletterSending, false);
const evidence = fileURLToPath(new URL("../../.local/page-customization-browser/", import.meta.url));
await mkdir(evidence, { recursive: true, mode: 0o700 });
const image = await readFile(new URL("../../public/test-image.jpg", import.meta.url));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
const mockSDK = `window.__yt=[];window.YT={Player:class{constructor(target,options){this.options=options;this.muted=true;this.state=-1;this.frame=document.createElement('iframe');target.replaceWith(this.frame);window.__yt.push(this);queueMicrotask(()=>options.events.onReady({target:this}))}getIframe(){return this.frame}getPlayerState(){return this.state}isMuted(){return this.muted}mute(){this.muted=true}unMute(){this.muted=false}playVideo(){this.state=1;this.options.events.onStateChange({target:this,data:1})}pauseVideo(){if(this.state!==2){this.state=2;this.options.events.onStateChange({target:this,data:2})}}destroy(){this.frame.remove()}}};`;
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const external = [], errors = [];
    let sdkRequests = 0;
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.href === "https://www.youtube.com/iframe_api") { sdkRequests++; return route.fulfill({ contentType: "text/javascript", body: mockSDK }); }
      if (![origin, auth].includes(url.origin)) { external.push(url.href); return route.abort(); }
      if (url.pathname.startsWith("/api/cms/media/file/") || url.pathname === "/_next/image" || url.pathname.startsWith("/storage/")) {
        return route.fulfill(url.pathname.endsWith(".mp4") || url.pathname.endsWith(".wav") ? { status: 404, body: "Synthetic bytes only" } : { contentType: "image/jpeg", body: image });
      }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on("pageerror", error => errors.push(error.message));
    const visit = async path => { const response = await page.goto(origin + path, { timeout: 120000 }); assert.equal(response.status(), 200, path); };
    const capture = async (name, surface) => {
      await page.evaluate(() => document.fonts.ready);
      if (surface) {
        // Payload's unchanged long-title breadcrumb can overflow at 390px;
        // verify the owned colour controls independently of that native chrome.
        assert.ok(await page.locator(surface).evaluateAll(nodes => nodes.length > 0 && nodes.every(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1; })), name);
      } else assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name);
      await page.screenshot({ path: `${evidence}${name}-${width}.png`, fullPage: true });
    };
    try {
      for (const path of ["/blog/synthetic-journal-study", "/fashion/synthetic-garment-study"]) {
        const html = await (await context.request.get(origin + path)).text();
        assert.match(html, /class="site-shell[^\"]*site-page-palette/);
        assert.match(html, /--page-background:#19232f/);
        await visit(path);
        const colours = await page.locator(".site-shell").evaluate(node => ({ background: getComputedStyle(node).backgroundColor, ink: getComputedStyle(node).color, article: getComputedStyle(node.querySelector("main")).color, header: getComputedStyle(node.querySelector(".site-header")).color }));
        assert.equal(colours.background, "rgb(25, 35, 47)");
        assert.equal(colours.ink, "rgb(255, 255, 255)");
        assert.equal(colours.article, colours.ink);
        assert.equal(colours.header, colours.ink);
        assert.equal(await page.locator(".public-atmosphere").count(), 1);
        await capture(path.includes("/blog/") ? "journal-custom" : "fashion-custom");
        checks.push({ check: "server-first-palette-and-shell", path, width });
      }
      await page.evaluate(() => { window.__paletteAudio = document.querySelector("audio"); });
      await page.getByRole("link", { name: "Journal", exact: true }).click();
      await page.waitForURL(origin + "/blog");
      assert.equal(await page.evaluate(() => window.__paletteAudio === document.querySelector("audio")), true);
      assert.equal(await page.locator(".site-page-palette").count(), 0);
      await page.getByRole("link", { name: "Synthetic journal study", exact: true }).click();
      await page.waitForURL(origin + "/blog/synthetic-journal-study");
      assert.equal(await page.locator(".site-page-palette").count(), 1);
      assert.equal(await page.evaluate(() => window.__paletteAudio === document.querySelector("audio")), true);
      checks.push({ check: "client-navigation-palette-reset-and-persistent-audio", width });

      await visit("/");
      for (const selector of [".site-sound", ".site-footer"]) assert.equal(await page.locator(selector).evaluate(node => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
      assert.ok(await page.getByRole("link", { name: "fixture@example.test", exact: true }).count());
      assert.ok(await page.getByRole("button", { name: "Colour sound off", exact: true }).count());
      await capture("home-transparent-bottom");
      await page.locator(".site-footer").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}home-bottom-viewport-${width}.png` });
      checks.push({ check: "transparent-home-bottom-preserves-controls-contact", width });

      for (const path of ["/video", "/video/synthetic-youtube-study"]) {
        await visit(path);
        await page.locator('iframe[title="Synthetic YouTube source study"]').waitFor();
        assert.equal(sdkRequests, path === "/video" ? 1 : 2);
        if (path === "/video") {
          assert.equal(await page.locator("main h1").textContent(), "Synthetic films");
          assert.deepEqual(await page.locator(".site-project-entry h2").allTextContents(), ["Synthetic YouTube source study", "Synthetic film study"]);
        }
        await capture(path === "/video" ? "video-landing" : "youtube-detail");
        const unmute = page.getByRole("button", { name: "Unmute video: Synthetic YouTube source study", exact: true });
        await unmute.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => window.__yt[0]?.state === 1 && window.__yt[0]?.muted);
        await unmute.click();
        await page.waitForFunction(() => window.__yt[0]?.muted === false);
        assert.equal(await page.locator("iframe").count(), 1);
        await page.getByRole("button", { name: "Mute video: Synthetic YouTube source study", exact: true }).click();
        await unmute.waitFor();
        checks.push({ check: "integrated-default-embed-viewport-autoplay-unmute", path, width });
      }
      assert.equal(sdkRequests, 2, "Each full page initializes the SDK without a Play action");
      for (const path of ["/cms/video-page-preview", "/cms/project-preview?collection=fashion-projects&id=12345678-1234-4234-8234-123456789abc", "/cms/preview?id=12345678-1234-4234-8234-123456789abc"]) {
        const response = await context.request.get(origin + path, { maxRedirects: 0 });
        const body = await response.text();
        // Payload can start streaming its outer shell before Next's redirect.
        assert.ok([302, 303, 307, 308].includes(response.status()) || response.status() === 200 && body.includes("NEXT_REDIRECT") && body.includes("/cms/login"), `Anonymous preview denied: ${path}`);
        assert.doesNotMatch(body, /Private preview\.|Synthetic films|Synthetic journal study|Synthetic garment study/);
      }
      await visit("/cms/login");
      assert.equal(await page.locator(".site-shell, .public-atmosphere, audio").count(), 0);
      await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
      await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/cms");
      const projects = await (await context.request.get(origin + "/api/cms/fashion-projects?depth=0")).json();
      const fashion = projects.docs.find(doc => doc.slug === "synthetic-garment-study");
      await visit(`/cms/collections/fashion-projects/${fashion.id}`);
      await page.getByLabel("Background picker", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Background picker", { exact: true }).inputValue(), "#19232f");
      await capture("cms-palette-controls", ".cms-page-colour");
      await visit(`/cms/project-preview?collection=fashion-projects&id=${fashion.id}`);
      await page.locator(".site-page-palette").waitFor();
      assert.equal(await page.locator(".site-page-palette").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(25, 35, 47)");
      assert.equal(await page.locator(".template-default").evaluate(node => node.classList.contains("site-page-palette")), false);
      await capture("cms-fashion-preview");
      await visit("/cms/video-page-preview");
      await page.getByRole("heading", { name: "Synthetic films", exact: true }).waitFor();
      await page.locator('iframe[title="Synthetic YouTube source study"]').waitFor();
      await page.getByRole("button", { name: "Unmute video: Synthetic YouTube source study", exact: true }).click();
      await page.waitForFunction(() => window.__yt[0]?.muted === false);
      await capture("cms-video-page-preview");
      const posts = await (await context.request.get(origin + "/api/cms/posts?depth=0")).json();
      const post = posts.docs.find(doc => doc.slug === "synthetic-journal-study");
      await visit(`/cms/preview?id=${post.id}`);
      await page.locator(".site-page-palette .journal-article h1").waitFor();
      await capture("cms-journal-preview");
      checks.push({ check: "authenticated-native-colour-controls-and-all-private-previews", width });
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  await writeFile(`${evidence}result.json`, JSON.stringify({ passed: true, syntheticOnly: true, mockYouTubeTransport: true, realYouTubeAcceptance: false, checks }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} finally { await browser.close(); }
