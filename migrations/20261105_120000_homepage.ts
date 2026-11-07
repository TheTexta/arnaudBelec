import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";

// Additive: no existing settings, content, versions or originals are removed.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
DO $$ BEGIN
  IF to_regclass('arnaud_cms.site_settings') IS NULL THEN
    RAISE EXCEPTION 'Apply and verify the site expansion migration before homepage settings';
  END IF;
  IF current_user NOT IN ('arnaud_cms_owner','arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Use the existing Arnaud-only migration identity';
  END IF;
END $$;
CREATE TYPE "arnaud_cms"."enum_site_settings_homepage_photography_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum_site_settings_homepage_journal_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum_site_settings_homepage_video_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum_site_settings_homepage_fashion_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum__site_settings_v_version_homepage_photography_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum__site_settings_v_version_homepage_journal_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum__site_settings_v_version_homepage_video_source" AS ENUM('none', 'photograph', 'media');
CREATE TYPE "arnaud_cms"."enum__site_settings_v_version_homepage_fashion_source" AS ENUM('none', 'photograph', 'media');
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_palette_fluid_a" varchar DEFAULT '#ff278f';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_palette_fluid_b" varchar DEFAULT '#ffe52f';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_palette_background" varchar DEFAULT '#c8e6ff';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_photography_source" "arnaud_cms"."enum_site_settings_homepage_photography_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_photography_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_photography_image_id" uuid;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_journal_source" "arnaud_cms"."enum_site_settings_homepage_journal_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_journal_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_journal_image_id" uuid;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_video_source" "arnaud_cms"."enum_site_settings_homepage_video_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_video_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_video_image_id" uuid;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_fashion_source" "arnaud_cms"."enum_site_settings_homepage_fashion_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_fashion_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "homepage_fashion_image_id" uuid;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_palette_fluid_a" varchar DEFAULT '#ff278f';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_palette_fluid_b" varchar DEFAULT '#ffe52f';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_palette_background" varchar DEFAULT '#c8e6ff';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_photography_source" "arnaud_cms"."enum__site_settings_v_version_homepage_photography_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_photography_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_photography_image_id" uuid;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_journal_source" "arnaud_cms"."enum__site_settings_v_version_homepage_journal_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_journal_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_journal_image_id" uuid;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_video_source" "arnaud_cms"."enum__site_settings_v_version_homepage_video_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_video_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_video_image_id" uuid;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_fashion_source" "arnaud_cms"."enum__site_settings_v_version_homepage_fashion_source" DEFAULT 'none';
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_fashion_photograph_id" varchar;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_homepage_fashion_image_id" uuid;
ALTER TABLE "arnaud_cms"."site_settings" ADD CONSTRAINT "site_settings_homepage_photography_image_id_media_id_fk" FOREIGN KEY ("homepage_photography_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings" ADD CONSTRAINT "site_settings_homepage_journal_image_id_media_id_fk" FOREIGN KEY ("homepage_journal_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings" ADD CONSTRAINT "site_settings_homepage_video_image_id_media_id_fk" FOREIGN KEY ("homepage_video_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings" ADD CONSTRAINT "site_settings_homepage_fashion_image_id_media_id_fk" FOREIGN KEY ("homepage_fashion_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_homepage_photography_image_id_media_id_fk" FOREIGN KEY ("version_homepage_photography_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_homepage_journal_image_id_media_id_fk" FOREIGN KEY ("version_homepage_journal_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_homepage_video_image_id_media_id_fk" FOREIGN KEY ("version_homepage_video_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_homepage_fashion_image_id_media_id_fk" FOREIGN KEY ("version_homepage_fashion_image_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "site_settings_homepage_photography_homepage_photography__idx" ON "arnaud_cms"."site_settings" USING btree ("homepage_photography_image_id");
CREATE INDEX "site_settings_homepage_journal_homepage_journal_image_idx" ON "arnaud_cms"."site_settings" USING btree ("homepage_journal_image_id");
CREATE INDEX "site_settings_homepage_video_homepage_video_image_idx" ON "arnaud_cms"."site_settings" USING btree ("homepage_video_image_id");
CREATE INDEX "site_settings_homepage_fashion_homepage_fashion_image_idx" ON "arnaud_cms"."site_settings" USING btree ("homepage_fashion_image_id");
CREATE INDEX "_site_settings_v_version_homepage_photography_version_ho_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version_homepage_photography_image_id");
CREATE INDEX "_site_settings_v_version_homepage_journal_version_homepa_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version_homepage_journal_image_id");
CREATE INDEX "_site_settings_v_version_homepage_video_version_homepage_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version_homepage_video_image_id");
CREATE INDEX "_site_settings_v_version_homepage_fashion_version_homepa_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version_homepage_fashion_image_id");
`);
}

export async function down() { throw new Error("Homepage rollback requires a reviewed, data-preserving recovery plan."); }
