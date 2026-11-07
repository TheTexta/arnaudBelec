import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { getPayload } from "payload";
import { up } from "../../migrations/20261031_200002_payload_journal";
import { up as historyUp } from "../../migrations/20261031_202034_history_precision";
import { up as nativeUp } from "../../migrations/20261102_200000_native_journal";

// Developer-only: memory-only database, synthetic Auth, no real storage access.
// Deliberately override production-looking environment values before config loads.
const root = fileURLToPath(new URL("../../", import.meta.url));
Object.assign(process.env, {
  ARNAUD_CMS_ENABLED: "true", ARNAUD_CMS_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55443/postgres",
  PAYLOAD_SECRET: "local-first-upload-fixture-not-a-production-secret", PAYLOAD_DROP_DATABASE: "false",
  ARNAUD_CMS_ORIGIN: "http://127.0.0.1:3107", SUPABASE_URL: "http://127.0.0.1:55440",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-only",
  SUPABASE_SERVICE_ROLE_KEY: "local-fixture-only", SUPABASE_ADMIN_USER_IDS: "32345678-1234-4234-8234-123456789abc",
  R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
  ARNAUD_BLOG_UPLOADS_ENABLED: "false", ARNAUD_UPLOAD_STORAGE: "supabase",
  DISABLE_PAYLOAD_HMR: "true", NEXT_TELEMETRY_DISABLED: "1",
});
const pg = await PGlite.create();
await pg.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;");
await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
const database = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 55443, maxConnections: 32 });
await database.start();
const { default: config } = await import("../../payload.config");
const payload = await getPayload({ config });
await payload.db.drizzle.transaction(async db => {
  await up({ db } as unknown as Parameters<typeof up>[0]);
  await historyUp({ db } as unknown as Parameters<typeof historyUp>[0]);
  await nativeUp({ db } as unknown as Parameters<typeof nativeUp>[0]);
});
// Release Payload 3.92.1's startup lease before closing this bootstrap pool.
(payload.db.pool as unknown as { _clients: { release: () => void }[] })._clients[0].release();
await payload.destroy();
await payload.db.pool.end();
const user = { id: process.env.SUPABASE_ADMIN_USER_IDS, email: "fixture@example.test", aud: "authenticated", role: "authenticated", created_at: new Date().toISOString() };
const token = () => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.local-fixture-only`;
const auth = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  const path = request.url || "";
  if (path.startsWith("/auth/v1/token")) {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    if (!(input.email === user.email && input.password === "local-fixture-only") && input.refresh_token !== "local-refresh-only") { response.writeHead(401); response.end("{}"); return; }
    response.end(JSON.stringify({ access_token: token(), refresh_token: "local-refresh-only", expires_in: 3600, token_type: "bearer", user }));
  } else if (path === "/auth/v1/user") response.end(JSON.stringify(user));
  else if (path.startsWith("/auth/v1/logout")) { response.writeHead(204); response.end(); }
  else if (path === "/fixture/state") {
    const posts = (await pg.query("select id,title,body,edit_revision as revision,_status as status from arnaud_cms.posts order by created_at")).rows;
    const versions = (await pg.query("select id,parent_id,title from (select id,parent_id,version_title title,created_at from arnaud_cms._posts_v) q order by created_at")).rows;
    response.end(JSON.stringify({ fixture: "arnaud-cms-native-lifecycle", posts, versions }));
  } else { response.writeHead(404); response.end("{}"); }
});
await new Promise<void>((resolve, reject) => { auth.once("error", reject); auth.listen(55440, "127.0.0.1", resolve); });
await mkdir(new URL("../../.local", import.meta.url), { recursive: true, mode: 0o700 });
const logPath = fileURLToPath(new URL(`../../.local/native-fixture-server-${Date.now()}.log`, import.meta.url));
const log = createWriteStream(logPath, { flags: "wx", mode: 0o600 });
const next = spawn(process.execPath, [fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)), "dev", "--hostname", "127.0.0.1", "--port", "3107"], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
next.stdout.pipe(log, { end: false }); next.stderr.pipe(log, { end: false });
console.log(`Memory-only lifecycle fixture: Next 3107, Auth 55440, PGlite 55443. No production services. Server log: ${logPath}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (next.exitCode === null && next.signalCode === null) await new Promise<void>(resolve => { next.once("exit", () => resolve()); next.kill("SIGTERM"); });
  await new Promise<void>(resolve => auth.close(() => resolve()));
  await database.stop(); await pg.close();
  log.end();
}
next.once("exit", () => { void stop(); });
process.once("SIGTERM", () => { void stop(); }); process.once("SIGINT", () => { void stop(); });
