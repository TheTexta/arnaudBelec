// Schema-only: reconcile the category checkpoint against the frozen original
// expansion snapshot, never the current (later homepage) application schema.
// No PostgreSQL connection, .env loading or migration execution occurs.
import { readFile, writeFile } from "node:fs/promises";
import { getPayload } from "payload";

Object.assign(process.env, {
  ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true",
  PAYLOAD_SECRET: "schema-only-generator-not-a-production-secret",
  ARNAUD_CMS_ORIGIN: "http://127.0.0.1:1",
  ARNAUD_NEWSLETTER_ENABLED: "false", ARNAUD_BLOG_UPLOADS_ENABLED: "false",
  ARNAUD_CMS_DATABASE_URL: "postgresql://127.0.0.1:1/schema-only",
  R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
  DISABLE_PAYLOAD_HMR: "true",
});
const { default: config } = await import("../../payload.config");
const cms = await getPayload({ config, disableDBConnect: true, disableOnInit: true });
try {
  const kit = cms.db.requireDrizzleKit!();
  const before = JSON.parse(await readFile(new URL("../../migrations/20261104_110000_portfolio_categories.json", import.meta.url), "utf8"));
  const after = JSON.parse(await readFile(new URL("../../migrations/20261104_120000_site_expansion.json", import.meta.url), "utf8"));
  const statements = await kit.generateMigration(before, after);
  if (!statements.length) throw new Error("No expansion schema changes found; register the reviewed models first.");
  if (statements.some(statement => /\b(?:DROP|TRUNCATE)\b/i.test(statement))) throw new Error("Expansion must be additive; review the destructive schema diff before proceeding.");
  const guard = `DO $$ BEGIN
  IF to_regclass('arnaud_cms.videos') IS NULL OR to_regclass('arnaud_cms.fashion_projects') IS NULL THEN
    RAISE EXCEPTION 'Apply and verify the portfolio category checkpoint before the remaining site expansion';
  END IF;
  IF current_user NOT IN ('arnaud_cms_owner','arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Use the existing Arnaud-only migration identity';
  END IF;
END $$;`;
  const name = "20261104_120000_site_expansion";
  const source = `import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";\n\n// Additive only: existing photographs, journal documents, versions and originals remain.\nexport async function up({ db }: MigrateUpArgs) {\n  await db.execute(sql\`\n${guard}\n${statements.join("\n")}\n\`);\n}\n\nexport async function down() { throw new Error("Site expansion rollback requires a reviewed, data-preserving recovery plan."); }\n`;
  // Review this output and apply it to the still-unapplied migration explicitly.
  // Never overwrite either frozen snapshot or checked-in SQL as a side effect.
  const output = process.argv[2];
  if (output) {
    await writeFile(output, source, { flag: "wx" });
    console.log(`Generated remaining ${name}: ${statements.length} additive statements; frozen snapshots unchanged, no database connected.`);
  } else process.stdout.write(source);
} finally { await cms.destroy(); }
