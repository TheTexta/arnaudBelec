// Developer-only memory fixture. Never loads .env or contacts a provider.
// Optional --fashion-manifest previews extracted local bytes, not a live import.
// Start only after the additive site migration has been generated/reviewed.
import { createServer } from "node:http";
import { createServer as createPortProbe } from "node:net";
import { readFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { getPayload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import sharp from "sharp";
import type { Post } from "../../payload-types";
import { up } from "../../migrations/20261031_200002_payload_journal";
import { up as historyUp } from "../../migrations/20261031_202034_history_precision";
import { up as nativeUp } from "../../migrations/20261102_200000_native_journal";

const root = fileURLToPath(new URL("../../", import.meta.url));
const origin = "http://127.0.0.1:3111";
const authOrigin = "http://127.0.0.1:55446";
const adminId = "32345678-1234-4234-8234-123456789abc";
const { values: fixtureOptions } = parseArgs({ options: { "fashion-manifest": { type: "string" } } });
const fashionPath = fixtureOptions["fashion-manifest"] ? resolve(fixtureOptions["fashion-manifest"]) : null;
type LocalFashionMedia = { filename: string; sha256: string; bytes: number; alt: string; width: number; height: number };
type LocalFashion = { project: { title: string; slug: string; excerpt: string; year: string; _status: string }; coverFilename: string; galleryFilenames: string[]; media: LocalFashionMedia[] };
const localFashion: LocalFashion | null = fashionPath ? JSON.parse(await readFile(fashionPath, "utf8")) : null;
const localFashionFiles = new Map<string, { id: string; bytes: Buffer; media: LocalFashionMedia }>();
if (localFashion && fashionPath) {
  assert.equal(localFashion.project.slug, "circle-of-fashion"); assert.equal(localFashion.project._status, "draft");
  assert.equal(localFashion.media.length, 10);
  for (const media of localFashion.media) {
    assert.match(media.filename, /^circle-of-fashion-\d{2}\.jpg$/);
    const bytes: Buffer = await readFile(join(dirname(fashionPath), media.filename));
    assert.equal(bytes.length, media.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), media.sha256);
    const dimensions = await sharp(bytes).metadata();
    assert.equal(dimensions.width, media.width); assert.equal(dimensions.height, media.height);
    localFashionFiles.set(media.filename, { id: randomUUID(), bytes, media });
  }
  assert.equal(localFashionFiles.size, 10);
  assert.equal(localFashion.coverFilename, localFashion.media[0].filename);
  assert.deepEqual(localFashion.galleryFilenames, localFashion.media.slice(1).map(media => media.filename));
}
// Clear inherited provider/deployment settings, including unknown future keys.
for (const key of Object.keys(process.env)) {
  if (/^(ARNAUD_|SUPABASE_|NEXT_PUBLIC_|R2_|AWS_|RESEND_|SMTP_|VERCEL_|PAYLOAD_)/.test(key)) process.env[key] = "";
}
Object.assign(process.env, {
  NODE_ENV: "development", ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true",
  ARNAUD_CMS_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55447/postgres",
  PAYLOAD_SECRET: "local-site-expansion-synthetic-only-secret", PAYLOAD_DROP_DATABASE: "false",
  ARNAUD_CMS_ORIGIN: origin, SUPABASE_URL: authOrigin, NEXT_PUBLIC_SUPABASE_URL: authOrigin,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-only", SUPABASE_SERVICE_ROLE_KEY: "local-fixture-only",
  SUPABASE_ADMIN_USER_IDS: adminId, ARNAUD_NEWSLETTER_ENABLED: "false",
  ARNAUD_NEWSLETTER_API_KEY: "", ARNAUD_NEWSLETTER_FROM: "", ARNAUD_NEWSLETTER_TOKEN_SECRET: "",
  R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
  ARNAUD_BLOG_UPLOADS_ENABLED: "false", ARNAUD_UPLOAD_STORAGE: "supabase",
  DISABLE_PAYLOAD_HMR: "true", NEXT_TELEMETRY_DISABLED: "1",
});
for (const port of [3111, 55446, 55447]) {
  await new Promise<void>((resolve, reject) => {
    const probe = createPortProbe();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
  });
}
const { up: expansionUp } = await import("../../migrations/20261104_120000_site_expansion");
const { up: categoriesUp } = await import("../../migrations/20261104_110000_portfolio_categories");
const { up: homepageUp } = await import("../../migrations/20261105_120000_homepage");
const image = await readFile(new URL("../../public/test-image.jpg", import.meta.url));
const dimensions = await sharp(image).metadata();
if (!dimensions.width || !dimensions.height) throw new Error("Local test-image dimensions are required.");
const photoIds = ["42345678-1234-4234-8234-123456789ab1", "42345678-1234-4234-8234-123456789ab2"];
const catalogue = photoIds.map((id, index) => ({
  id, storage_path: `uploads/${id}.jpg`, storage_provider: "supabase", filename: `synthetic-study-${index + 1}.jpg`,
  image_width: dimensions.width, image_height: dimensions.height, title: `Synthetic photo study ${index + 1}`,
  alt_text: "Local test image: synthetic catalogue fixture, not portfolio content", background_hex: "#34302b",
  palette: ["#b08b68", "#77746e", "#635c49", "#a4947e", "#504b43", "#c5b79d", "#3b403b"].map((hex, rank) => ({ rank: rank + 1, hex, lab_l: 30 + rank * 7, lab_a: rank, lab_b: rank * 2, weight: 1 / 7 })),
}));
const pg = await PGlite.create();
await pg.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;");
await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
const database = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 55447, maxConnections: 32 });
await database.start();
const { default: config } = await import("../../payload.config");
const payload = await getPayload({ config });
// Payload 3.92.1 startup lease, same workaround as the native fixture/tests.
(payload.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0].release();
await payload.db.drizzle.transaction(async db => {
  await db.execute(sql`set local role arnaud_cms_migrator`);
  for (const migrate of [up, historyUp, nativeUp, categoriesUp, expansionUp, homepageUp]) await migrate({ db } as unknown as Parameters<typeof up>[0]);
});
await payload.db.pool.end();
process.env.ARNAUD_CMS_DATABASE_URL = "postgresql://arnaud_cms_runtime:local-fixture-only@127.0.0.1:55447/postgres";
payload.db.pool = new payload.db.pg!.Pool({ connectionString: process.env.ARNAUD_CMS_DATABASE_URL, max: 1 });
await payload.db.connect?.({ hotReload: true });
// PGlite's socket does not model independent PostgreSQL login sessions. Pin its
// active role explicitly as the existing integration test does.
await payload.db.drizzle.execute(sql`set role arnaud_cms_runtime`);
if ((await payload.db.drizzle.execute(sql`select current_user`)).rows[0].current_user !== "arnaud_cms_runtime") throw new Error("Fixture app must use runtime permissions.");
const mapped = await payload.create({ collection: "cms-users", data: { id: adminId, email: "fixture@example.test" } });
const user = { ...mapped, collection: "cms-users" as const, _strategy: "supabase" };
const mediaIds = ["52345678-1234-4234-8234-123456789ab1", "52345678-1234-4234-8234-123456789ab2", "52345678-1234-4234-8234-123456789ab3", "52345678-1234-4234-8234-123456789ab4"];
// SQL-only synthetic metadata: these are NOT claims of real uploaded/verified bytes.
// Only the local browser intercept supplies content; production hooks stay intact.
await pg.exec("reset role");
for (const [index, id] of mediaIds.entries()) {
  const filename = ["synthetic-front.jpg", "synthetic-back.jpg", "synthetic-film.mp4", "synthetic-ambient.wav"][index];
  await pg.query(`insert into arnaud_cms.media(id,alt,caption,verified,sha256,upload_identity,prefix,filename,mime_type,filesize,width,height,url)
    values ($1,$2,$3,true,$4,$5,'journal-native',$6,$7,$8,$9,$10,$11)`,
  [id, "Local synthetic study", "Synthetic fixture asset — not real editorial content", createHash("sha256").update(image).digest("hex"), `fixture/${filename}`, filename,
    index < 2 ? "image/jpeg" : index === 2 ? "video/mp4" : "audio/wav", image.length,
    index < 2 ? dimensions.width : null, index < 2 ? dimensions.height : null, `/api/cms/media/file/${filename}`]);
}
// Local verified files only; these rows never leave the ephemeral fixture DB.
for (const [filename, { id, bytes, media }] of localFashionFiles) {
  await pg.query(`insert into arnaud_cms.media(id,alt,caption,verified,sha256,upload_identity,prefix,filename,mime_type,filesize,width,height,url)
    values ($1,$2,'',true,$3,$4,'journal-native',$5,'image/jpeg',$6,$7,$8,$9)`,
  [id, media.alt, media.sha256, `local-fixture/${filename}`, filename, bytes.length, media.width, media.height, `/api/cms/media/file/${filename}`]);
}
await pg.exec("set role arnaud_cms_runtime");
const body = (text: string, media: string[] = []): Post["body"] => ({ root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [
  { type: "paragraph", version: 1, direction: null, format: "", indent: 0, children: [{ type: "text", version: 1, text, format: 0, detail: 0, mode: "normal", style: "" }] },
  ...media.map(id => ({ type: "upload", version: 3, relationTo: "media", value: id, fields: {} })),
] } });
await payload.create({ collection: "posts", user, overrideAccess: false, data: { title: "Synthetic journal study", slug: "synthetic-journal-study", editRevision: 0, excerpt: "Local journal readability fixture.", body: body("This synthetic journal entry checks readable editorial content without publishing any real work.", [mediaIds[0]]), _status: "published" } });
await payload.create({ collection: "posts", user, overrideAccess: false, draft: true, data: { title: "Private synthetic journal", slug: "private-synthetic-journal", body: body("This must remain private."), _status: "draft" } });
// Project/global field contracts are the actual expansion collections, not mocks.
for (const collection of ["videos", "fashion-projects"] as const) {
  await payload.create({ collection, user, overrideAccess: false, data: {
    title: collection === "videos" ? "Synthetic film study" : "Synthetic garment study",
    slug: collection === "videos" ? "synthetic-film-study" : "synthetic-garment-study",
    excerpt: "Synthetic local acceptance content, not published portfolio work.", body: body("A synthetic project for local browser verification."),
    cover: mediaIds[0], film: collection === "videos" ? mediaIds[2] : undefined,
    gallery: [mediaIds[0], mediaIds[1]], turntableFrames: collection === "fashion-projects" ? [mediaIds[0], mediaIds[1]] : undefined,
    year: "2026", credits: "Local synthetic fixture", editRevision: 0, _status: "published",
  } });
  await payload.create({ collection, user, overrideAccess: false, draft: true, data: { title: "Private synthetic project", slug: `private-synthetic-${collection}`, body: body("Private."), _status: "draft" } });
}
if (localFashion) await payload.create({ collection: "fashion-projects", user, overrideAccess: false, data: {
  title: localFashion.project.title, slug: localFashion.project.slug, excerpt: localFashion.project.excerpt, year: localFashion.project.year,
  body: body(""), cover: localFashionFiles.get(localFashion.coverFilename)!.id,
  gallery: localFashion.galleryFilenames.map(filename => localFashionFiles.get(filename)!.id), editRevision: 0,
  // Deliberately public inside this loopback-only disposable DB for route checks.
  // The source bundle remains a draft mapping; no production publication occurs.
  _status: "published",
} });
await payload.updateGlobal({ slug: "site-settings", user, overrideAccess: false, data: {
  intro: "Synthetic local portfolio studies. No real editorial content is shown.", contactEmail: "fixture@example.test",
  featuredPhotoId: photoIds[0], ambientAudio: mediaIds[3],
  homepage: {
    palette: { fluidA: "#ff278f", fluidB: "#ffe52f", background: "#c8e6ff" },
    photography: { source: "media", image: mediaIds[0] }, journal: { source: "media", image: mediaIds[1] },
    video: { source: "media", image: mediaIds[0] }, fashion: { source: "media", image: mediaIds[1] },
  },
  colourPhotoIds: [{ photographId: photoIds[0] }], monochromePhotoIds: [{ photographId: photoIds[1] }], newsletterEnabled: false, _status: "published",
} });
await payload.destroy();
await payload.db.pool.end();
const identity = { id: adminId, email: "fixture@example.test", aud: "authenticated", role: "authenticated", created_at: new Date().toISOString() };
const token = () => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.local-fixture-only`;
const auth = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  const url = new URL(request.url || "/", authOrigin);
  const localImage = localFashionFiles.get(url.pathname.replace("/api/cms/media/file/", ""));
  if (localImage && url.pathname.startsWith("/api/cms/media/file/")) { response.setHeader("Content-Type", "image/jpeg"); response.end(localImage.bytes); }
  else if (url.pathname === "/fixture/state") response.end(JSON.stringify({ fixture: "arnaud-site-expansion", synthetic: !localFashion, localFashion: localFashion ? { ...localFashion.project, filenames: [...localFashionFiles.keys()] } : null, photoIds, mediaIds, image: { width: dimensions.width, height: dimensions.height }, newsletterSending: false }));
  else if (url.pathname === "/rest/v1/arnaud_photographs") response.end(JSON.stringify(catalogue.slice(Number(url.searchParams.get("offset") || 0))));
  else if (url.pathname.startsWith("/storage/v1/object/public/arnaudbelec/uploads/")) { response.setHeader("Content-Type", "image/jpeg"); response.end(image); }
  else if (url.pathname.startsWith("/auth/v1/token")) {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    if (!(input.email === identity.email && input.password === "local-fixture-only") && input.refresh_token !== "local-refresh-only") { response.writeHead(401); response.end("{}"); return; }
    response.end(JSON.stringify({ access_token: token(), refresh_token: "local-refresh-only", expires_in: 3600, token_type: "bearer", user: identity }));
  } else if (url.pathname === "/auth/v1/user" && request.headers.authorization?.endsWith(".local-fixture-only")) response.end(JSON.stringify(identity));
  else if (url.pathname === "/auth/v1/logout") { response.writeHead(204); response.end(); }
  else { response.writeHead(404); response.end("{}"); }
});
await new Promise<void>((resolve, reject) => { auth.once("error", reject); auth.listen(55446, "127.0.0.1", resolve); });
await mkdir(new URL("../../.local/site-expansion-browser/", import.meta.url), { recursive: true, mode: 0o700 });
// next/font/local bundles the same owner-supplied face as the application.
// No Google-font mock, prior production build or outbound font request is needed.
delete process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
const logPath = fileURLToPath(new URL("../../.local/site-expansion-browser/server.log", import.meta.url));
const log = createWriteStream(logPath, { flags: "w", mode: 0o600 });
// Next normally reads .env files even when every known value is overridden.
// Disable its env loader in this child only, without touching any project file.
const bootstrap = `import {createRequire} from 'node:module'; const require=createRequire(${JSON.stringify(import.meta.url)}); const env=require('@next/env'); require.cache[require.resolve('@next/env')].exports={...env,loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})}; const {Socket}=require('node:net'); const connect=Socket.prototype.connect; Socket.prototype.connect=function(...args){const first=args[0]; const options=Array.isArray(first)?first[0]:first; const host=typeof options==='object'?options.host:typeof args[1]==='string'?args[1]:undefined; if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw new Error('Synthetic fixture blocks outbound network: '+host);return connect.apply(this,args)};`;
const preload = `data:text/javascript,${encodeURIComponent(bootstrap)}`;
const isolatedConfig = `const configModule=require('next/dist/server/config'); const load=configModule.default; require.cache[require.resolve('next/dist/server/config')].exports={...configModule,__esModule:true,default:async(...args)=>({...await load(...args),distDir:'.local/site-expansion-browser/next-${process.pid}',devIndicators:false})}; const setup=require('next/dist/lib/verify-typescript-setup'); require.cache[require.resolve('next/dist/lib/verify-typescript-setup')].exports={...setup,__esModule:true,verifyTypeScriptSetup:async()=>({version:require('typescript').version})};`;
const protectTypes = `const fs=require('node:fs');const path=require('node:path');const protectedFiles=new Set([${JSON.stringify(`${root}tsconfig.json`)},${JSON.stringify(`${root}next-env.d.ts`)}]);const protectedFile=file=>protectedFiles.has(path.resolve(String(file)));const syncWrite=fs.writeFileSync;fs.writeFileSync=(file,...args)=>protectedFile(file)?undefined:syncWrite(file,...args);const promiseWrite=fs.promises.writeFile;fs.promises.writeFile=(file,...args)=>protectedFile(file)?Promise.resolve():promiseWrite(file,...args);const callbackWrite=fs.writeFile;fs.writeFile=(file,...args)=>protectedFile(file)?queueMicrotask(()=>args.at(-1)(null)):callbackWrite(file,...args);`;
const isolatedPreload = `${preload}${encodeURIComponent(isolatedConfig + protectTypes)}`;
// Webpack stays on the patched JS environment loader; it also avoids Turbopack's
// separate native dotenv handling. Never share another developer server's output.
const next = spawn(process.execPath, [fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3111"], { cwd: root, env: { ...process.env, NODE_OPTIONS: `--import=${isolatedPreload}` }, stdio: ["ignore", "pipe", "pipe"] });
next.stdout.pipe(log, { end: false }); next.stderr.pipe(log, { end: false });
console.log(`Memory-only site fixture${localFashion ? " with extracted local Fashion images" : " (synthetic)"}: ${origin}; Auth/catalogue ${authOrigin}; DB 55447. Log: ${logPath}`);
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  if (next.exitCode === null && next.signalCode === null) await new Promise<void>(resolve => { next.once("exit", () => resolve()); next.kill("SIGTERM"); });
  await new Promise<void>(resolve => auth.close(() => resolve()));
  await database.stop(); await pg.close(); log.end();
}
next.once("exit", () => { void stop(); });
process.once("SIGTERM", () => { void stop(); }); process.once("SIGINT", () => { void stop(); });
