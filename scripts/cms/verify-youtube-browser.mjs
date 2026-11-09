// Real Chrome DOM/component checks, MOCK YouTube and native media transport.
// No third-party request is allowed. This is NOT real YouTube playback acceptance.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
const nodePaths = [dirname(dirname(require.resolve("react/package.json")))];
const fixture = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {YouTubeVideo} from './components/media/YouTubeVideo';
import {PublicAudioProvider,usePublicAudio} from './components/site-audio/PublicAudioProvider';
function Controls(){const a=usePublicAudio();return <><button onClick={a.togglePlayback}>Ambient play</button><output>{a.message}</output></>}
const root=createRoot(document.getElementById('root'));
window.renderFixture=(id='abcdefghijk',provider=true)=>{const content=<><YouTubeVideo videoId={id} label="First film"/><YouTubeVideo videoId="lmnopqrstuv" label="Second film"/><video controls aria-label="Native film"/></>;root.render(provider?<PublicAudioProvider track={{url:'/ambient.mp3',mimeType:'audio/mpeg'}}><Controls/>{content}</PublicAudioProvider>:content)};
window.renderFixture();`;
const output = await build({ stdin: { contents: fixture, loader: "tsx", resolveDir: root }, nodePaths,
  bundle: true, write: false, outfile: "fixture.js", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' } });
const ssr = await build({ stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {YouTubeVideo} from './components/media/YouTubeVideo';export const html=renderToStaticMarkup(<YouTubeVideo videoId="abcdefghijk" label="SSR film"/>);`, loader: "tsx", resolveDir: root },
  nodePaths, bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".module.css": "empty" } });
const compiled = { exports: {} }; new Function("require", "module", "exports", ssr.outputFiles[0].text)(require, compiled, compiled.exports);
assert.doesNotMatch(compiled.exports.html, /<(iframe|script)\b|src="https:\/\/[^\"]*(youtube|ytimg)/);
const mock = `
window.players=[];window.sdkMode='success';window.thirdParty=[];window.sdkCount=0;
const native=HTMLMediaElement.prototype;
Object.defineProperty(native,'paused',{get(){return this.__paused!==false}});
native.play=function(){this.__paused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));return Promise.resolve()};
native.pause=function(){if(!this.paused){this.__paused=true;this.dispatchEvent(new Event('pause'))}};
window.installYT=()=>{window.YT={Player:class {
constructor(target,options){this.options=options;this.destroyed=false;this.iframe=document.createElement('iframe');this.iframe.dataset.mock='youtube';target.replaceWith(this.iframe);window.players.push(this);if(window.sdkMode!=='no-ready')setTimeout(()=>options.events.onReady({target:this}),0)}
getIframe(){return this.iframe} playVideo(){this.emit(1)} emit(data){this.options.events.onStateChange({target:this,data})} fail(){this.options.events.onError({target:this,data:100})} destroy(){this.destroyed=true;this.iframe.remove()}
}}};
const append=document.head.append.bind(document.head);
document.head.append=(node)=>{if(node.tagName==='SCRIPT'&&node.src.includes('youtube.com/iframe_api')){window.sdkCount++;if(window.sdkMode==='error'){setTimeout(()=>node.onerror?.(),0)}else if(window.sdkMode!=='defer'){window.installYT()}return;}return append(node)};
`;
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") { res.writeHead(200, { "Content-Type": "text/javascript" }).end(output.outputFiles.find(file => file.path.endsWith(".js")).contents); return; }
  if (req.url === "/fixture.css") { res.writeHead(200, { "Content-Type": "text/css" }).end(output.outputFiles.find(file => file.path.endsWith(".css")).contents); return; }
  if (req.url === "/ambient.mp3") { res.writeHead(200, { "Content-Type": "audio/mpeg" }).end(); return; }
  res.writeHead(200, { "Content-Type": "text/html" }).end(`<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"><style>body{margin:20px;font:20px cursive;color:#25334b;background:#dce0e5}#root{max-width:880px}button{min-height:44px}</style><div id="root"></div><script>${mock}</script><script src="/bundle.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = ["SSR has no iframe, SDK or YouTube thumbnail source"];
async function scenario(name, run, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = []; const external = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  try {
    await page.goto(origin); await page.getByRole("button", { name: "Play video: First film", exact: true }).waitFor();
    await run(page); assert.deepEqual(errors, []); assert.deepEqual(external, []); checks.push(name);
  } catch(error) { console.error({scenario:name,errors,external,html:await page.locator("body").innerHTML()}); throw error; }
  finally { await page.close(); }
}
const first = page => page.getByRole("button", { name: "Play video: First film", exact: true });
const playing = page => page.waitForFunction(() => window.players.at(-1)?.options && !window.players.at(-1).destroyed);
try {
  await scenario("lazy SDK, keyboard activation, privacy host and iframe accessibility", async page => {
    assert.equal(await page.locator("iframe").count(), 0); assert.equal(await page.evaluate(() => window.sdkCount), 0);
    const geometry = await first(page).evaluate(button => {
      const frame=button.parentElement.parentElement.getBoundingClientRect();
      return { height:button.getBoundingClientRect().height, ratio:frame.width/frame.height, overflow:document.documentElement.scrollWidth>innerWidth };
    });
    assert.ok(geometry.height>=44); assert.ok(Math.abs(geometry.ratio-16/9)<0.01); assert.equal(geometry.overflow,false);
    if (process.env.YOUTUBE_SCREENSHOT) await page.screenshot({path:process.env.YOUTUBE_SCREENSHOT,fullPage:true});
    await first(page).focus(); await page.keyboard.press("Enter"); await playing(page);
    await page.locator('iframe[title="First film"]').waitFor();
    const options = await page.evaluate(() => window.players[0].options);
    assert.equal(options.host, "https://www.youtube-nocookie.com"); assert.equal(options.playerVars.autoplay, 0); assert.equal(options.playerVars.playsinline, 1);
    assert.equal(await page.locator("iframe").getAttribute("allowfullscreen"), "");
  });
  await scenario("external playback pauses ambient and native; ambient cannot compete", async page => {
    await page.getByRole("button", { name: "Ambient play" }).click();
    assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
    await page.locator("video").evaluate(e => e.play());
    await first(page).click(); await playing(page);
    assert.equal(await page.locator("audio").evaluate(e => e.paused), true); assert.equal(await page.locator("video").evaluate(e => e.paused), true);
    await page.getByRole("button", { name: "Ambient play" }).click();
    assert.match(await page.locator("output").textContent(), /Pause the other/);
    assert.equal(await page.locator("audio").evaluate(e => e.paused), true);
  });
  await scenario("other YouTube and native play stop earlier external players", async page => {
    await first(page).click(); await playing(page);
    await page.getByRole("button", { name: "Play video: Second film", exact: true }).click();
    await page.waitForFunction(() => window.players.length===2 && window.players[0].destroyed);
    assert.equal(await page.evaluate(() => window.sdkCount), 1);
    await page.locator("video").evaluate(e => e.play());
    await page.waitForFunction(() => window.players[1].destroyed);
    assert.equal(await page.locator("iframe").count(), 0);
  });
  for (const state of [0, 2]) await scenario(`state ${state} releases ambient lock without automatic resume`, async page => {
    await first(page).click(); await playing(page); await page.evaluate(state => window.players[0].emit(state), state);
    assert.equal(await page.locator("audio").evaluate(e => e.paused), true);
    await page.getByRole("button", { name: "Ambient play" }).click(); assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  });
  await scenario("close, unmount and source change dispose old players", async page => {
    await first(page).click(); await playing(page);
    await page.getByRole("button", { name: "Close player: First film" }).click(); assert.equal(await page.locator("iframe").count(), 0);
    await first(page).click(); await page.waitForFunction(() => window.players.length===2);
    await page.evaluate(() => window.renderFixture('zyxwvutsrqp'));
    await page.waitForFunction(() => window.players[1].destroyed); assert.equal(await page.locator("iframe").count(), 0);
    await first(page).click(); await page.waitForFunction(() => window.players.length===3);
    await page.evaluate(() => window.renderFixture('invalid'));
    await page.waitForFunction(() => window.players[2].destroyed);
    await page.getByRole("button", { name: "Ambient play" }).click(); assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  });
  await scenario("SDK failure has bounded explicit retry; embed errors release activity", async page => {
    await page.evaluate(() => { window.sdkMode='error'; }); await first(page).click();
    await page.getByRole("button", { name: "Retry video: First film" }).waitFor(); assert.equal(await page.evaluate(() => window.sdkCount), 1);
    await page.evaluate(() => { window.sdkMode='success'; }); await page.getByRole("button", { name: "Retry video: First film" }).click(); await playing(page);
    await page.evaluate(() => window.players[0].fail()); await page.getByRole("button", { name: "Retry video: First film" }).waitFor();
    assert.equal(await page.locator("iframe").count(), 0); await page.getByRole("button", { name: "Ambient play" }).click();
    assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  });
  await scenario("stale deferred SDK cannot create iframe after close or source change", async page => {
    await page.evaluate(() => { window.sdkMode='defer'; }); await first(page).click();
    await page.getByRole("button", { name: "Close player: First film" }).click();
    await page.evaluate(() => { window.installYT(); });
    await page.waitForTimeout(100); assert.equal(await page.locator("iframe").count(), 0); assert.equal(await page.evaluate(() => window.players.length), 0);
    await first(page).click(); await playing(page);
  });
  await scenario("SDK timeout is bounded and manual retry recovers", async page => {
    await page.clock.install();
    await page.evaluate(() => { window.sdkMode='defer'; }); await first(page).click();
    await page.clock.fastForward(12_001);
    await page.getByRole("button", { name: "Retry video: First film" }).waitFor();
    assert.equal(await page.evaluate(() => window.sdkCount), 1);
    await page.evaluate(() => { window.sdkMode='success'; }); await page.getByRole("button", { name: "Retry video: First film" }).click();
    await page.clock.fastForward(100); await playing(page);
    assert.equal(await page.evaluate(() => window.sdkCount), 2);
  });
  await scenario("missing ready/playback times out instead of treating iframe load as success", async page => {
    await page.clock.install();
    await page.evaluate(() => { window.sdkMode='no-ready'; }); await first(page).click();
    await page.clock.fastForward(100); await playing(page);
    await page.clock.fastForward(20_001);
    await page.getByRole("button", { name: "Retry video: First film" }).waitFor();
    assert.equal(await page.locator("iframe").count(), 0);
    await page.getByRole("button", { name: "Ambient play" }).click(); assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  });
  await scenario("source change cancels stale SDK initialization", async page => {
    await page.evaluate(() => { window.sdkMode='defer'; }); await first(page).click();
    await page.evaluate(() => window.renderFixture('zyxwvutsrqp'));
    await first(page).waitFor(); await page.evaluate(() => window.installYT());
    await page.waitForTimeout(100); assert.equal(await page.locator("iframe").count(), 0);
    await first(page).click(); await playing(page);
    assert.equal(await page.evaluate(() => window.players[0].options.videoId), "zyxwvutsrqp");
  });
  await scenario("standalone private preview works without audio provider", async page => {
    await page.evaluate(() => window.renderFixture('abcdefghijk',false)); await first(page).click(); await playing(page);
    await page.getByRole("button", { name: "Close player: First film" }).click(); assert.equal(await page.locator("iframe").count(), 0);
  }, 1440);
  console.log(JSON.stringify({ passed: true, mockYouTubeTransport: true, realYouTubeAcceptance: false, checks }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
