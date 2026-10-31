import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "arnaud_cms"."legacy_revisions" ADD COLUMN "source_timestamp" varchar NOT NULL;`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  void _args;
  throw new Error('Destructive CMS down migration is disabled. Retain recovery history during application rollback.');
}
