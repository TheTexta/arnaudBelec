import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("CMS database grants stay Arnaud-only and do not grant browser access or shared service roles", async () => {
  const db = await PGlite.create();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
    const roles = await db.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>("select rolname, rolsuper, rolbypassrls from pg_roles where rolname like 'arnaud_cms_%'");
    assert.equal(roles.rows.length, 3);
    assert.ok(roles.rows.every(role => !role.rolsuper && !role.rolbypassrls));
    await db.exec("create table public.unrelated_site (id integer); set role arnaud_cms_runtime;");
    await assert.rejects(db.query("select * from public.unrelated_site"), /permission denied/);
    await assert.rejects(db.exec("create table arnaud_cms.forbidden_ddl (id integer)"), /permission denied/);
    assert.equal((await db.query<{ member: boolean }>("select pg_has_role('arnaud_cms_runtime', 'service_role', 'MEMBER') as member")).rows[0].member, false);
    await db.query("select * from public.arnaud_blog_posts");
    await db.exec("reset role; set role arnaud_cms_owner; create table arnaud_cms.fixture (id integer); reset role; set role arnaud_cms_runtime;");
    await db.query("insert into arnaud_cms.fixture values (1)");
    await db.exec("reset role; set role arnaud_cms_migrator; create table arnaud_cms.migrator_fixture (id integer); reset role; set role arnaud_cms_runtime;");
    await db.query("insert into arnaud_cms.migrator_fixture values (1)");
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select * from arnaud_cms.fixture"), /permission denied/);
  } finally { await db.close(); }
});
