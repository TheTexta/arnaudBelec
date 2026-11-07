// Run only with scripts/orbs-fixture.mjs: no production data or writes.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const origin = "http://127.0.0.1:3112";
const authOrigin = "http://127.0.0.1:55448";
const fixture = await (await fetch(`${authOrigin}/fixture/state`)).json();
assert.equal(fixture.fixture, "arnaud-orbs");
assert.equal(fixture.synthetic, true);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const image = await readFile(new URL("../public/test-image.jpg", import.meta.url));
const evidence = new URL("../.local/orbs-browser/", import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];

async function geometry(orb) {
  return orb.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const section = button.closest("section");
    const stage = section.getBoundingClientRect();
    const photo = section.querySelector(':scope > a, :scope > figure button, :scope > button:not([data-colour-orb])').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width,
      stage: { left: stage.left, top: stage.top, width: stage.width, height: stage.height },
      photo: { left: photo.left, top: photo.top, right: photo.right, bottom: photo.bottom } };
  });
}

async function frames(page, count = 12) {
  await page.evaluate(count => new Promise(resolve => {
    const frame = () => { if (--count <= 0) resolve(); else requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }), count);
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function assertContained(point) {
  const { stage, photo } = point;
  assert.ok(point.x >= stage.left + 9.9 && point.x <= stage.left + stage.width - 9.9, "Horizontal hero containment");
  assert.ok(point.y >= stage.top + 9.9 && point.y <= stage.top + stage.height - 9.9, "Vertical hero containment");
  const closest = { x: Math.max(photo.left, Math.min(point.x, photo.right)), y: Math.max(photo.top, Math.min(point.y, photo.bottom)) };
  assert.ok(distance(point, closest) >= 9.9, "Orb centre must remain outside the photograph");
}

async function visibleOrb(page) {
  const id = await page.locator("button[data-colour-orb]").evaluateAll(buttons => {
    return buttons.filter(button => {
      const rect = button.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === button;
    }).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]?.dataset.colourOrb;
  });
  assert.ok(id, "An orb has a visible, unobscured drag handle");
  return page.locator(`button[data-colour-orb="${id}"]`);
}

try {
  for (const width of [1440, 390]) {
    for (const mode of ["normal", "reduced-motion", "css-fallback"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width === 390,
        reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference" });
      await context.addInitScript(({ fallback }) => {
        window.__orbChords = 0;
        window.addEventListener("arnaud:colour-chord", () => window.__orbChords++);
        if (fallback) {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
            return String(kind).includes("webgl") ? null : getContext.call(this, kind, ...args);
          };
        }
      }, { fallback: mode === "css-fallback" });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (![origin, authOrigin].includes(url.origin)) return route.abort("blockedbyclient");
        if (url.pathname === "/_next/image" || url.pathname.startsWith("/storage/v1/object/public/")) {
          return route.fulfill({ contentType: "image/jpeg", body: image });
        }
        return route.continue();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      try {
        for (const path of ["/photos", "/photos/synthetic-study-1.jpg"]) {
          const name = `${path === "/photos" ? "archive" : "detail"}-${width}-${mode}`;
          const response = await page.goto(origin + path, { timeout: 120000 });
          assert.equal(response.status(), 200);
          await page.waitForFunction(() => document.querySelector("[data-colour-orb]")?.parentElement.style.opacity === "1");
          await page.waitForFunction(expected => document.querySelector("[data-renderer]")?.dataset.renderer === expected,
            mode === "css-fallback" ? "css" : "webgl");
          const orb = await visibleOrb(page);
          const id = await orb.getAttribute("data-colour-orb");
          let point = await geometry(orb);
          assert.ok(point.size >= 44 && point.size <= 80, "Small accessible hit target, not viewport-wide");

          // Rounded button corners and the diffuse wash must not become hit targets.
          await page.mouse.move(point.x + point.size / 2 - 1, point.y + point.size / 2 - 1);
          assert.equal(await page.evaluate(({ x, y, size, id }) =>
            document.elementFromPoint(x + size / 2 - 1, y + size / 2 - 1)?.closest("[data-colour-orb]")?.dataset.colourOrb === id,
          { ...point, id }), false);
          assert.equal(await orb.getAttribute("data-hovered"), "false");
          await page.mouse.move(point.x, point.y);
          assert.equal(await orb.evaluate(button => getComputedStyle(button).cursor), "grab");
          assert.equal(await orb.getAttribute("data-hovered"), "true");

          // A press holds still; minor pointer jitter is still a click, exactly once.
          await page.mouse.down();
          const held = await geometry(orb);
          await frames(page);
          assert.ok(distance(held, await geometry(orb)) < 0.1, "No automatic drift while held");
          assert.equal(await orb.getAttribute("aria-pressed"), "false", "No selection on pointer-down");
          assert.equal(await orb.evaluate(button => getComputedStyle(button).cursor), "grabbing");
          await page.mouse.move(held.x + 3, held.y);
          await page.mouse.up();
          assert.equal(await orb.getAttribute("aria-pressed"), "true");
          assert.equal(await page.evaluate(() => window.__orbChords), 1);
          await orb.focus();
          await page.keyboard.press("Enter");
          assert.equal(await orb.getAttribute("aria-pressed"), "false");
          await page.keyboard.press("Space");
          assert.equal(await orb.getAttribute("aria-pressed"), "true");
          assert.equal(await orb.evaluate(button => button.matches(":focus-visible")), true);
          assert.equal(await page.evaluate(() => window.__orbChords), 3);

          // Drag with an off-centre grab, including capture over the photograph.
          point = await geometry(orb);
          await page.mouse.move(point.x + 5, point.y);
          await page.mouse.down();
          const { stage, photo } = point;
          await page.mouse.move((photo.left + photo.right) / 2, (photo.top + photo.bottom) / 2, { steps: 8 });
          assertContained(await geometry(orb));
          await page.mouse.move(-40, -40, { steps: 8 });
          assertContained(await geometry(orb));
          const target = { x: stage.left + stage.width * 0.3, y: Math.min(stage.top + stage.height - 70, 930) };
          await page.mouse.move(target.x + 5, target.y, { steps: 8 });
          const dropped = await geometry(orb);
          assert.ok(distance(dropped, target) < 1, "Orb follows the pointer without snapping the grab offset");
          assertContained(dropped);
          await page.mouse.up();
          assert.equal(await orb.getAttribute("data-dragging"), "false");
          assert.equal(await orb.getAttribute("aria-pressed"), "true", "Dragging preserves selection");
          assert.equal(await page.evaluate(() => window.__orbChords), 3, "Dragging is silent");
          await page.mouse.move(1, 1);
          await frames(page, 24);
          const settled = await geometry(orb);
          if (mode === "reduced-motion") assert.ok(distance(dropped, settled) < 0.1, "Reduced motion stays still after release");
          else assert.ok(distance(dropped, settled) > 0.5 && distance(dropped, settled) < 20, "Gentle drift resumes from the drop");

          if (mode === "css-fallback") {
            const alignment = await orb.evaluate(button => {
              const hex = button.querySelector("canvas").style.getPropertyValue("--orb-colour");
              const glow = [...button.closest("section").querySelectorAll("[data-renderer] div")]
                .find(element => element.style.getPropertyValue("--orb-colour") === hex);
              const a = button.getBoundingClientRect(), b = glow.getBoundingClientRect();
              return Math.hypot(a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2);
            });
            assert.ok(alignment < 1, "CSS wash follows the same orb position");
          }

          // Unexpected lost capture cancels cleanly and does not activate a colour.
          const captureOrb = await visibleOrb(page);
          point = await geometry(captureOrb);
          await page.mouse.move(point.x, point.y);
          await page.mouse.down();
          assert.equal(await captureOrb.getAttribute("data-dragging"), "true");
          // Flush Chromium's pending gotpointercapture before testing capture loss.
          await page.mouse.move(point.x + 1, point.y);
          await captureOrb.evaluate(button => {
            // Mouse pointer ID is 1 in Chromium's native mouse input.
            button.releasePointerCapture(1);
          });
          await page.mouse.move(point.x + 2, point.y);
          await page.waitForFunction(id => document.querySelector(`[data-colour-orb="${id}"]`)?.dataset.dragging === "false",
            await captureOrb.getAttribute("data-colour-orb"));
          await page.mouse.up();
          assert.equal(await captureOrb.getAttribute("data-dragging"), "false");
          assert.equal(await page.evaluate(() => window.__orbChords), 3, `${name}: lost capture never selects`);

          if (width === 390) {
            // Real touchscreen events, not synthetic DOM pointer dispatches.
            const touch = await context.newCDPSession(page);
            try {
              const touchOrb = await visibleOrb(page);
              point = await geometry(touchOrb);
              const selected = await touchOrb.getAttribute("aria-pressed");
              const target = { x: point.stage.left + point.stage.width * 0.65, y: Math.min(point.stage.top + point.stage.height - 90, 910) };
              await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
              await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [target] });
              await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
              assert.ok(distance(await geometry(touchOrb), target) < 3, "Touch dragging follows the finger");
              assert.equal(await touchOrb.getAttribute("aria-pressed"), selected);
              assert.equal(await page.evaluate(() => window.__orbChords), 3);
              point = await geometry(touchOrb);
              await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
              assert.equal(await touchOrb.getAttribute("data-dragging"), "true");
              await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
              assert.equal(await touchOrb.getAttribute("data-dragging"), "false");
              assert.equal(await page.evaluate(() => window.__orbChords), 3, "Touch cancellation never selects");

              // Touch taps activate once each, without a second synthetic click.
              for (let tap = 0; tap < 2; tap++) {
                point = await geometry(touchOrb);
                await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
                await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
                assert.equal(await touchOrb.getAttribute("aria-pressed"), tap === 0 ? String(selected !== "true") : selected);
                assert.equal(await page.evaluate(() => window.__orbChords), 4 + tap);
              }

              // Start away from handles: the photograph retains native page panning.
              point = await geometry(touchOrb);
              const start = { x: (point.photo.left + point.photo.right) / 2, y: (point.photo.top + point.photo.bottom) / 2 };
              await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
              for (let step = 1; step <= 6; step++) await touch.send("Input.dispatchTouchEvent", {
                type: "touchMove", touchPoints: [{ x: start.x, y: start.y - step * 30 }],
              });
              await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
              await page.waitForFunction(() => scrollY > 30);
              await page.evaluate(() => scrollTo(0, 0));
            } finally { await touch.detach(); }
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, evidence)) });
          checks.push({ path, width, mode, smallCircularTargets: true, pointerAndKeyboardSelection: true,
            boundedDrag: true, noDragSelectionOrChord: true, releaseMotion: true, captureCancellation: true,
            touchDragAndNativeScroll: width === 390 });
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  }
  await writeFile(new URL("result.json", evidence), JSON.stringify({ passed: true, synthetic: true, checks }, null, 2));
  console.log(`Passed ${checks.length} desktop/mobile orb scenarios (WebGL, reduced motion and CSS fallback).`);
} finally { await browser.close(); }
