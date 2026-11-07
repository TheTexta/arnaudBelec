#!/usr/bin/env node
import { mkdir, open, link, unlink, readFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { parseBackfillArgs, analyserRuntime, sha256, validatePreparedRun, preparePaletteRun, transitionPaletteRun, paletteReviewHtml } from "../lib/palette/backfill.mjs";
import { originalReader } from "../lib/palette/backfill-storage.mjs";
import { BackfillError } from "../lib/palette/backfill-error.mjs";

const help = `Usage: npm run photos:reanalyze -- COMMAND --run=PRIVATE_DIRECTORY [OPTIONS]
Default: help only; no environment loading, network requests or database writes.
prepare   Read the catalogue/originals, preserve backgrounds, save a new private run and REVIEW.html.
verify    Read-only before/after/stale check; requires --sha256=RECORDED_RUN_SHA256.
apply     Atomic palette-only replacement; requires --sha256=... --confirm=arnaudbelec.
rollback  Guarded exact restoration; requires --sha256=... --confirm=arnaudbelec.
Apply the approved MMCQ compatibility migration first. Review and back up the immutable run.
Freeze photo edits/uploads/deletions and original-object changes during apply/rollback.
An interrupted/failed request can have committed: VERIFY before any retry.
The tool never writes photograph rows or storage objects, deploys, or changes upload providers.`;

async function publishFile(directory, name, content) {
  const pending = join(directory, `.pending-${name}`);
  const handle = await open(pending, "wx", 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
  // Atomic publication without replacing an existing artifact.
  await link(pending, join(directory, name));
  await unlink(pending);
}

async function loadRun(directory, pin) {
  const file = join(directory, "run.json");
  for (const path of [directory, file]) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || (stat.mode & 0o077)) throw new BackfillError("Run directory/files must be private and must not be symbolic links.");
  }
  const bytes = await readFile(file);
  if (sha256(bytes) !== pin) throw new BackfillError("Frozen run SHA-256 mismatch. Stop; do not edit artifacts.");
  const run = JSON.parse(bytes);
  validatePreparedRun(run);
  return run;
}

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2));
  if (args.command === "help") { console.log(help); return; }
  const directory = resolve(args.run);
  // Validate pins and immutable artifacts before loading credentials or networking.
  const existing = args.command === "prepare" ? null : await loadRun(directory, args.sha256);
  nextEnv.loadEnvConfig(process.cwd());
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceKey) throw new BackfillError("Configure server-only Supabase credentials through the existing local operator environment.");
  const parsedUrl = new URL(rawUrl);
  if (!["https:", "http:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) throw new BackfillError("Supply a valid Supabase origin.");
  const origin = parsedUrl.origin;
  if (existing && existing.origin !== origin) throw new BackfillError("The run belongs to a different Supabase origin.");
  const service = createClient(origin, serviceKey, { auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(180_000) }) } });
  const readOriginal = originalReader(service, origin, serviceKey);
  if (args.command === "prepare") {
    await mkdir(directory, { mode: 0o700 }); // Exclusive new run, no silent resume/overwrite.
    const { data: before, error } = await service.rpc("arnaud_palette_snapshot");
    if (error) throw new BackfillError("Could not read the protected snapshot. Verify the approved migration and credentials; nothing was applied.");
    await publishFile(directory, "before.json", `${JSON.stringify(before, null, 2)}\n`);
    const run = await preparePaletteRun(before, readOriginal, origin, await analyserRuntime());
    const bytes = `${JSON.stringify(run, null, 2)}\n`;
    await publishFile(directory, "run.json", bytes);
    await publishFile(directory, "REVIEW.html", paletteReviewHtml(run));
    console.log(`Prepared ${run.originals.length} photographs; no remote writes. Independently record run SHA-256: ${sha256(bytes)}`);
    return;
  }
  const result = await transitionPaletteRun(service, existing, args.command, readOriginal, await analyserRuntime());
  console.log(`${args.command}: ${result}. No photograph rows or storage objects were written.`);
  if (args.command === "verify" && result === "stale") process.exitCode = 2;
}

await main().catch(error => {
  // Raw SDK/HTTP errors can contain request headers, credentials or catalogue data.
  console.error(error instanceof BackfillError ? error.message : "Palette operation stopped. Preserve the run; verify before retrying. Nothing is automatically retried.");
  process.exitCode = 1;
});
