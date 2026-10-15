#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { PHOTOGRAPH_BUCKET } from "../lib/photographs/config.mjs";
import { assertPath, objectProvider, r2Storage } from "../lib/photographs/storage.mjs";
import { reconcileCatalogue, verifyCopiedOriginal } from "../lib/photographs/storage-migration.mjs";

const usage = `Usage: npm run photos:migrate-r2 -- [--inventory | --copy | --verify | --cutover] [--manifest .local/arnaud-r2.json] [--confirm-production]
Default: read-only Supabase catalogue/object inventory. Copy/cutover require explicit confirmation.
--copy writes R2 originals and a local resumable manifest, never catalogue rows.
--verify freshly hashes every Supabase source and R2 body; no remote writes.
--cutover freshly verifies ALL entries before provider updates; never deletes sources.
Freeze legacy writes during final verification/cutover. Source bucket remains intact.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log(usage); return; }
  let mode = "inventory", manifestPath = null, confirm = false;
  let modes = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--inventory", "--copy", "--verify", "--cutover"].includes(arg)) { mode = arg.slice(2); modes++; }
    else if (arg === "--manifest") { manifestPath = args[++i]; if (!manifestPath || manifestPath.startsWith("--")) throw new Error("Supply a manifest path."); }
    else if (arg === "--confirm-production") confirm = true;
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (modes > 1) throw new Error("Choose exactly one migration mode.");
  if (["copy", "cutover"].includes(mode) && !confirm) throw new Error("Remote writes require --confirm-production.");
  if (mode !== "inventory" && !manifestPath) throw new Error("Supply --manifest in an ignored local directory.");
  nextEnv.loadEnvConfig(process.cwd());
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Configure server-only Supabase credentials.");
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const catalogue = async () => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await service.from("arnaud_photographs").select("*").order("id").range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  };
  const photographs = await catalogue();
  for (const photo of photographs) { assertPath(photo.storage_path); objectProvider(photo.storage_provider); }
  if (mode === "inventory") {
    const objects = [];
    const list = async (prefix = "") => {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await service.storage.from(PHOTOGRAPH_BUCKET).list(prefix, { limit: 500, offset, sortBy: { column: "name", order: "asc" } });
        if (error) throw error;
        for (const object of data) {
          const path = [prefix, object.name].filter(Boolean).join("/");
          if (!object.id && !object.metadata) await list(path);
          else objects.push({ path, size: object.metadata?.size ?? null });
        }
        if (data.length < 500) break;
      }
    };
    await list();
    const referenced = new Set(photographs.map(photo => photo.storage_path));
    console.log(JSON.stringify({ mode, photographs: photographs.map(photo => ({ id: photo.id, path: photo.storage_path, provider: objectProvider(photo.storage_provider) })), objects, unreferenced: objects.filter(object => !referenced.has(object.path)), missingSources: photographs.filter(photo => !objects.some(object => object.path === photo.storage_path)).map(photo => photo.id) }, null, 2));
    return;
  }
  manifestPath = resolve(manifestPath);
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT" || mode !== "copy") throw error;
    manifest = { version: 1, sourceUrl: url, photographs: photographs.map(photo => ({ id: photo.id, path: photo.storage_path, filename: photo.filename })) };
  }
  reconcileCatalogue(manifest, photographs, url);
  const storage = r2Storage();
  const save = async () => {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await rename(`${manifestPath}.tmp`, manifestPath);
  };
  for (let index = 0; index < manifest.photographs.length; index++) {
    const entry = manifest.photographs[index];
    const { data, error } = await service.storage.from(PHOTOGRAPH_BUCKET).download(entry.path);
    if (error) throw error;
    const contentType = entry.path.endsWith(".jpg") ? "image/jpeg" : entry.path.endsWith(".png") ? "image/png" : "image/webp";
    manifest.photographs[index] = await verifyCopiedOriginal(storage, entry, Buffer.from(await data.arrayBuffer()), contentType, mode === "copy");
    if (mode === "copy") await save();
    console.log(`Verified ${entry.id}`);
  }
  // Catch concurrent catalogue additions/removals/path edits before any cutover.
  const fresh = await catalogue();
  reconcileCatalogue(manifest, fresh, url);
  if (mode === "cutover") {
    if (fresh.some(photo => photo.storage_provider === undefined)) throw new Error("Apply the site-owned R2 SQL migration before cutover.");
    for (const entry of manifest.photographs) {
      const photo = fresh.find(photo => photo.id === entry.id);
      if (photo.storage_provider === "r2") continue;
      const { data, error } = await service.from("arnaud_photographs").update({ storage_provider: "r2" }).eq("id", entry.id).eq("storage_path", entry.path).eq("storage_provider", "supabase").select("id");
      if (error || data?.length !== 1) throw new Error(`Cutover stopped at ${entry.id}; earlier switches remain R2. ${error?.message ?? "Catalogue changed."}`);
    }
    await save();
  }
  console.log(`${mode} complete: ${manifest.photographs.length} verified originals. Supabase objects retained.`);
}

await main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
