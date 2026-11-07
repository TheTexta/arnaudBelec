import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";

// Generated 2026-11-06 from the released native-journal snapshot.
// Category collections only; no homepage, newsletter, or global settings.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
DO $$ BEGIN
  IF current_user NOT IN ('arnaud_cms_owner', 'arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Category migration requires the Arnaud owner or migrator role';
  END IF;
  IF to_regclass('arnaud_cms.media') IS NULL OR to_regclass('arnaud_cms.posts') IS NULL
     OR to_regclass('arnaud_cms._posts_v') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'arnaud_cms' AND table_name = 'media' AND column_name = 'sha256')
     OR to_regclass('arnaud_cms.legacy_revisions') IS NOT NULL THEN
    RAISE EXCEPTION 'Category migration requires the native journal baseline';
  END IF;
END $$;
CREATE TYPE "arnaud_cms"."enum_videos_status" AS ENUM('draft', 'published');
CREATE TYPE "arnaud_cms"."enum__videos_v_version_status" AS ENUM('draft', 'published');
CREATE TYPE "arnaud_cms"."enum_fashion_projects_status" AS ENUM('draft', 'published');
CREATE TYPE "arnaud_cms"."enum__fashion_projects_v_version_status" AS ENUM('draft', 'published');
CREATE TABLE "arnaud_cms"."videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar DEFAULT 'Untitled',
	"slug" varchar,
	"excerpt" varchar,
	"body" jsonb,
	"cover_id" uuid,
	"film_id" uuid,
	"credits" varchar,
	"year" varchar,
	"edit_revision" numeric DEFAULT 0,
	"first_published_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"_status" "arnaud_cms"."enum_videos_status" DEFAULT 'draft'
);

CREATE TABLE "arnaud_cms"."videos_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

CREATE TABLE "arnaud_cms"."_videos_v" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"version_title" varchar DEFAULT 'Untitled',
	"version_slug" varchar,
	"version_excerpt" varchar,
	"version_body" jsonb,
	"version_cover_id" uuid,
	"version_film_id" uuid,
	"version_credits" varchar,
	"version_year" varchar,
	"version_edit_revision" numeric DEFAULT 0,
	"version_first_published_at" timestamp(3) with time zone,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"version__status" "arnaud_cms"."enum__videos_v_version_status" DEFAULT 'draft',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean,
	"autosave" boolean
);

CREATE TABLE "arnaud_cms"."_videos_v_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

CREATE TABLE "arnaud_cms"."fashion_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar DEFAULT 'Untitled',
	"slug" varchar,
	"excerpt" varchar,
	"body" jsonb,
	"cover_id" uuid,
	"film_id" uuid,
	"credits" varchar,
	"year" varchar,
	"edit_revision" numeric DEFAULT 0,
	"first_published_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"_status" "arnaud_cms"."enum_fashion_projects_status" DEFAULT 'draft'
);

CREATE TABLE "arnaud_cms"."fashion_projects_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

CREATE TABLE "arnaud_cms"."_fashion_projects_v" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"version_title" varchar DEFAULT 'Untitled',
	"version_slug" varchar,
	"version_excerpt" varchar,
	"version_body" jsonb,
	"version_cover_id" uuid,
	"version_film_id" uuid,
	"version_credits" varchar,
	"version_year" varchar,
	"version_edit_revision" numeric DEFAULT 0,
	"version_first_published_at" timestamp(3) with time zone,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"version__status" "arnaud_cms"."enum__fashion_projects_v_version_status" DEFAULT 'draft',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean,
	"autosave" boolean
);

CREATE TABLE "arnaud_cms"."_fashion_projects_v_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD COLUMN "videos_id" uuid;
ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD COLUMN "fashion_projects_id" uuid;
ALTER TABLE "arnaud_cms"."videos" ADD CONSTRAINT "videos_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."videos" ADD CONSTRAINT "videos_film_id_media_id_fk" FOREIGN KEY ("film_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."videos_rels" ADD CONSTRAINT "videos_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."videos_rels" ADD CONSTRAINT "videos_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_videos_v" ADD CONSTRAINT "_videos_v_parent_id_videos_id_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_videos_v" ADD CONSTRAINT "_videos_v_version_film_id_media_id_fk" FOREIGN KEY ("version_film_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_videos_v_rels" ADD CONSTRAINT "_videos_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."_videos_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_videos_v_rels" ADD CONSTRAINT "_videos_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."fashion_projects" ADD CONSTRAINT "fashion_projects_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."fashion_projects" ADD CONSTRAINT "fashion_projects_film_id_media_id_fk" FOREIGN KEY ("film_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."fashion_projects_rels" ADD CONSTRAINT "fashion_projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."fashion_projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."fashion_projects_rels" ADD CONSTRAINT "fashion_projects_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD CONSTRAINT "_fashion_projects_v_parent_id_fashion_projects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."fashion_projects"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD CONSTRAINT "_fashion_projects_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_fashion_projects_v" ADD CONSTRAINT "_fashion_projects_v_version_film_id_media_id_fk" FOREIGN KEY ("version_film_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_fashion_projects_v_rels" ADD CONSTRAINT "_fashion_projects_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."_fashion_projects_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_fashion_projects_v_rels" ADD CONSTRAINT "_fashion_projects_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "videos_slug_idx" ON "arnaud_cms"."videos" USING btree ("slug");
CREATE INDEX "videos_cover_idx" ON "arnaud_cms"."videos" USING btree ("cover_id");
CREATE INDEX "videos_film_idx" ON "arnaud_cms"."videos" USING btree ("film_id");
CREATE INDEX "videos_updated_at_idx" ON "arnaud_cms"."videos" USING btree ("updated_at");
CREATE INDEX "videos_created_at_idx" ON "arnaud_cms"."videos" USING btree ("created_at");
CREATE INDEX "videos__status_idx" ON "arnaud_cms"."videos" USING btree ("_status");
CREATE INDEX "videos_rels_order_idx" ON "arnaud_cms"."videos_rels" USING btree ("order");
CREATE INDEX "videos_rels_parent_idx" ON "arnaud_cms"."videos_rels" USING btree ("parent_id");
CREATE INDEX "videos_rels_path_idx" ON "arnaud_cms"."videos_rels" USING btree ("path");
CREATE INDEX "videos_rels_media_id_idx" ON "arnaud_cms"."videos_rels" USING btree ("media_id");
CREATE INDEX "_videos_v_parent_idx" ON "arnaud_cms"."_videos_v" USING btree ("parent_id");
CREATE INDEX "_videos_v_version_version_slug_idx" ON "arnaud_cms"."_videos_v" USING btree ("version_slug");
CREATE INDEX "_videos_v_version_version_cover_idx" ON "arnaud_cms"."_videos_v" USING btree ("version_cover_id");
CREATE INDEX "_videos_v_version_version_film_idx" ON "arnaud_cms"."_videos_v" USING btree ("version_film_id");
CREATE INDEX "_videos_v_version_version_updated_at_idx" ON "arnaud_cms"."_videos_v" USING btree ("version_updated_at");
CREATE INDEX "_videos_v_version_version_created_at_idx" ON "arnaud_cms"."_videos_v" USING btree ("version_created_at");
CREATE INDEX "_videos_v_version_version__status_idx" ON "arnaud_cms"."_videos_v" USING btree ("version__status");
CREATE INDEX "_videos_v_created_at_idx" ON "arnaud_cms"."_videos_v" USING btree ("created_at");
CREATE INDEX "_videos_v_updated_at_idx" ON "arnaud_cms"."_videos_v" USING btree ("updated_at");
CREATE INDEX "_videos_v_latest_idx" ON "arnaud_cms"."_videos_v" USING btree ("latest");
CREATE INDEX "_videos_v_autosave_idx" ON "arnaud_cms"."_videos_v" USING btree ("autosave");
CREATE INDEX "_videos_v_rels_order_idx" ON "arnaud_cms"."_videos_v_rels" USING btree ("order");
CREATE INDEX "_videos_v_rels_parent_idx" ON "arnaud_cms"."_videos_v_rels" USING btree ("parent_id");
CREATE INDEX "_videos_v_rels_path_idx" ON "arnaud_cms"."_videos_v_rels" USING btree ("path");
CREATE INDEX "_videos_v_rels_media_id_idx" ON "arnaud_cms"."_videos_v_rels" USING btree ("media_id");
CREATE UNIQUE INDEX "fashion_projects_slug_idx" ON "arnaud_cms"."fashion_projects" USING btree ("slug");
CREATE INDEX "fashion_projects_cover_idx" ON "arnaud_cms"."fashion_projects" USING btree ("cover_id");
CREATE INDEX "fashion_projects_film_idx" ON "arnaud_cms"."fashion_projects" USING btree ("film_id");
CREATE INDEX "fashion_projects_updated_at_idx" ON "arnaud_cms"."fashion_projects" USING btree ("updated_at");
CREATE INDEX "fashion_projects_created_at_idx" ON "arnaud_cms"."fashion_projects" USING btree ("created_at");
CREATE INDEX "fashion_projects__status_idx" ON "arnaud_cms"."fashion_projects" USING btree ("_status");
CREATE INDEX "fashion_projects_rels_order_idx" ON "arnaud_cms"."fashion_projects_rels" USING btree ("order");
CREATE INDEX "fashion_projects_rels_parent_idx" ON "arnaud_cms"."fashion_projects_rels" USING btree ("parent_id");
CREATE INDEX "fashion_projects_rels_path_idx" ON "arnaud_cms"."fashion_projects_rels" USING btree ("path");
CREATE INDEX "fashion_projects_rels_media_id_idx" ON "arnaud_cms"."fashion_projects_rels" USING btree ("media_id");
CREATE INDEX "_fashion_projects_v_parent_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("parent_id");
CREATE INDEX "_fashion_projects_v_version_version_slug_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("version_slug");
CREATE INDEX "_fashion_projects_v_version_version_cover_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("version_cover_id");
CREATE INDEX "_fashion_projects_v_version_version_film_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("version_film_id");
CREATE INDEX "_fashion_projects_v_version_version_updated_at_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("version_updated_at");
CREATE INDEX "_fashion_projects_v_version_version_created_at_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("version_created_at");
CREATE INDEX "_fashion_projects_v_version_version__status_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("version__status");
CREATE INDEX "_fashion_projects_v_created_at_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("created_at");
CREATE INDEX "_fashion_projects_v_updated_at_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("updated_at");
CREATE INDEX "_fashion_projects_v_latest_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("latest");
CREATE INDEX "_fashion_projects_v_autosave_idx" ON "arnaud_cms"."_fashion_projects_v" USING btree ("autosave");
CREATE INDEX "_fashion_projects_v_rels_order_idx" ON "arnaud_cms"."_fashion_projects_v_rels" USING btree ("order");
CREATE INDEX "_fashion_projects_v_rels_parent_idx" ON "arnaud_cms"."_fashion_projects_v_rels" USING btree ("parent_id");
CREATE INDEX "_fashion_projects_v_rels_path_idx" ON "arnaud_cms"."_fashion_projects_v_rels" USING btree ("path");
CREATE INDEX "_fashion_projects_v_rels_media_id_idx" ON "arnaud_cms"."_fashion_projects_v_rels" USING btree ("media_id");
ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "arnaud_cms"."videos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fashion_projects_fk" FOREIGN KEY ("fashion_projects_id") REFERENCES "arnaud_cms"."fashion_projects"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("videos_id");
CREATE INDEX "payload_locked_documents_rels_fashion_projects_id_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("fashion_projects_id");
`);
}

export async function down() { throw new Error("Category rollback requires an explicitly reviewed recovery plan; retain project drafts and media."); }
