import { mkdir, lstat, open, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createOriginalImporter, type ImportRecord } from "../../lib/cms/original-import/core";
import { postgresJournal } from "../../lib/cms/original-import/postgres";
import { originalR2 } from "../../lib/cms/original-import/r2";
import { localOriginal } from "../../lib/cms/original-import/source";

export const HELP = `Operator-only private MP4 original importer (no .env loading).
Default: local SHA-256, identity and ffprobe dry run; no DB/R2 calls.

  tsx scripts/cms/import-original.ts --file /absolute/master.mp4
  tsx scripts/cms/import-original.ts --file /absolute/master.mp4 --key stable-name --upload
  tsx scripts/cms/import-original.ts --file /absolute/master.mp4 --resume UUID --upload
  tsx scripts/cms/import-original.ts --inspect UUID

Writes require --upload AND ARNAUD_ORIGINALS_OPERATOR_ENABLED=true.
Inspect also requires the operator enable flag. Explicit operator environment only:
ARNAUD_ORIGINALS_DATABASE_URL, ARNAUD_ORIGINALS_ACTOR_ID,
ARNAUD_ORIGINALS_R2_ACCOUNT_ID, ARNAUD_ORIGINALS_R2_ACCESS_KEY_ID,
ARNAUD_ORIGINALS_R2_SECRET_ACCESS_KEY, optional ARNAUD_ORIGINALS_R2_SESSION_TOKEN.
--journal-dir defaults to .local/original-imports (private recovery snapshots).
Maximum 8 GiB; 64 MiB parts, concurrency 2; private staging ONLY.
Never compresses, remuxes, publishes, deletes or aborts originals.`;

export function parseArguments(args: string[]) {
  const values: Record<string, string> = {};
  let upload = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { help: true, upload: false, values };
    if (arg === "--upload") { if (upload) throw new Error("Duplicate --upload."); upload = true; continue; }
    if (arg === "--dry-run") { values["dry-run"] = "true"; continue; }
    if (!["--file", "--key", "--resume", "--inspect", "--journal-dir"].includes(arg) || !args[i + 1] || args[i + 1].startsWith("--") || values[arg.slice(2)]) throw new Error("Invalid or duplicate CLI option. Use --help.");
    values[arg.slice(2)] = args[++i];
  }
  if (upload && values["dry-run"]) throw new Error("--upload and --dry-run conflict.");
  if (values.inspect && values["dry-run"]) throw new Error("Inspect requires a database connection; --dry-run is local-only.");
  if (values.inspect && (upload || values.resume || values.file || values.key)) throw new Error("Inspect cannot transfer or register.");
  if (values.resume && values.key) throw new Error("Use either --resume or --key.");
  if ((values.inspect || values.resume) && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(values.inspect || values.resume)) throw new Error("Expected an import UUID.");
  if (upload && !values.resume && !values.key) throw new Error("An explicit stable --key is required for a new upload.");
  return { help: args.length === 0, upload, values };
}

async function snapshot(directory: string, record: ImportRecord) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error("Recovery directory must be private (0700), not a symlink.");
  const temporary = join(directory, `.${record.id}.${randomUUID()}.tmp`);
  const file = await open(temporary, "wx", 0o600);
  try { await file.writeFile(JSON.stringify({ version: 1, record }, null, 2)); await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, join(directory, `${record.id}.json`));
  const folder = await open(directory, "r");
  try { await folder.sync(); } finally { await folder.close(); }
}

export async function main(args: string[], env: Partial<NodeJS.ProcessEnv> = process.env) {
  const options = parseArguments(args);
  if (options.help) { console.log(HELP); return; }
  const { values } = options;
  if (!options.upload && !values.inspect) {
    if (!values.file) throw new Error("A --file is required for the default local-only dry run.");
    console.log(JSON.stringify({ dryRun: true, manifest: await localOriginal(values.file).scan() }, null, 2));
    return;
  }
  if (env.ARNAUD_ORIGINALS_OPERATOR_ENABLED !== "true") throw new Error("Operator execution is not enabled.");
  const actor = env.ARNAUD_ORIGINALS_ACTOR_ID;
  const database = env.ARNAUD_ORIGINALS_DATABASE_URL;
  if (!database || !actor || !/^[a-f0-9-]{36}$/i.test(actor)) throw new Error("Explicit operator database and existing CMS actor required.");
  const journal = postgresJournal(database, actor);
  if (values.inspect) {
    const record = await journal.inspect(values.inspect);
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (!values.file) throw new Error("An unchanged local --file is required to upload or resume.");
  const importer = createOriginalImporter(journal, originalR2(env), localOriginal(values.file), actor);
  const directory = resolve(values["journal-dir"] || ".local/original-imports");
  const record = values.resume ? await importer.inspectOriginal(values.resume) : await importer.beginOriginal(values.key);
  // Durable local recovery before any transfer, including the allocated UUID/key.
  await snapshot(directory, record);
  console.log(JSON.stringify({ importId: record.id, state: record.state, key: record.key }));
  try {
    const completed = await importer.resumeOriginal(record.id);
    await snapshot(directory, completed);
    console.log(JSON.stringify({ importId: completed.id, mediaId: completed.mediaId, state: completed.state }));
  } catch {
    await snapshot(directory, await journal.inspect(record.id)).catch(() => {});
    throw new Error(`Import ${record.id} interrupted. Recovery retained; inspect DB state and resume the same UUID. No objects were deleted.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    // SDK/PG errors may contain credentials, connection strings or signed URLs.
    // Deliberately do not print raw errors/stacks, even before reservation.
    console.error("Original importer stopped. No automatic cleanup occurred. Check arguments/operator capability, then inspect retained recovery state; use --help for the contract.");
    process.exitCode = 1;
  });
}
