// Start post-lifecycle-fixture.ts first. All writing is synthetic and local.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3107";
const fixtureState = async () => {
  const value = await (await fetch("http://127.0.0.1:55440/fixture/state")).json();
  assert.equal(value.fixture, "arnaud-cms-native-lifecycle");
  return value;
};
await fixtureState();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
const evidence = process.env.CMS_LIFECYCLE_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true, mode: 0o700 });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => { void dialog.accept(); });
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      // PGlite serializes all connections during a transaction. Native Payload's
      // document-lock read uses another connection, which cannot be emulated by
      // this fixture. Only bypass that read here; row/revision checks remain on.
      // Real PostgreSQL document-lock concurrency is a separate acceptance gate.
      if (/^\/api\/cms\/posts\/[0-9a-f-]{36}$/.test(url.pathname) && route.request().method() === "PATCH") {
        url.searchParams.set("overrideLock", "true");
        return route.continue({ url: url.toString() });
      }
      return route.continue();
    });
    try {
      await page.goto(`${origin}/cms/login`, { timeout: 120000 });
      await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
      await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(url => !url.pathname.endsWith("/login"));
      await page.goto(`${origin}/cms/collections/posts/create`);
      const editor = page.locator('[data-lexical-editor="true"][contenteditable="true"]').first();
      await editor.waitFor({ timeout: 90000 });
      assert.equal(await page.locator(".bn-editor").count(), 0);
      const initialCount = (await fixtureState()).posts.length;
      // Native media selection is available while the parent post has no ID.
      await editor.fill("/upload");
      await page.getByRole("option", { name: /upload/i }).first().click();
      await page.getByRole("button", { name: /create new/i }).first().waitFor();
      assert.ok((await fixtureState()).posts.length <= initialCount + 1, "Native preparation must not create duplicate drafts");
      await page.keyboard.press("Escape");
      await page.reload();
      await editor.waitFor();
      await page.locator("#field-title").fill(`Native journal ${width}`);
      await editor.fill(`Public native text ${width}.`);
      const created = page.waitForResponse(async response => {
        if (!/^\/api\/cms\/posts(?:\/[0-9a-f-]{36})?$/.test(new URL(response.url()).pathname) || !["POST", "PATCH"].includes(response.request().method())) return false;
        return !response.ok() || (await response.json()).doc?._status === "published";
      });
      await page.getByRole("button", { name: /^Publish/, exact: false }).first().click();
      const published = (await (await created).json()).doc;
      await page.waitForURL(url => url.pathname === `/cms/collections/posts/${published.id}`);
      assert.equal(published._status, "published");
      const publicPage = await browser.newPage();
      await publicPage.goto(`${origin}/blog/${published.slug}`);
      await publicPage.getByText(`Public native text ${width}.`, { exact: true }).waitFor();
      const autosaved = page.waitForResponse(response => new URL(response.url()).pathname === `/api/cms/posts/${published.id}` && response.request().method() === "PATCH" && new URL(response.url()).searchParams.get("draft") === "true" && response.ok());
      await editor.fill(`Private native changes ${width}.`);
      await autosaved;
      await publicPage.reload();
      assert.equal(await publicPage.getByText(`Private native changes ${width}.`, { exact: true }).count(), 0);
      await publicPage.close();
      // Exercise stock native Unpublish and immediate Publish again. This also
      // checks that native form revision state remains usable after the action.
      await page.locator(".doc-controls__popup .popup-button").click();
      await page.locator("#action-unpublish").click();
      const unpublished = page.waitForResponse(response => new URL(response.url()).pathname === `/api/cms/posts/${published.id}` && response.request().method() === "PATCH" && new URL(response.url()).searchParams.get("unpublishAllLocales") === "true");
      await page.getByRole("button", { name: /^Confirm$/ }).last().click();
      assert.equal((await unpublished).status(), 200);
      const [republished] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === `/api/cms/posts/${published.id}` && response.request().method() === "PATCH" && !new URL(response.url()).searchParams.has("draft")),
        page.getByRole("button", { name: /^Publish/ }).first().click(),
      ]);
      assert.equal(republished.status(), 200);
      const republishedDoc = (await republished.json()).doc;
      await page.waitForFunction(revision => document.querySelector("#field-editRevision")?.value === String(revision), republishedDoc.editRevision);
      await page.locator(".status__value").filter({ hasText: /^Published$/ }).waitFor();
      if (evidence) await page.screenshot({ path: join(evidence, `native-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      checks.push({ width, nativeLexical: true, mediaDrawerBeforeParentSave: true, nativePublish: true, privateAutosave: true, stockUnpublishAndRepublish: true });
    } catch (error) {
      console.error((await page.locator("body").innerText()).slice(-6000));
      throw error;
    } finally { await page.close(); }
  }
  const result = { passed: true, fixturesOnly: true, realR2Transfer: false, nativePostgresLockConcurrency: false, checks };
  if (evidence) await writeFile(join(evidence, "result.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
