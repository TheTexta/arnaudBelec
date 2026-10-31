import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile, mkdir } from "node:fs/promises";

// This command never consumes production connection strings or Supabase keys.
await mkdir(".local/cms-postgres", { recursive: true });
const db = await PGlite.create(".local/cms-postgres");
if (!(await db.query("select 1 from pg_roles where rolname = 'anon'")).rows.length) {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;");
  await db.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
}
await db.exec("create schema if not exists arnaud_cms");
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 55439, maxConnections: 32 });
await server.start();
console.log("Isolated local CMS Postgres: 127.0.0.1:55439. No production systems are connected.");
async function stop() { await server.stop(); await db.close(); process.exit(0); }
process.once("SIGINT", stop); process.once("SIGTERM", stop);
