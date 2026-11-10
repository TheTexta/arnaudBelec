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
window.renderFixture=(id='abcdefghijk',provider=true)=>{const content=<><section id="first"><YouTubeVideo videoId={id} label="First film"/></section><section id="second"><YouTubeVideo videoId="lmnopqrstuv" label="Second film"/></section><video controls aria-label="Native film"/></>;root.render(<React.StrictMode>{provider?<PublicAudioProvider track={{url:'/ambient.mp3',mimeType:'audio/mpeg'}}><Controls/>{content}</PublicAudioProvider>:content}</React.StrictMode>)};
window.renderFixture();`;
const output = await build({ stdin: { contents: fixture, loader: "tsx", resolveDir: root }, nodePaths,
  bundle: true, write: false, outfile: "fixture.js", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' } });
const ssr = await build({ stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {YouTubeVideo} from './components/media/YouTubeVideo';export const html=renderToStaticMarkup(<YouTubeVideo videoId="abcdefghijk" label="SSR film"/>);`, loader: "tsx", resolveDir: root },
  nodePaths, bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".module.css": "empty" } });
const compiled = { exports: {} }; new Function("require", "module", "exports", ssr.outputFiles[0].text)(require, compiled, compiled.exports);
assert.doesNotMatch(compiled.exports.html, /<(iframe|script)\b|src="https:\/\/[^\"]*(youtube|ytimg)/);
assert.match(compiled.exports.html, /Loading YouTube player/);
assert.doesNotMatch(compiled.exports.html, /Play video|Close player/);
const mock = `
window.players=[];window.sdkMode=new URL(location.href).searchParams.get('mode')||'success';window.sdkCount=0;
const native=HTMLMediaElement.prototype;
Object.defineProperty(native,'paused',{get(){return this.__paused!==false}});
native.play=function(){this.__paused=false;this.dispatchEvent(new Event('play'));this.dispatchEvent(new Event('playing'));return Promise.resolve()};
native.pause=function(){if(!this.paused){this.__paused=true;this.dispatchEvent(new Event('pause'))}};
window.installYT=()=>{window.YT={Player:class {
constructor(target,options){this.options=options;this.destroyed=false;this.state=-1;this.muted=true;this.plays=0;this.iframe=document.createElement('iframe');this.iframe.dataset.mock='youtube';target.replaceWith(this.iframe);window.players.push(this);if(window.sdkMode!=='no-ready')setTimeout(()=>options.events.onReady({target:this}),0)}
getIframe(){return this.iframe} getPlayerState(){return this.state} isMuted(){return this.muted} mute(){if(window.muteDelay&&!this.muted){if(!this.muteTimer)this.muteTimer=setTimeout(()=>{this.muted=true;this.muteTimer=null},window.muteDelay)}else this.muted=true} unMute(){clearTimeout(this.muteTimer);this.muteTimer=null;this.muted=false}
playVideo(){this.plays++;if(window.sdkMode==='blocked'&&this.muted){this.options.events.onAutoplayBlocked({target:this});return}this.emit(1)}
pauseVideo(){if(this.state!==2)this.emit(2)} emit(data){this.state=data;this.options.events.onStateChange({target:this,data})} fail(){this.options.events.onError({target:this,data:100})} destroy(){this.destroyed=true;this.iframe.remove()}
}}};
const append=document.head.append.bind(document.head);
document.head.append=(node)=>{if(node.tagName==='SCRIPT'&&node.src.includes('youtube.com/iframe_api')){window.sdkCount++;if(window.sdkMode==='error'){setTimeout(()=>node.onerror?.(),0)}else if(window.sdkMode!=='defer'){window.installYT()}return;}return append(node)};
`;
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") { res.writeHead(200, { "Content-Type": "text/javascript" }).end(output.outputFiles.find(file => file.path.endsWith(".js")).contents); return; }
  if (req.url === "/fixture.css") { res.writeHead(200, { "Content-Type": "text/css" }).end(output.outputFiles.find(file => file.path.endsWith(".css")).contents); return; }
  if (req.url === "/ambient.mp3") { res.writeHead(200, { "Content-Type": "audio/mpeg" }).end(); return; }
  res.writeHead(200, { "Content-Type": "text/html" }).end(`<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"><style>body{margin:20px;font:20px cursive;color:#25334b;background:#dce0e5}#root{max-width:880px}section{min-height:110vh}button{min-height:44px}</style><div id="root"></div><script>${mock}</script><script src="/bundle.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = ["SSR reserves the default player without a click-to-load control"];
async function scenario(name, run, { width = 390, mode = "success", clock = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = []; const external = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  try {
    if (clock) await page.clock.install();
    await page.goto(`${origin}/?mode=${mode}`); await page.locator('a[href$="abcdefghijk"]').waitFor();
    await run(page); assert.deepEqual(errors, []); assert.deepEqual(external, []); checks.push(name);
  } catch(error) { console.error({scenario:name,errors,external,html:await page.locator("body").innerHTML()}); throw error; }
  finally { await page.close(); }
}
const unmute = (page, label = "First film") => page.getByRole("button", { name: `Unmute video: ${label}`, exact: true });
const ready = page => page.locator('iframe[title="First film"]').waitFor();
try {
  await scenario("default embeds, muted viewport autoplay, accessibility and mobile layout", async page => {
    await ready(page);
    await page.waitForFunction(() => window.players[0]?.state===1 && window.players[1]?.state===2);
    assert.equal(await page.locator("iframe").count(), 2); assert.equal(await page.evaluate(() => window.sdkCount), 1);
    const geometry = await unmute(page).evaluate(button => {
      const frame=button.parentElement.getBoundingClientRect();
      return { height:button.getBoundingClientRect().height, ratio:frame.width/frame.height, overflow:document.documentElement.scrollWidth>innerWidth };
    });
    assert.ok(geometry.height>=44); assert.ok(Math.abs(geometry.ratio-16/9)<0.01); assert.equal(geometry.overflow,false);
    if (process.env.YOUTUBE_SCREENSHOT) await page.screenshot({path:process.env.YOUTUBE_SCREENSHOT,fullPage:true});
    const options = await page.evaluate(() => window.players[0].options);
    assert.equal(options.host, "https://www.youtube-nocookie.com"); assert.equal(options.playerVars.autoplay, 0); assert.equal(options.playerVars.mute, 1); assert.equal(options.playerVars.playsinline, 1);
    assert.equal(await page.locator('iframe[title="First film"]').getAttribute("allowfullscreen"), "");
    assert.equal(await page.evaluate(() => window.players.every(p=>p.muted)), true);
  });
  await scenario("viewport exit pauses, re-entry plays silently; native pause is respected", async page => {
    await ready(page); await unmute(page).click();
    await page.locator("#second").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.players[0].state===2 && window.players[0].muted && window.players[1].state===1);
    await page.getByRole("button", {name:"Pause video: Second film",exact:true}).click();
    await page.waitForTimeout(300); assert.equal(await page.evaluate(() => window.players[1].state), 2);
    await page.locator("#first").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.players[0].state===1 && window.players[0].muted && window.players[1].state===2);
    assert.equal(await page.evaluate(() => window.players.length), 2);
  });
  await scenario("silent autoplay permits music; keyboard unmute claims sound without replacing iframe", async page => {
    await ready(page);
    await page.getByRole("button", { name: "Ambient play" }).click();
    assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
    assert.equal(await page.evaluate(() => window.players[0].state), 1);
    await unmute(page).focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator("audio").evaluate(e => e.paused), true); assert.equal(await page.locator("video").evaluate(e => e.paused), true);
    assert.equal(await page.evaluate(() => window.players[0].muted), false);
    assert.equal(await page.evaluate(() => window.players.length), 2);
    await page.getByRole("button", { name: "Ambient play" }).click();
    assert.match(await page.locator("output").textContent(), /Pause the other/);
    assert.equal(await page.locator("audio").evaluate(e => e.paused), true);
  });
  await scenario("two visible muted players coexist; YouTube/native sound handoff never destroys embeds", async page => {
    await page.addStyleTag({content:'section{min-height:0}'}); await ready(page);
    await page.waitForFunction(() => window.players.every(p=>p.state===1));
    await unmute(page).click(); await unmute(page, "Second film").click();
    await page.waitForFunction(() => window.players[0].muted && !window.players[1].muted);
    await page.locator("video").evaluate(e => e.play());
    await page.waitForFunction(() => window.players.every(p=>p.muted && !p.destroyed && p.state===1));
    assert.equal(await page.locator("iframe").count(), 2);
  });
  await scenario("delayed iframe mute acknowledgement cannot steal YouTube/native audio handoff", async page => {
    await page.addStyleTag({content:'section{min-height:0}'}); await ready(page);
    await page.waitForFunction(() => window.players.every(p=>p.state===1));
    await unmute(page).click(); await page.evaluate(() => {window.muteDelay=700});
    await unmute(page, "Second film").click();
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.players[1].muted), false);
    await page.waitForFunction(() => window.players[0].muted);
    await page.locator("video").evaluate(e=>e.play());
    // A native-control unmute between mute acknowledgement and the next poll
    // must not leave the old player audibly competing or reclaiming ownership.
    await page.evaluate(() => {window.players[1].muted=true;window.players[1].unMute()});
    await page.waitForTimeout(400);
    assert.equal(await page.locator("video").evaluate(e=>e.paused), false);
    await page.waitForFunction(() => window.players[1].muted);
    await page.locator("video").evaluate(e=>e.pause());
    await unmute(page).click();
    await page.addStyleTag({content:'body{padding-bottom:110vh}'});
    await page.evaluate(() => window.scrollTo(0,document.body.scrollHeight));
    await page.waitForFunction(() => window.players[0].state===2);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.players[0].muted), true);
  });
  for (const state of [0, 2]) await scenario(`state ${state} releases ambient lock without automatic resume`, async page => {
    await ready(page); await unmute(page).click(); await page.evaluate(state => window.players[0].emit(state), state);
    assert.equal(await page.locator("audio").evaluate(e => e.paused), true);
    await page.getByRole("button", { name: "Ambient play" }).click(); assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  });
  await scenario("source changes and unmount dispose old players and audio locks", async page => {
    await ready(page); await unmute(page).click();
    await page.evaluate(() => window.renderFixture('zyxwvutsrqp'));
    await page.waitForFunction(() => window.players[0].destroyed && window.players.some(p=>p.options.videoId==='zyxwvutsrqp' && p.state===1));
    await page.evaluate(() => window.renderFixture('invalid'));
    await page.waitForFunction(() => window.players.filter(p=>p.options.videoId==='zyxwvutsrqp').every(p=>p.destroyed));
    assert.equal(await page.locator('iframe[title="First film"]').count(), 0);
    await page.getByRole("button", { name: "Ambient play" }).click(); assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  });
  await scenario("SDK failure has bounded explicit retry; embed errors release activity", async page => {
    await page.getByRole("button", { name: "Retry video: First film" }).waitFor(); assert.equal(await page.evaluate(() => window.sdkCount), 1);
    await page.evaluate(() => { window.sdkMode='success'; }); await page.getByRole("button", { name: "Retry video: First film" }).click(); await ready(page);
    await page.evaluate(() => window.players[0].fail()); await page.getByRole("button", { name: "Retry video: First film" }).waitFor();
    assert.equal(await page.locator("iframe").count(), 0); await page.getByRole("button", { name: "Ambient play" }).click();
    assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  }, {mode:"error"});
  await scenario("stale deferred SDK cannot create a removed source", async page => {
    await page.evaluate(() => window.renderFixture('invalid'));
    await page.evaluate(() => { window.installYT(); });
    await page.waitForTimeout(100); assert.equal(await page.locator('iframe[title="First film"]').count(), 0);
    assert.equal(await page.evaluate(() => window.players.some(p=>p.options.videoId==='abcdefghijk')), false);
  }, {mode:"defer"});
  await scenario("SDK timeout is bounded and manual retry recovers", async page => {
    await page.clock.fastForward(12_001);
    await page.getByRole("button", { name: "Retry video: First film" }).waitFor();
    assert.equal(await page.evaluate(() => window.sdkCount), 1);
    await page.evaluate(() => { window.sdkMode='success'; }); await page.getByRole("button", { name: "Retry video: First film" }).click();
    await page.clock.fastForward(100); await ready(page);
    assert.equal(await page.evaluate(() => window.sdkCount), 2);
  }, {mode:"defer",clock:true});
  await scenario("missing ready times out instead of treating iframe load as success", async page => {
    await page.clock.fastForward(100);
    await page.clock.fastForward(20_001);
    await page.getByRole("button", { name: "Retry video: First film" }).waitFor();
    assert.equal(await page.locator("iframe").count(), 0);
    await page.getByRole("button", { name: "Ambient play" }).click(); assert.equal(await page.locator("audio").evaluate(e => e.paused), false);
  }, {mode:"no-ready",clock:true});
  await scenario("source change cancels stale SDK initialization", async page => {
    await page.evaluate(() => window.renderFixture('zyxwvutsrqp'));
    await page.evaluate(() => window.installYT()); await ready(page);
    assert.equal(await page.evaluate(() => window.players.some(p=>p.options.videoId==='abcdefghijk')), false);
    assert.equal(await page.evaluate(() => window.players.filter(p=>!p.destroyed).some(p=>p.options.videoId==='zyxwvutsrqp')), true);
  }, {mode:"defer"});
  await scenario("standalone private preview works without audio provider", async page => {
    await page.evaluate(() => window.renderFixture('abcdefghijk',false)); await ready(page);
    await unmute(page).click();
    assert.equal(await page.locator("audio").count(), 0);
    assert.equal(await page.evaluate(() => window.players.filter(p=>!p.destroyed&&p.options.videoId==='abcdefghijk').at(-1).muted), false);
  }, {width:1440});
  await scenario("blocked autoplay can unmute and play in one gesture", async page => {
    await ready(page); await page.getByRole("status").filter({hasText:/Autoplay was blocked/}).waitFor();
    await unmute(page).click(); await page.waitForFunction(() => !window.players[0].muted && window.players[0].state===1);
  }, {mode:"blocked"});
  await scenario("native YouTube volume controls acquire and release sound coordination", async page => {
    await ready(page); await page.getByRole("button", {name:"Ambient play"}).click();
    await page.evaluate(() => window.players[0].unMute());
    await page.waitForFunction(() => document.querySelector('audio').paused);
    await page.evaluate(() => window.players[0].mute()); await unmute(page).waitFor();
    await page.getByRole("button", {name:"Ambient play"}).click();
    assert.equal(await page.locator("audio").evaluate(e=>e.paused), false);
  });
  await scenario("hidden tabs pause and mute; returning never restores sound", async page => {
    await ready(page); await unmute(page).click();
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForFunction(() => window.players[0].muted && window.players[0].state===2);
    await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForFunction(() => window.players[0].muted && window.players[0].state===1);
  });
  console.log(JSON.stringify({ passed: true, mockYouTubeTransport: true, realYouTubeAcceptance: false, checks }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
