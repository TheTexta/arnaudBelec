// Isolated synthetic verification. Never loads .env, uses a real catalogue, logs
// in, initializes CMS/Postgres, or allows outbound provider/browser requests.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as portProbe } from "node:net";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rgbToHex, rgbToLab } from "../lib/palette/oklab-k-medoids.mjs";

const build = process.argv[2] === "--build";
if (process.argv.length > (build ? 3 : 2)) throw new Error("Usage: node scripts/verify-palette-browser.mjs [--build]");
const root = fileURLToPath(new URL("../", import.meta.url));
const evidence = join(root, ".local/palette-validation");
await mkdir(evidence, { recursive: true, mode: 0o700 });
const image = await readFile(new URL("../public/test-image.jpg", import.meta.url));
let paletteCount = 7;
const rgb = [[220, 20, 35], [20, 180, 70], [30, 80, 220], [235, 190, 20], [160, 35, 190], [30, 180, 180], [245, 110, 30]];
const catalogue = () => [paletteCount, 1, 2, 7].map((count, index) => ({
  id: `42345678-1234-4234-8234-123456789ab${index}`, storage_path: `uploads/42345678-1234-4234-8234-123456789ab${index}.jpg`,
  storage_provider: "supabase", filename: `synthetic-palette-${index}.jpg`, image_width: 1680, image_height: 1348,
  title: `Synthetic ${count}-colour fixture`, alt_text: "Synthetic local palette test — not portfolio content", background_hex: "#34302b",
  palette: rgb.slice(0, count).map((channels, i) => {
    const [lab_l, lab_a, lab_b] = rgbToLab(channels);
    return { rank: i + 1, hex: rgbToHex(channels), lab_l, lab_a, lab_b, weight: 1 / count };
  }),
}));
const backend = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/rest/v1/arnaud_photographs") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(catalogue().slice(Number(url.searchParams.get("offset") || 0))));
  } else { response.writeHead(404); response.end(); }
});
await new Promise((resolve, reject) => { backend.once("error", reject); backend.listen(0, "127.0.0.1", resolve); });
const backendOrigin = `http://127.0.0.1:${backend.address().port}`;
const probe = portProbe();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const bootstrap = `import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(import.meta.url)});
const dotenv=require('@next/env');require.cache[require.resolve('@next/env')].exports={...dotenv,loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})};
const {Socket}=require('node:net');const connect=Socket.prototype.connect;Socket.prototype.connect=function(...args){const first=args[0];const options=Array.isArray(first)?first[0]:first;const host=typeof options==='object'?options.host:typeof args[1]==='string'?args[1]:undefined;if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw new Error('Palette fixture blocks outbound network');return connect.apply(this,args)};
const config=require('next/dist/server/config');const load=config.default;require.cache[require.resolve('next/dist/server/config')].exports={...config,__esModule:true,default:async(...args)=>({...await load(...args),distDir:${JSON.stringify(`.local/palette-validation/${build ? "build" : "dev"}`)},devIndicators:false})};
const setup=require('next/dist/lib/verify-typescript-setup');require.cache[require.resolve('next/dist/lib/verify-typescript-setup')].exports={...setup,__esModule:true,verifyTypeScriptSetup:async()=>({version:require('typescript').version})};
const fs=require('node:fs');const path=require('node:path');const protectedFiles=new Set(${JSON.stringify(["tsconfig.json", "next-env.d.ts", "payload-types.ts", "app/(payload)/cms/importMap.ts"].map(file => join(root, file)))});const protectedFile=file=>protectedFiles.has(path.resolve(String(file)));const syncWrite=fs.writeFileSync;fs.writeFileSync=(file,...args)=>protectedFile(file)?undefined:syncWrite(file,...args);const promiseWrite=fs.promises.writeFile;fs.promises.writeFile=(file,...args)=>protectedFile(file)?Promise.resolve():promiseWrite(file,...args);const callbackWrite=fs.writeFile;fs.writeFile=(file,...args)=>protectedFile(file)?queueMicrotask(()=>args.at(-1)(null)):callbackWrite(file,...args);`;
const log = createWriteStream(join(evidence, build ? "build.log" : "browser-server.log"), { flags: "w", mode: 0o600 });
const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), build ? "build" : "dev", "--webpack",
  ...(build ? [] : ["--hostname", "127.0.0.1", "--port", String(port)])], {
  cwd: root, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    NODE_ENV: build ? "production" : "development", NEXT_TELEMETRY_DISABLED: "1", ARNAUD_CMS_ENABLED: "false", ARNAUD_SITE_EXPANSION_ENABLED: "false",
    ARNAUD_NEWSLETTER_ENABLED: "false", ARNAUD_UPLOAD_STORAGE: "supabase", NEXT_PUBLIC_SUPABASE_URL: backendOrigin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-fixture-only", NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(bootstrap)}` },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
const exited = new Promise(resolve => child.once("exit", resolve));
const checks = [];
let browser;
try {
  if (build) {
    assert.equal(await exited, 0, `Synthetic Webpack build failed; see ${join(evidence, "build.log")}`);
    console.log("Isolated synthetic production Webpack build passed. TypeScript is verified separately by npm run typecheck.");
  } else {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Synthetic Next server did not become ready.")), 30000);
      const collect = chunk => { if (chunk.toString().includes("Ready in")) { clearTimeout(timeout); resolve(); } };
      child.stdout.on("data", collect); child.stderr.on("data", collect);
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("exit", () => { clearTimeout(timeout); reject(new Error("Synthetic Next server exited before readiness.")); });
    });
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    for (const width of [390, 1440]) for (const mode of ["webgl", "css-fallback", "reduced-motion"]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference", hasTouch: width === 390 });
      await context.addInitScript(({ fallback }) => {
        window.__paletteChords = [];
        window.addEventListener("arnaud:colour-chord", event => window.__paletteChords.push(event.detail));
        if (fallback) {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return String(kind).includes("webgl") ? null : getContext.call(this, kind, ...args); };
        }
      }, { fallback: mode === "css-fallback" });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (![origin, backendOrigin].includes(url.origin)) return route.abort("blockedbyclient");
        if (url.pathname === "/_next/image" || url.pathname.startsWith("/storage/v1/object/")) return route.fulfill({ contentType: "image/jpeg", body: image });
        return route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      try {
        for (const count of [0, 1, 2, 7]) {
          paletteCount = count;
          for (const path of ["/photos", "/photos/synthetic-palette-0.jpg"]) {
            const response = await page.goto(origin + path, { timeout: 120000 });
            assert.equal(response.status(), 200);
            assert.equal(await page.locator("[data-colour-orb]").count(), count);
            if (count) {
              await page.waitForFunction(() => document.querySelector("[data-colour-orb]")?.parentElement.style.opacity === "1");
              await page.waitForFunction(expected => document.querySelector("[data-renderer]")?.dataset.renderer === expected, mode === "css-fallback" ? "css" : "webgl");
              const orb = page.locator("[data-colour-orb]").first();
              await orb.focus(); await page.keyboard.press("Enter");
              assert.equal(await orb.getAttribute("aria-pressed"), "true");
              assert.deepEqual(await page.evaluate(() => window.__paletteChords), [0]);
              await page.keyboard.press("Enter");
              assert.equal(await orb.getAttribute("aria-pressed"), "false");
              assert.ok(await page.locator('a[href^="/photos/"]').count() > 0, "Short palettes must retain a nonempty matching gallery");
              assert.ok(await page.locator("[data-colour-orb]").evaluateAll(nodes => nodes.every(node => {
                const rect = node.getBoundingClientRect(); return Number.isFinite(rect.width) && rect.width > 0 && !node.getAttribute("style")?.includes("NaN");
              })));
            }
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            await page.evaluate(() => document.fonts.ready);
            if (mode === "webgl" && count > 0) await page.screenshot({ path: join(evidence, `${path === "/photos" ? "archive" : "detail"}-${count}-${width}.png`) });
            checks.push({ path, count, width, mode, noOverflow: true });
          }
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    await writeFile(join(evidence, "browser-checks.json"), `${JSON.stringify(checks, null, 2)}\n`, { mode: 0o600 });
    console.log(`Passed ${checks.length} synthetic palette browser cases: 0/1/2/7 swatches, archive/detail, desktop/mobile, WebGL/CSS/reduced motion.`);
  }
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await exited; }
  await new Promise(resolve => backend.close(resolve));
  log.end();
}
