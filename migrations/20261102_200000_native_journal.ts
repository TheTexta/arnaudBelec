import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";

// Intentionally refuses existing content. This is not a JSON format converter.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
DO $$ BEGIN
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
ALTER TABLE arnaud_cms._posts_v DROP COLUMN version_legacy_version;
CREATE TABLE "arnaud_cms"."posts_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

CREATE TABLE "arnaud_cms"."_posts_v_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

CREATE TABLE "arnaud_cms"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alt" varchar,
	"caption" varchar,
	"verified" boolean DEFAULT false,
	"sha256" varchar,
	"upload_identity" varchar,
	"prefix" varchar DEFAULT 'journal-native',
	"_objectkey" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"url" varchar,
	"thumbnail_u_r_l" varchar,
	"filename" varchar,
	"mime_type" varchar,
	"filesize" numeric,
	"width" numeric,
	"height" numeric
);

ALTER TABLE "arnaud_cms"."posts" ALTER COLUMN "excerpt" DROP DEFAULT;
ALTER TABLE "arnaud_cms"."posts" ALTER COLUMN "body" DROP DEFAULT;
ALTER TABLE "arnaud_cms"."_posts_v" ALTER COLUMN "version_excerpt" DROP DEFAULT;
ALTER TABLE "arnaud_cms"."_posts_v" ALTER COLUMN "version_body" DROP DEFAULT;
ALTER TABLE "arnaud_cms"."posts" ADD COLUMN "edit_revision" numeric DEFAULT 0;
ALTER TABLE "arnaud_cms"."_posts_v" ADD COLUMN "version_edit_revision" numeric DEFAULT 0;
ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD COLUMN "media_id" uuid;
ALTER TABLE "arnaud_cms"."posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."posts_rels" ADD CONSTRAINT "posts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "posts_rels_order_idx" ON "arnaud_cms"."posts_rels" USING btree ("order");
CREATE INDEX "posts_rels_parent_idx" ON "arnaud_cms"."posts_rels" USING btree ("parent_id");
CREATE INDEX "posts_rels_path_idx" ON "arnaud_cms"."posts_rels" USING btree ("path");
CREATE INDEX "posts_rels_media_id_idx" ON "arnaud_cms"."posts_rels" USING btree ("media_id");
CREATE INDEX "_posts_v_rels_order_idx" ON "arnaud_cms"."_posts_v_rels" USING btree ("order");
CREATE INDEX "_posts_v_rels_parent_idx" ON "arnaud_cms"."_posts_v_rels" USING btree ("parent_id");
CREATE INDEX "_posts_v_rels_path_idx" ON "arnaud_cms"."_posts_v_rels" USING btree ("path");
CREATE INDEX "_posts_v_rels_media_id_idx" ON "arnaud_cms"."_posts_v_rels" USING btree ("media_id");
CREATE UNIQUE INDEX "media_upload_identity_idx" ON "arnaud_cms"."media" USING btree ("upload_identity");
CREATE INDEX "media_updated_at_idx" ON "arnaud_cms"."media" USING btree ("updated_at");
CREATE INDEX "media_created_at_idx" ON "arnaud_cms"."media" USING btree ("created_at");
CREATE UNIQUE INDEX "media_filename_idx" ON "arnaud_cms"."media" USING btree ("filename");
ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "posts_slug_idx" ON "arnaud_cms"."posts" USING btree ("slug");
CREATE INDEX "_posts_v_version_version_slug_idx" ON "arnaud_cms"."_posts_v" USING btree ("version_slug");
CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("media_id");
`);
}

export async function down() { throw new Error("Native journal rollback requires an explicitly reviewed recovery plan."); }
