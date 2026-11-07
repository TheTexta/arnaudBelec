import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";

// Additive only: existing photographs, journal documents, versions and originals remain.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
DO $$ BEGIN
  IF to_regclass('arnaud_cms.videos') IS NULL OR to_regclass('arnaud_cms.fashion_projects') IS NULL THEN
    RAISE EXCEPTION 'Apply and verify the portfolio category checkpoint before the remaining site expansion';
  END IF;
  IF current_user NOT IN ('arnaud_cms_owner','arnaud_cms_migrator') THEN
    RAISE EXCEPTION 'Use the existing Arnaud-only migration identity';
  END IF;
END $$;
CREATE TYPE "arnaud_cms"."enum_newsletter_subscribers_status" AS ENUM('pending', 'confirmed', 'suppressed');
CREATE TYPE "arnaud_cms"."enum_newsletter_deliveries_status" AS ENUM('queued', 'complete', 'cancelled');
CREATE TYPE "arnaud_cms"."enum_newsletter_recipients_status" AS ENUM('pending', 'sending', 'retry', 'sent', 'skipped', 'failed', 'reconcile');
CREATE TYPE "arnaud_cms"."enum_site_settings_status" AS ENUM('draft', 'published');
CREATE TYPE "arnaud_cms"."enum__site_settings_v_version_status" AS ENUM('draft', 'published');
CREATE TABLE "arnaud_cms"."newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"status" "arnaud_cms"."enum_newsletter_subscribers_status" DEFAULT 'pending' NOT NULL,
	"confirmation_hash" varchar,
	"confirmation_expires_at" timestamp(3) with time zone,
	"confirmation_requested_at" timestamp(3) with time zone,
	"unsubscribe_hash" varchar NOT NULL,
	"confirmed_at" timestamp(3) with time zone,
	"suppressed_at" timestamp(3) with time zone,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "arnaud_cms"."newsletter_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_key" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"status" "arnaud_cms"."enum_newsletter_deliveries_status" DEFAULT 'queued' NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "arnaud_cms"."newsletter_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_key" varchar NOT NULL,
	"delivery_id" uuid NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"status" "arnaud_cms"."enum_newsletter_recipients_status" DEFAULT 'pending' NOT NULL,
	"first_attempt_at" timestamp(3) with time zone,
	"claimed_at" timestamp(3) with time zone,
	"retry_at" timestamp(3) with time zone,
	"claim_token" varchar,
	"message_hash" varchar,
	"provider_id" varchar,
	"last_error" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "arnaud_cms"."site_settings_social_links" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"label" varchar,
	"url" varchar
);

CREATE TABLE "arnaud_cms"."site_settings_colour_photo_ids" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"photograph_id" varchar
);

CREATE TABLE "arnaud_cms"."site_settings_monochrome_photo_ids" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"photograph_id" varchar
);

CREATE TABLE "arnaud_cms"."site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intro" varchar DEFAULT 'A place for photographs, films and things in progress.',
	"contact_email" varchar DEFAULT 'arnaudnaudbel@protonmail.com',
	"featured_photo_id" varchar,
	"ambient_audio_id" uuid,
	"newsletter_enabled" boolean DEFAULT false,
	"edit_revision" numeric DEFAULT 0,
	"_status" "arnaud_cms"."enum_site_settings_status" DEFAULT 'draft',
	"updated_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone
);

CREATE TABLE "arnaud_cms"."site_settings_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

CREATE TABLE "arnaud_cms"."_site_settings_v_version_social_links" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar,
	"url" varchar,
	"_uuid" varchar
);

CREATE TABLE "arnaud_cms"."_site_settings_v_version_colour_photo_ids" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photograph_id" varchar,
	"_uuid" varchar
);

CREATE TABLE "arnaud_cms"."_site_settings_v_version_monochrome_photo_ids" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photograph_id" varchar,
	"_uuid" varchar
);

CREATE TABLE "arnaud_cms"."_site_settings_v" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_intro" varchar DEFAULT 'A place for photographs, films and things in progress.',
	"version_contact_email" varchar DEFAULT 'arnaudnaudbel@protonmail.com',
	"version_featured_photo_id" varchar,
	"version_ambient_audio_id" uuid,
	"version_newsletter_enabled" boolean DEFAULT false,
	"version_edit_revision" numeric DEFAULT 0,
	"version__status" "arnaud_cms"."enum__site_settings_v_version_status" DEFAULT 'draft',
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean,
	"autosave" boolean
);

CREATE TABLE "arnaud_cms"."_site_settings_v_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"media_id" uuid
);

ALTER TABLE "arnaud_cms"."newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "arnaud_cms"."posts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."newsletter_recipients" ADD CONSTRAINT "newsletter_recipients_delivery_id_newsletter_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "arnaud_cms"."newsletter_deliveries"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."newsletter_recipients" ADD CONSTRAINT "newsletter_recipients_subscriber_id_newsletter_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "arnaud_cms"."newsletter_subscribers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings_colour_photo_ids" ADD CONSTRAINT "site_settings_colour_photo_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings_monochrome_photo_ids" ADD CONSTRAINT "site_settings_monochrome_photo_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings" ADD CONSTRAINT "site_settings_ambient_audio_id_media_id_fk" FOREIGN KEY ("ambient_audio_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings_rels" ADD CONSTRAINT "site_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."site_settings_rels" ADD CONSTRAINT "site_settings_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v_version_social_links" ADD CONSTRAINT "_site_settings_v_version_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v_version_colour_photo_ids" ADD CONSTRAINT "_site_settings_v_version_colour_photo_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v_version_monochrome_photo_ids" ADD CONSTRAINT "_site_settings_v_version_monochrome_photo_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "arnaud_cms"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_ambient_audio_id_media_id_fk" FOREIGN KEY ("version_ambient_audio_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v_rels" ADD CONSTRAINT "_site_settings_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "arnaud_cms"."_site_settings_v_rels" ADD CONSTRAINT "_site_settings_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "arnaud_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "newsletter_subscribers_email_idx" ON "arnaud_cms"."newsletter_subscribers" USING btree ("email");
CREATE INDEX "newsletter_subscribers_status_idx" ON "arnaud_cms"."newsletter_subscribers" USING btree ("status");
CREATE UNIQUE INDEX "newsletter_subscribers_confirmation_hash_idx" ON "arnaud_cms"."newsletter_subscribers" USING btree ("confirmation_hash");
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_hash_idx" ON "arnaud_cms"."newsletter_subscribers" USING btree ("unsubscribe_hash");
CREATE INDEX "newsletter_subscribers_updated_at_idx" ON "arnaud_cms"."newsletter_subscribers" USING btree ("updated_at");
CREATE INDEX "newsletter_subscribers_created_at_idx" ON "arnaud_cms"."newsletter_subscribers" USING btree ("created_at");
CREATE UNIQUE INDEX "newsletter_deliveries_publication_key_idx" ON "arnaud_cms"."newsletter_deliveries" USING btree ("publication_key");
CREATE INDEX "newsletter_deliveries_post_idx" ON "arnaud_cms"."newsletter_deliveries" USING btree ("post_id");
CREATE INDEX "newsletter_deliveries_status_idx" ON "arnaud_cms"."newsletter_deliveries" USING btree ("status");
CREATE INDEX "newsletter_deliveries_updated_at_idx" ON "arnaud_cms"."newsletter_deliveries" USING btree ("updated_at");
CREATE INDEX "newsletter_deliveries_created_at_idx" ON "arnaud_cms"."newsletter_deliveries" USING btree ("created_at");
CREATE UNIQUE INDEX "newsletter_recipients_delivery_key_idx" ON "arnaud_cms"."newsletter_recipients" USING btree ("delivery_key");
CREATE INDEX "newsletter_recipients_delivery_idx" ON "arnaud_cms"."newsletter_recipients" USING btree ("delivery_id");
CREATE INDEX "newsletter_recipients_subscriber_idx" ON "arnaud_cms"."newsletter_recipients" USING btree ("subscriber_id");
CREATE INDEX "newsletter_recipients_status_idx" ON "arnaud_cms"."newsletter_recipients" USING btree ("status");
CREATE INDEX "newsletter_recipients_updated_at_idx" ON "arnaud_cms"."newsletter_recipients" USING btree ("updated_at");
CREATE INDEX "newsletter_recipients_created_at_idx" ON "arnaud_cms"."newsletter_recipients" USING btree ("created_at");
CREATE INDEX "site_settings_social_links_order_idx" ON "arnaud_cms"."site_settings_social_links" USING btree ("_order");
CREATE INDEX "site_settings_social_links_parent_id_idx" ON "arnaud_cms"."site_settings_social_links" USING btree ("_parent_id");
CREATE INDEX "site_settings_colour_photo_ids_order_idx" ON "arnaud_cms"."site_settings_colour_photo_ids" USING btree ("_order");
CREATE INDEX "site_settings_colour_photo_ids_parent_id_idx" ON "arnaud_cms"."site_settings_colour_photo_ids" USING btree ("_parent_id");
CREATE INDEX "site_settings_monochrome_photo_ids_order_idx" ON "arnaud_cms"."site_settings_monochrome_photo_ids" USING btree ("_order");
CREATE INDEX "site_settings_monochrome_photo_ids_parent_id_idx" ON "arnaud_cms"."site_settings_monochrome_photo_ids" USING btree ("_parent_id");
CREATE INDEX "site_settings_ambient_audio_idx" ON "arnaud_cms"."site_settings" USING btree ("ambient_audio_id");
CREATE INDEX "site_settings__status_idx" ON "arnaud_cms"."site_settings" USING btree ("_status");
CREATE INDEX "site_settings_rels_order_idx" ON "arnaud_cms"."site_settings_rels" USING btree ("order");
CREATE INDEX "site_settings_rels_parent_idx" ON "arnaud_cms"."site_settings_rels" USING btree ("parent_id");
CREATE INDEX "site_settings_rels_path_idx" ON "arnaud_cms"."site_settings_rels" USING btree ("path");
CREATE INDEX "site_settings_rels_media_id_idx" ON "arnaud_cms"."site_settings_rels" USING btree ("media_id");
CREATE INDEX "_site_settings_v_version_social_links_order_idx" ON "arnaud_cms"."_site_settings_v_version_social_links" USING btree ("_order");
CREATE INDEX "_site_settings_v_version_social_links_parent_id_idx" ON "arnaud_cms"."_site_settings_v_version_social_links" USING btree ("_parent_id");
CREATE INDEX "_site_settings_v_version_colour_photo_ids_order_idx" ON "arnaud_cms"."_site_settings_v_version_colour_photo_ids" USING btree ("_order");
CREATE INDEX "_site_settings_v_version_colour_photo_ids_parent_id_idx" ON "arnaud_cms"."_site_settings_v_version_colour_photo_ids" USING btree ("_parent_id");
CREATE INDEX "_site_settings_v_version_monochrome_photo_ids_order_idx" ON "arnaud_cms"."_site_settings_v_version_monochrome_photo_ids" USING btree ("_order");
CREATE INDEX "_site_settings_v_version_monochrome_photo_ids_parent_id_idx" ON "arnaud_cms"."_site_settings_v_version_monochrome_photo_ids" USING btree ("_parent_id");
CREATE INDEX "_site_settings_v_version_version_ambient_audio_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version_ambient_audio_id");
CREATE INDEX "_site_settings_v_version_version__status_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("version__status");
CREATE INDEX "_site_settings_v_created_at_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("created_at");
CREATE INDEX "_site_settings_v_updated_at_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("updated_at");
CREATE INDEX "_site_settings_v_latest_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("latest");
CREATE INDEX "_site_settings_v_autosave_idx" ON "arnaud_cms"."_site_settings_v" USING btree ("autosave");
CREATE INDEX "_site_settings_v_rels_order_idx" ON "arnaud_cms"."_site_settings_v_rels" USING btree ("order");
CREATE INDEX "_site_settings_v_rels_parent_idx" ON "arnaud_cms"."_site_settings_v_rels" USING btree ("parent_id");
CREATE INDEX "_site_settings_v_rels_path_idx" ON "arnaud_cms"."_site_settings_v_rels" USING btree ("path");
CREATE INDEX "_site_settings_v_rels_media_id_idx" ON "arnaud_cms"."_site_settings_v_rels" USING btree ("media_id");
`);
}

export async function down() { throw new Error("Site expansion rollback requires a reviewed, data-preserving recovery plan."); }
