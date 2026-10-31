import { getPayload } from "payload";
import config from "../../payload.config";
import { importLegacy } from "../../lib/cms/import";

if (!process.env.ARNAUD_CMS_DATABASE_URL) throw new Error("Set the approved explicit CMS database target. There is no default import target.");
const apply = process.argv.includes("--apply");
if (process.argv.some(arg => arg.startsWith("--") && arg !== "--apply")) throw new Error("Usage: cms:import [--apply]. Default is a read-only report.");
const payload = await getPayload({ config });
let exitCode = 0;
try { console.log(JSON.stringify(await importLegacy(payload, apply), null, 2)); }
catch {
  // Driver errors can embed private document parameters. Do not dump them.
  console.error("CMS import did not complete; its transaction was rolled back. Check target emptiness, schema privileges and legacy document validation privately before retrying.");
  exitCode = 1;
}
finally {
  await payload.destroy();
}
// Payload 3.92.1 retains a startup pool lease. Like its migration CLI, exit only
// AFTER the import's commit/rollback and cleanup have completed; do not manipulate
// private pg.Pool internals in an operational command.
process.exit(exitCode);
