// Schema-only generator. Never connects to PostgreSQL or reads application .env.
// Removing known retired definitions before diffing avoids interactive guesses
// that the new Media collection is a rename of imported legacy history.
import { readFile, writeFile } from "node:fs/promises";
import { getPayload } from "payload";

Object.assign(process.env, { ARNAUD_CMS_ENABLED: "false", ARNAUD_BLOG_UPLOADS_ENABLED: "false", ARNAUD_CMS_DATABASE_URL: "postgresql://127.0.0.1:1/schema-only", DISABLE_PAYLOAD_HMR: "true" });
const { default: config } = await import("../../payload.config");
const cms = await getPayload({ config, disableDBConnect: true, disableOnInit: true });
const kit = cms.db.requireDrizzleKit!();
const after = await kit.generateDrizzleJson(cms.db.schema);
const before = JSON.parse(await readFile(new URL("../../migrations/20261031_202034_history_precision.json", import.meta.url), "utf8"));
delete before.tables["arnaud_cms.legacy_revisions"];
for (const [name, column] of [["posts", "legacy_version"], ["_posts_v", "version_legacy_version"], ["payload_locked_documents_rels", "legacy_revisions_id"]]) {
  const table = before.tables[`arnaud_cms.${name}`];
  delete table.columns[column];
  for (const [key, value] of Object.entries(table.foreignKeys ?? {})) if (JSON.stringify(value).includes(column)) delete table.foreignKeys[key];
  for (const [key, value] of Object.entries(table.indexes ?? {})) if (JSON.stringify(value).includes(column)) delete table.indexes[key];
}
const statements = await kit.generateMigration(before, after);
const guard = `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM arnaud_cms.posts) OR EXISTS (SELECT 1 FROM arnaud_cms._posts_v)
     OR EXISTS (SELECT 1 FROM arnaud_cms.legacy_revisions)
     OR EXISTS (SELECT 1 FROM public.arnaud_blog_posts) OR EXISTS (SELECT 1 FROM public.arnaud_blog_revisions)
     OR EXISTS (SELECT 1 FROM public.arnaud_blog_media) OR EXISTS (SELECT 1 FROM public.arnaud_blog_publications) THEN
    RAISE EXCEPTION 'Native journal requires the separately approved complete journal reset first';
  END IF;
END $$;
ALTER TABLE arnaud_cms.payload_locked_documents_rels DROP COLUMN legacy_revisions_id;
DROP TABLE arnaud_cms.legacy_revisions;
ALTER TABLE arnaud_cms.posts DROP COLUMN legacy_version;
ALTER TABLE arnaud_cms._posts_v DROP COLUMN version_legacy_version;`;
const name = "20261102_200000_native_journal";
const source = `import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";\n\n// Intentionally refuses existing content. This is not a JSON format converter.\nexport async function up({ db }: MigrateUpArgs) {\n  await db.execute(sql\`\n${guard}\n${statements.join("\n")}\n\`);\n}\n\nexport async function down() { throw new Error("Native journal rollback requires an explicitly reviewed recovery plan."); }\n`;
await writeFile(new URL(`../../migrations/${name}.ts`, import.meta.url), source);
await writeFile(new URL(`../../migrations/${name}.json`, import.meta.url), JSON.stringify(after, null, 2) + "\n");
console.log(`Generated ${name}: ${statements.length} schema-only statements. No database connected.`);
await cms.destroy();
