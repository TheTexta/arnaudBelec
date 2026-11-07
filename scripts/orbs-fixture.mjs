// Synthetic photography-only fixture: no .env files, database or provider access.
import { createServer } from "node:http";
import { createServer as createPortProbe } from "node:net";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = "http://127.0.0.1:3112";
const catalogueOrigin = "http://127.0.0.1:55448";
for (const port of [3112, 55448]) {
  await new Promise((resolve, reject) => {
    const probe = createPortProbe();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
  });
}
const image = await readFile(new URL("../public/test-image.jpg", import.meta.url));
const dimensions = await sharp(image).metadata();
const catalogue = [1, 2].map(index => ({
  id: `42345678-1234-4234-8234-123456789ab${index}`, storage_path: `uploads/42345678-1234-4234-8234-123456789ab${index}.jpg`,
  storage_provider: "supabase", filename: `synthetic-study-${index}.jpg`,
  image_width: dimensions.width, image_height: dimensions.height,
  title: `Synthetic photo study ${index}`, alt_text: "Local synthetic orb test, not portfolio content", background_hex: "#34302b",
  palette: ["#b08b68", "#77746e", "#635c49", "#a4947e", "#504b43", "#c5b79d", "#3b403b"].map((hex, rank) =>
    ({ rank: rank + 1, hex, lab_l: 30 + rank * 7, lab_a: rank, lab_b: rank * 2, weight: 1 / 7 })),
}));
const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  const url = new URL(request.url || "/", catalogueOrigin);
  if (url.pathname === "/fixture/state") response.end(JSON.stringify({ fixture: "arnaud-orbs", synthetic: true }));
  else if (url.pathname === "/rest/v1/arnaud_photographs") response.end(JSON.stringify(catalogue.slice(Number(url.searchParams.get("offset") || 0))));
  else { response.writeHead(404); response.end("{}"); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(55448, "127.0.0.1", resolve); });

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(ARNAUD_|SUPABASE_|NEXT_PUBLIC_|R2_|AWS_|RESEND_|SMTP_|VERCEL_|PAYLOAD_)/.test(key)) env[key] = "";
}
Object.assign(env, { NODE_ENV: "development", ARNAUD_CMS_ENABLED: "false", ARNAUD_SITE_EXPANSION_ENABLED: "false",
  NEXT_PUBLIC_SUPABASE_URL: catalogueOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-only", NEXT_TELEMETRY_DISABLED: "1" });
// Follow the existing CMS fixture's JS-only isolation: no dotenv reads, external
// sockets, shared dev output, or generated edits to tracked TypeScript config.
const bootstrap = `import {createRequire} from 'node:module'; const require=createRequire(${JSON.stringify(import.meta.url)});
const env=require('@next/env'); require.cache[require.resolve('@next/env')].exports={...env,loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})};
const {Socket}=require('node:net'); const connect=Socket.prototype.connect; Socket.prototype.connect=function(...args){const first=args[0];const options=Array.isArray(first)?first[0]:first;const host=typeof options==='object'?options.host:typeof args[1]==='string'?args[1]:undefined;if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw new Error('Orb fixture blocks outbound network: '+host);return connect.apply(this,args)};
const config=require('next/dist/server/config');const load=config.default;require.cache[require.resolve('next/dist/server/config')].exports={...config,__esModule:true,default:async(...args)=>({...await load(...args),distDir:'.local/orbs-browser/next',devIndicators:false})};
const setup=require('next/dist/lib/verify-typescript-setup');require.cache[require.resolve('next/dist/lib/verify-typescript-setup')].exports={...setup,__esModule:true,verifyTypeScriptSetup:async()=>({version:require('typescript').version})};
const fs=require('node:fs');const path=require('node:path');const protectedFiles=new Set([${JSON.stringify(`${root}tsconfig.json`)},${JSON.stringify(`${root}next-env.d.ts`)}]);const protectedFile=file=>protectedFiles.has(path.resolve(String(file)));const syncWrite=fs.writeFileSync;fs.writeFileSync=(file,...args)=>protectedFile(file)?undefined:syncWrite(file,...args);const promiseWrite=fs.promises.writeFile;fs.promises.writeFile=(file,...args)=>protectedFile(file)?Promise.resolve():promiseWrite(file,...args);const callbackWrite=fs.writeFile;fs.writeFile=(file,...args)=>protectedFile(file)?queueMicrotask(()=>args.at(-1)(null)):callbackWrite(file,...args);`;
env.NODE_OPTIONS = `--import=data:text/javascript,${encodeURIComponent(bootstrap)}`;
await mkdir(new URL("../.local/orbs-browser/", import.meta.url), { recursive: true });
const log = createWriteStream(new URL("../.local/orbs-browser/server.log", import.meta.url), { flags: "w", mode: 0o600 });
const next = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3112"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
next.stdout.pipe(log, { end: false }); next.stderr.pipe(log, { end: false });
console.log(`Synthetic orb fixture: ${origin}; catalogue ${catalogueOrigin}. No database or external services.`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (next.exitCode === null && next.signalCode === null) await new Promise(resolve => { next.once("exit", resolve); next.kill("SIGTERM"); });
  await new Promise(resolve => server.close(resolve));
  log.end();
}
next.once("exit", () => { void stop(); });
process.once("SIGTERM", () => { void stop(); }); process.once("SIGINT", () => { void stop(); });
