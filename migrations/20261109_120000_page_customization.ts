import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";

// Additive: no content, versions, originals, inactive films or permissions are rewritten.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
DO $$ BEGIN
  IF to_regclass('arnaud_cms.site_settings') IS NULL OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'arnaud_cms' AND table_name = 'site_settings' AND column_name = 'homepage_palette_fluid_a') THEN
    RAISE EXCEPTION 'Apply and verify homepage settings before page customization';
  END IF;
  IF current_user NOT IN ('arnaud_cms_owner','arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Use the existing Arnaud-only migration identity';
  END IF;
END $$;
CREATE TYPE "arnaud_cms"."enum_posts_palette_mode" AS ENUM('inherit', 'custom');
CREATE TYPE "arnaud_cms"."enum__posts_v_version_palette_mode" AS ENUM('inherit', 'custom');
CREATE TYPE "arnaud_cms"."enum_videos_video_source" AS ENUM('upload', 'youtube', 'none');
CREATE TYPE "arnaud_cms"."enum__videos_v_version_video_source" AS ENUM('upload', 'youtube', 'none');
CREATE TYPE "arnaud_cms"."enum_fashion_projects_palette_mode" AS ENUM('inherit', 'custom');
CREATE TYPE "arnaud_cms"."enum__fashion_projects_v_version_palette_mode" AS ENUM('inherit', 'custom');
CREATE TABLE "arnaud_cms"."video_order" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"video_id" uuid
);

CREATE TABLE "arnaud_cms"."_video_order_v" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid,
	"_uuid" varchar
);

ALTER TABLE "arnaud_cms"."posts" ADD COLUMN "palette_mode" "arnaud_cms"."enum_posts_palette_mode" DEFAULT 'inherit';
ALTER TABLE "arnaud_cms"."posts" ADD COLUMN "palette_background" varchar;
ALTER TABLE "arnaud_cms"."posts" ADD COLUMN "palette_colour_a" varchar;
ALTER TABLE "arnaud_cms"."posts" ADD COLUMN "palette_colour_b" varchar;
ALTER TABLE "arnaud_cms"."posts" ADD COLUMN "palette_accent" varchar;
ALTER TABLE "arnaud_cms"."_posts_v" ADD COLUMN "version_palette_mode" "arnaud_cms"."enum__posts_v_version_palette_mode" DEFAULT 'inherit';
ALTER TABLE "arnaud_cms"."_posts_v" ADD COLUMN "version_palette_background" varchar;
ALTER TABLE "arnaud_cms"."_posts_v" ADD COLUMN "version_palette_colour_a" varchar;
ALTER TABLE "arnaud_cms"."_posts_v" ADD COLUMN "version_palette_colour_b" varchar;
ALTER TABLE "arnaud_cms"."_posts_v" ADD COLUMN "version_palette_accent" varchar;
ALTER TABLE "arnaud_cms"."videos" ADD COLUMN "video_source" "arnaud_cms"."enum_videos_video_source";
ALTER TABLE "arnaud_cms"."videos" ADD COLUMN "youtube_url" varchar;
ALTER TABLE "arnaud_cms"."_videos_v" ADD COLUMN "version_video_source" "arnaud_cms"."enum__videos_v_version_video_source";
ALTER TABLE "arnaud_cms"."_videos_v" ADD COLUMN "version_youtube_url" varchar;
ALTER TABLE "arnaud_cms"."fashion_projects" ADD COLUMN "palette_mode" "arnaud_cms"."enum_fashion_projects_palette_mode" DEFAULT 'inherit';
ALTER TABLE "arnaud_cms"."fashion_projects" ADD COLUMN "palette_background" varchar;
ALTER TABLE "arnaud_cms"."fashion_projects" ADD COLUMN "palette_colour_a" varchar;
ALTER TABLE "arnaud_cms"."fashion_projects" ADD COLUMN "palette_colour_b" varchar;
ALTER TABLE "arnaud_cms"."fashion_projects" ADD COLUMN "palette_accent" varchar;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD COLUMN "version_palette_mode" "arnaud_cms"."enum__fashion_projects_v_version_palette_mode" DEFAULT 'inherit';
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD COLUMN "version_palette_background" varchar;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD COLUMN "version_palette_colour_a" varchar;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD COLUMN "version_palette_colour_b" varchar;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD COLUMN "version_palette_accent" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "video_page_heading" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "video_page_intro" varchar;
ALTER TABLE "arnaud_cms"."site_settings" ADD COLUMN "video_page_featured_video_id" uuid;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_video_page_heading" varchar;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_video_page_intro" varchar;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD COLUMN "version_video_page_featured_video_id" uuid;
ALTER TABLE "arnaud_cms"."video_order" ADD CONSTRAINT "video_order_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."video_order" ADD CONSTRAINT "video_order_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_video_order_v" ADD CONSTRAINT "_video_order_v_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_video_order_v" ADD CONSTRAINT "_video_order_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "video_order_order_idx" ON "arnaud_cms"."video_order" USING btree ("_order");
CREATE INDEX "video_order_parent_id_idx" ON "arnaud_cms"."video_order" USING btree ("_parent_id");
CREATE INDEX "video_order_video_idx" ON "arnaud_cms"."video_order" USING btree ("video_id");
CREATE INDEX "_video_order_v_order_idx" ON "arnaud_cms"."_video_order_v" USING btree ("_order");
CREATE INDEX "_video_order_v_parent_id_idx" ON "arnaud_cms"."_video_order_v" USING btree ("_parent_id");
CREATE INDEX "_video_order_v_video_idx" ON "arnaud_cms"."_video_order_v" USING btree ("video_id");
ALTER TABLE "arnaud_cms"."site_settings" ADD CONSTRAINT "site_settings_video_page_featured_video_id_videos_id_fk" FOREIGN KEY ("video_page_featured_video_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_video_page_featured_video_id_videos_id_fk" FOREIGN KEY ("version_video_page_featured_video_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "site_settings_video_page_video_page_featured_video_idx" ON "arnaud_cms"."site_settings" USING btree ("video_page_featured_video_id");
CREATE INDEX "_site_settings_v_version_video_page_version_video_page_f_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version_video_page_featured_video_id");
`);
}

export async function down() { throw new Error("Page customization rollback requires a reviewed, data-preserving recovery plan."); }
