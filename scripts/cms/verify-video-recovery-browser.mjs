// Deterministic real-browser component/state checks with MOCK media transport.
// This does not establish codec, R2, byte-range or large-original acceptance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {OriginalVideo} from './components/media/OriginalVideo'; const root=createRoot(document.getElementById('root')); window.renderVideo=(src='/api/cms/media/file/fixture.mp4')=>root.render(<OriginalVideo src={src} label="Synthetic recovery fixture"/>); window.renderVideo();`, loader: "tsx", resolveDir: root },
  bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' },
});
const mock = `
window.mediaLog=[];window.mockOnline=true;window.rejectPlay=false;window.deferPlay=false;window.pendingPlayRejectors=[];
Object.defineProperty(navigator,'onLine',{get:()=>window.mockOnline});
const proto=HTMLMediaElement.prototype;
const state=e=>e.__mock??=( {time:0,paused:true,error:null} );
Object.defineProperties(proto,{
 currentTime:{get(){return state(this).time},set(v){state(this).time=v}},
 duration:{get(){return 600}},readyState:{get(){return 1}},
 paused:{get(){return state(this).paused}},error:{get(){return state(this).error}},
 load:{value(){window.mediaLog.push({type:'load',src:this.getAttribute('src')});if(!state(this).paused){state(this).paused=true;this.dispatchEvent(new Event('pause'));}state(this).error=null;this.dispatchEvent(new Event('emptied'))}},
 play:{value(){window.mediaLog.push({type:'play'});if(window.rejectPlay)return Promise.reject(new Error('Synthetic blocked play'));state(this).paused=false;this.dispatchEvent(new Event('play'));if(window.deferPlay)return new Promise((resolve,reject)=>window.pendingPlayRejectors.push(reject));return Promise.resolve()}},
 pause:{value(){state(this).paused=true;this.dispatchEvent(new Event('pause'))}}
});
window.video=()=>document.querySelector('video');
window.emit=(name,values={})=>{Object.assign(state(window.video()),values);window.video().dispatchEvent(new Event(name));};
`;
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") { res.writeHead(200, { "Content-Type": "text/javascript" }).end(output.outputFiles[0].contents); return; }
  if (req.url.startsWith("/api/cms/media/file/")) {
    // Leave native transport pending; scripted media properties/events above
    // isolate recovery state from the platform's actual media decoder.
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "100000000", "Cache-Control": "no-store" }); res.flushHeaders(); return;
  }
  res.writeHead(200, { "Content-Type": "text/html" }).end(`<div id="root"></div><script>${mock}</script><script src="/bundle.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
async function scenario(name, run) {
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" }); await page.locator("video").waitFor();
    await run(page); assert.deepEqual(errors, []); checks.push(name);
  } finally { await page.close(); }
}
try {
  await scenario("native controls without autoplay or signed URL props", async page => {
    const video = page.locator("video");
    assert.equal(await video.getAttribute("preload"), "metadata");
    assert.equal(await video.getAttribute("controls"), "");
    assert.equal(await video.getAttribute("playsinline"), "");
    assert.equal(await video.getAttribute("autoplay"), null);
  });
  await scenario("paused position survives one fresh canonical-source renewal", async page => {
    await page.evaluate(() => { window.emit("timeupdate", { time: 51 }); window.emit("pause"); window.emit("error", { error: { code: 2 }, time: 0 }); });
    await page.waitForFunction(() => window.mediaLog.some(item => item.type === "load"));
    assert.equal(await page.locator("video").getAttribute("src"), "/api/cms/media/file/fixture.mp4?video-retry=1");
    await page.evaluate(() => window.emit("loadedmetadata", { error: null }));
    assert.equal(await page.evaluate(() => window.video().currentTime), 51);
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "play").length), 0);
  });
  await scenario("playing intent and failed seek target survive recovery", async page => {
    await page.evaluate(() => { window.emit("play", { paused: false }); window.emit("seeking", { time: 410 }); window.emit("error", { error: { code: 2 }, time: 0, paused: true }); });
    await page.waitForFunction(() => window.mediaLog.some(item => item.type === "load"));
    await page.evaluate(() => window.emit("loadedmetadata", { error: null }));
    assert.equal(await page.evaluate(() => window.video().currentTime), 410);
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "play").length), 1);
  });
  await scenario("failed recovery stops and explicit Retry renews without looping", async page => {
    await page.evaluate(() => { window.emit("error", { error: { code: 2 } }); window.emit("error", { error: { code: 2 } }); });
    await page.getByRole("button", { name: "Retry video" }).waitFor();
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "load").length), 1);
    await page.getByRole("button", { name: "Retry video" }).click();
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "load").length), 2);
  });
  await scenario("terminal error timeupdate cannot reset the saved seek target before manual Retry", async page => {
    await page.evaluate(() => { window.emit("seeking", { time: 250 }); window.emit("error", { error: { code: 2 } }); window.emit("error", { error: { code: 2 } }); window.emit("timeupdate", { time: 0 }); });
    await page.getByRole("button", { name: "Retry video" }).click();
    await page.evaluate(() => window.emit("loadedmetadata", { error: null }));
    assert.equal(await page.evaluate(() => window.video().currentTime), 250);
  });
  await scenario("load-induced pause does not erase previous playing intent", async page => {
    await page.evaluate(() => { window.emit("play", { paused: false }); window.emit("error", { error: { code: 2 } }); window.emit("loadedmetadata", { error: null }); });
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "play").length), 1);
  });
  await scenario("explicit native-control pause during renewal cancels resume intent", async page => {
    await page.evaluate(() => { window.emit("play", { paused: false }); window.emit("error", { error: { code: 2 } }); window.emit("play", { paused: false }); window.emit("pause", { paused: true }); window.emit("loadedmetadata", { error: null }); });
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "play").length), 0);
  });
  await scenario("stale rejected play promise cannot invalidate a newer successful retry", async page => {
    await page.evaluate(() => { window.deferPlay = true; window.emit("play", { paused: false }); window.emit("error", { error: { code: 2 } }); window.emit("loadedmetadata", { error: null }); window.emit("error", { error: { code: 2 } }); });
    await page.getByRole("button", { name: "Retry video" }).click();
    await page.evaluate(async () => { window.deferPlay = false; window.emit("loadedmetadata", { error: null }); window.pendingPlayRejectors[0](new DOMException("Synthetic superseded play", "AbortError")); await Promise.resolve(); });
    assert.equal(await page.getByRole("status").count(), 0);
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "load").length), 2);
  });
  for (const code of [3, 4]) await scenario(`decode/codec error ${code} never automatically retries`, async page => {
    await page.evaluate(code => window.emit("error", { error: { code } }), code);
    await page.getByRole("button", { name: "Retry video" }).waitFor();
    assert.equal(await page.evaluate(() => window.mediaLog.length), 0);
  });
  await scenario("offline errors require explicit action", async page => {
    await page.evaluate(() => { window.mockOnline = false; window.emit("error", { error: { code: 2 } }); });
    await page.getByRole("button", { name: "Retry video" }).waitFor();
    assert.equal(await page.evaluate(() => window.mediaLog.length), 0);
  });
  await scenario("rejected resume stays usable without another network retry", async page => {
    await page.evaluate(() => { window.rejectPlay = true; window.emit("play", { paused: false }); window.emit("error", { error: { code: 2 } }); window.emit("loadedmetadata", { error: null }); });
    await page.getByRole("button", { name: "Retry video" }).waitFor();
    assert.equal(await page.evaluate(() => window.mediaLog.filter(item => item.type === "load").length), 1);
  });
  await scenario("new source identity resets saved position and automatic budget", async page => {
    await page.evaluate(() => { window.emit("timeupdate", { time: 90 }); window.emit("error", { error: { code: 2 } }); window.renderVideo("/api/cms/media/file/other.mp4"); });
    await page.waitForFunction(() => window.video().getAttribute("src") === "/api/cms/media/file/other.mp4");
    await page.evaluate(() => { window.emit("error", { error: { code: 2 } }); window.emit("loadedmetadata", { error: null }); });
    assert.equal(await page.evaluate(() => window.video().currentTime), 0);
    assert.equal(await page.locator("video").getAttribute("src"), "/api/cms/media/file/other.mp4?video-retry=1");
  });
  console.log(JSON.stringify({ passed: true, simulatedMediaTransport: true, realR2Acceptance: false, checks }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
