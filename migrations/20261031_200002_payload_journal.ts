import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   REVOKE ALL ON SCHEMA "arnaud_cms" FROM PUBLIC, anon, authenticated;
   CREATE TYPE "arnaud_cms"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "arnaud_cms"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "arnaud_cms"."cms_users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "arnaud_cms"."posts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" varchar DEFAULT 'Untitled',
    "slug" varchar,
    "excerpt" varchar DEFAULT '',
    "body" jsonb DEFAULT '[{"id":"opening","type":"paragraph","props":{},"content":[],"children":[]}]'::jsonb,
    "legacy_version" numeric DEFAULT 0,
    "first_published_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "arnaud_cms"."enum_posts_status" DEFAULT 'draft'
  );

  CREATE TABLE "arnaud_cms"."_posts_v" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_id" uuid,
    "version_title" varchar DEFAULT 'Untitled',
    "version_slug" varchar,
    "version_excerpt" varchar DEFAULT '',
    "version_body" jsonb DEFAULT '[{"id":"opening","type":"paragraph","props":{},"content":[],"children":[]}]'::jsonb,
    "version_legacy_version" numeric DEFAULT 0,
    "version_first_published_at" timestamp(3) with time zone,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "arnaud_cms"."enum__posts_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean,
    "autosave" boolean
  );

  CREATE TABLE "arnaud_cms"."legacy_revisions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "source_key" varchar NOT NULL,
    "post_id" varchar NOT NULL,
    "revision" numeric NOT NULL,
    "snapshot" jsonb NOT NULL,
    "saved_by" varchar NOT NULL,
    "saved_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "arnaud_cms"."payload_kv" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE "arnaud_cms"."payload_locked_documents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "arnaud_cms"."payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" uuid NOT NULL,
    "path" varchar NOT NULL,
    "cms_users_id" uuid,
    "posts_id" uuid,
    "legacy_revisions_id" uuid
  );

  CREATE TABLE "arnaud_cms"."payload_preferences" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "arnaud_cms"."payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" uuid NOT NULL,
    "path" varchar NOT NULL,
    "cms_users_id" uuid
  );

  CREATE TABLE "arnaud_cms"."payload_migrations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "arnaud_cms"."_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "arnaud_cms"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "arnaud_cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arnaud_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legacy_revisions_fk" FOREIGN KEY ("legacy_revisions_id") REFERENCES "arnaud_cms"."legacy_revisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arnaud_cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "arnaud_cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "arnaud_cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "arnaud_cms"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_users_updated_at_idx" ON "arnaud_cms"."cms_users" USING btree ("updated_at");
  CREATE INDEX "cms_users_created_at_idx" ON "arnaud_cms"."cms_users" USING btree ("created_at");
  CREATE INDEX "posts_updated_at_idx" ON "arnaud_cms"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "arnaud_cms"."posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "arnaud_cms"."posts" USING btree ("_status");
  CREATE INDEX "_posts_v_parent_idx" ON "arnaud_cms"."_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "arnaud_cms"."_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "arnaud_cms"."_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "arnaud_cms"."_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "arnaud_cms"."_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "arnaud_cms"."_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "arnaud_cms"."_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "arnaud_cms"."_posts_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "legacy_revisions_source_key_idx" ON "arnaud_cms"."legacy_revisions" USING btree ("source_key");
  CREATE INDEX "legacy_revisions_post_id_idx" ON "arnaud_cms"."legacy_revisions" USING btree ("post_id");
  CREATE INDEX "legacy_revisions_updated_at_idx" ON "arnaud_cms"."legacy_revisions" USING btree ("updated_at");
  CREATE INDEX "legacy_revisions_created_at_idx" ON "arnaud_cms"."legacy_revisions" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "arnaud_cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "arnaud_cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "arnaud_cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "arnaud_cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_cms_users_id_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_legacy_revisions_id_idx" ON "arnaud_cms"."payload_locked_documents_rels" USING btree ("legacy_revisions_id");
  CREATE INDEX "payload_preferences_key_idx" ON "arnaud_cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "arnaud_cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "arnaud_cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "arnaud_cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "arnaud_cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "arnaud_cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_users_id_idx" ON "arnaud_cms"."payload_preferences_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "arnaud_cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "arnaud_cms"."payload_migrations" USING btree ("created_at");
  REVOKE ALL ON ALL TABLES IN SCHEMA "arnaud_cms" FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA "arnaud_cms" FROM PUBLIC, anon, authenticated;`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  void _args;
  // Operational rollback disables CMS and restores the legacy app; content and
  // recovery history are retained. Dropping these tables is a separate approval.
  throw new Error('Destructive CMS down migration is disabled. Use the documented application rollback.');
}
