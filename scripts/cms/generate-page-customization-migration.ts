// Schema-only generator: no application .env, DB connection or migration execution.
import { readFile, writeFile } from "node:fs/promises";
import { generateImportMap, getPayload } from "payload";
import { generateTypes } from "payload/node";

for (const key of Object.keys(process.env)) if (/^(ARNAUD_|SUPABASE_|NEXT_PUBLIC_|R2_|AWS_|RESEND_|SMTP_|VERCEL_|PAYLOAD_)/.test(key)) process.env[key] = "";
Object.assign(process.env, {
  ARNAUD_CMS_ENABLED: "true", ARNAUD_SITE_EXPANSION_ENABLED: "true",
  PAYLOAD_SECRET: "schema-only-generator-not-a-production-secret", ARNAUD_CMS_ORIGIN: "http://127.0.0.1:1",
  ARNAUD_CMS_DATABASE_URL: "postgresql://127.0.0.1:1/schema-only", DISABLE_PAYLOAD_HMR: "true",
});
const { default: config } = await import("../../payload.config");
const cms = await getPayload({ config, disableDBConnect: true, disableOnInit: true });
try {
  if (!process.argv.includes("--artifacts-only")) {
    const kit = cms.db.requireDrizzleKit!();
    // media_imports is intentionally operator-only raw SQL, outside Payload snapshots.
    const before = JSON.parse(await readFile(new URL("../../migrations/20261105_120000_homepage.json", import.meta.url), "utf8"));
    const after = await kit.generateDrizzleJson(cms.db.schema);
    const statements = await kit.generateMigration(before, after);
    if (!statements.length || statements.some(statement => /\b(?:DROP|TRUNCATE)\b/i.test(statement))) throw new Error("Expected an additive-only page customization schema diff.");
    const guard = `DO $$ BEGIN
  IF to_regclass('arnaud_cms.site_settings') IS NULL OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'arnaud_cms' AND table_name = 'site_settings' AND column_name = 'homepage_palette_fluid_a') THEN
    RAISE EXCEPTION 'Apply and verify homepage settings before page customization';
  END IF;
  IF current_user NOT IN ('arnaud_cms_owner','arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Use the existing Arnaud-only migration identity';
  END IF;
END $$;`;
    const name = "20261109_120000_page_customization";
    const source = `import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";\n\n// Additive: no content, versions, originals, inactive films or permissions are rewritten.\nexport async function up({ db }: MigrateUpArgs) {\n  await db.execute(sql\`\n${guard}\n${statements.join("\n")}\n\`);\n}\n\nexport async function down() { throw new Error("Page customization rollback requires a reviewed, data-preserving recovery plan."); }\n`;
    await writeFile(new URL(`../../migrations/${name}.ts`, import.meta.url), source, { flag: "wx" });
    await writeFile(new URL(`../../migrations/${name}.json`, import.meta.url), JSON.stringify(after, null, 2) + "\n", { flag: "wx" });
    console.log(`Generated ${name}: ${statements.length} additive statements; no database connected.`);
  }
  await generateTypes(cms.config);
  await generateImportMap(cms.config, { force: true, log: false });
  console.log("Generated types and import map; no database connected.");
} finally { await cms.destroy(); }
