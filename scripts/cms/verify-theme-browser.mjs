// Start post-lifecycle-fixture.ts first. No production authentication or writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:3107";
const fixture = await (await fetch("http://127.0.0.1:55440/fixture/state")).json();
assert.equal(fixture.fixture, "arnaud-cms-native-lifecycle");
const evidence = process.env.CMS_THEME_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true, mode: 0o700 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
function contrast(first, second) {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: "dark" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      // Same fixture-only lock-read bypass as the lifecycle browser test: PGlite
      // cannot serve Payload's second lock connection during a transaction.
      if (/^\/api\/cms\/posts\/[0-9a-f-]{36}$/.test(url.pathname) && route.request().method() === "PATCH") {
        url.searchParams.set("overrideLock", "true");
        return route.continue({ url: url.toString() });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      // Payload probes its identity endpoint on the signed-out page.
      if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text());
    });
    const screenshot = async name => { if (evidence) await page.screenshot({ path: join(evidence, `${name}-${width}.png`), fullPage: true }); };
    const assertTheme = async theme => {
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
      // Native responsive navigation animates on first mount; inspect settled views.
      await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth + 1, undefined, { timeout: 5000 });
      const style = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return { scheme: root.colorScheme, background: root.getPropertyValue("--theme-bg").trim(), radius: root.getPropertyValue("--style-radius-s").trim(), overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      assert.equal(style.scheme, theme); assert.equal(style.background, theme === "dark" ? "#000" : "#fff");
      assert.equal(style.radius, "0"); assert.equal(style.overflow, false);
    };
    const noManualPreference = async () => assert.ok(!(await context.cookies()).some(cookie => cookie.name === "payload-theme"));
    const assertInputContrast = async () => {
      const colors = await page.getByLabel("Email", { exact: true }).evaluate(input => ({ text: getComputedStyle(input).color, placeholder: getComputedStyle(input, "::placeholder").color, background: getComputedStyle(input).backgroundColor }));
      assert.ok(contrast(colors.text, colors.background) >= 4.5);
      assert.ok(contrast(colors.placeholder, colors.background) >= 4.5);
    };
    const chooseTheme = async value => {
      await page.locator(`label[for="field-theme-${value}"]`).click();
      await page.waitForFunction(id => document.getElementById(id)?.checked, `field-theme-${value}`);
    };
    try {
      await page.goto(origin + "/cms/login", { timeout: 120000 });
      await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
      await assertTheme("dark"); await noManualPreference();
      await assertInputContrast();
      await screenshot("login-dark");
      await page.emulateMedia({ colorScheme: "light" }); await assertTheme("light"); await noManualPreference();
      await assertInputContrast();
      await page.getByLabel("Email", { exact: true }).focus();
      const focus = await page.getByLabel("Email", { exact: true }).evaluate(input => ({ color: getComputedStyle(input).outlineColor, width: getComputedStyle(input).outlineWidth }));
      assert.equal(focus.color, "rgb(0, 0, 0)"); assert.equal(focus.width, "2px");
      await screenshot("login-light");
      await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(url => !url.pathname.endsWith("/login"));
      await page.goto(origin + "/cms/account");
      await chooseTheme("light");
      await page.emulateMedia({ colorScheme: "dark" }); await assertTheme("light");
      await page.reload(); await assertTheme("light");
      await screenshot("account-light");
      await chooseTheme("dark");
      await page.emulateMedia({ colorScheme: "light" }); await assertTheme("dark");
      await page.reload(); await assertTheme("dark");
      await screenshot("account-dark");
      await chooseTheme("auto");
      await assertTheme("light"); await noManualPreference();
      await page.emulateMedia({ colorScheme: "dark" }); await assertTheme("dark"); await noManualPreference();

      await page.goto(origin + "/cms/collections/posts/create");
      const writing = page.locator('[data-lexical-editor="true"][contenteditable="true"]').first();
      await writing.waitFor({ timeout: 90000 });
      const saved = page.waitForResponse(async response => {
        if (!/^\/api\/cms\/posts(?:\/[0-9a-f-]{36})?$/.test(new URL(response.url()).pathname) || !["POST", "PATCH"].includes(response.request().method()) || !response.ok()) return false;
        const doc = (await response.json()).doc;
        return doc?.title === `Theme fixture ${width}` && JSON.stringify(doc.body).includes("Private theme verification.");
      });
      saved.catch(() => {});
      await page.locator("#field-title").fill(`Theme fixture ${width}`);
      await writing.fill("Private theme verification.");
      const post = (await (await saved).json()).doc;
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(origin + "/cms/collections/posts"); await assertTheme(theme);
        await screenshot(`posts-${theme}`);
        await page.goto(`${origin}/cms/collections/posts/${post.id}`);
        const editor = page.locator('[data-lexical-editor="true"][contenteditable="true"]').first();
        await editor.waitFor({ timeout: 90000 }); await assertTheme(theme);
        await screenshot(`editor-${theme}`);
        await editor.fill("/upload");
        await page.getByRole("option", { name: /upload/i }).first().click();
        await page.getByText("Create New", { exact: true }).filter({ visible: true }).first().waitFor();
        await assertTheme(theme); await screenshot(`media-drawer-${theme}`);
        await page.goto(origin + "/cms/photographs");
        await page.locator(".cms-photographs").waitFor(); await assertTheme(theme);
        const photo = await page.locator(".cms-photographs").evaluate(element => {
          const css = getComputedStyle(element);
          return { background: css.backgroundColor, scheme: css.colorScheme, title: css.getPropertyValue("--journal-title").trim() };
        });
        assert.equal(photo.background, theme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
        assert.equal(photo.scheme, theme); assert.ok(!photo.title.includes("c69b69"));
        await screenshot(`photographs-${theme}`);
        await page.goto(`${origin}/cms/preview?id=${post.id}`);
        await page.getByRole("heading", { name: `Theme fixture ${width}`, exact: true }).waitFor();
        const preview = await page.locator(".cms-preview").evaluate(element => ({ background: getComputedStyle(element).backgroundColor, title: getComputedStyle(element.querySelector("h1")).color }));
        assert.deepEqual(preview, { background: "rgb(9, 8, 7)", title: "rgb(198, 155, 105)" });
      }
      await page.goto(origin + "/blog");
      assert.equal(await page.locator(".journal-shell").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(9, 8, 7)");
      assert.deepEqual(errors, []);
      checks.push({ width, systemInitialTheme: true, liveSystemChanges: true, nativeManualOverridesPersist: true, automaticClearsOverride: true, loginAndEditorAndMediaAndPhotographs: true, publicAndPrivatePreviewUnchanged: true, keyboardFocus: true, inputAndPlaceholderContrast: true, noOverflow: true, noClientErrors: true });
    } catch (error) {
      console.error(JSON.stringify(await page.evaluate(() => ({ path: location.pathname, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("body *")].filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.right > innerWidth + 1; }).slice(0, 12).map(element => ({ tag: element.tagName, className: String(element.className), right: element.getBoundingClientRect().right })) }))));
      await screenshot("failure");
      throw error;
    } finally { await context.close(); }
  }
  const result = { passed: true, fixturesOnly: true, checks };
  if (evidence) await writeFile(join(evidence, "result.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
