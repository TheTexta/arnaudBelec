import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { up as initial } from "../../migrations/20261031_200002_payload_journal";
import { up as history } from "../../migrations/20261031_202034_history_precision";
import { up as native } from "../../migrations/20261102_200000_native_journal";
import { up as categories } from "../../migrations/20261104_110000_portfolio_categories";
import { up, down } from "../../migrations/20261106_120000_large_originals";
import { postgresJournal } from "./original-import/postgres";
import { randomUUID } from "node:crypto";
import type { ImportRecord } from "./original-import/core";

test("additive private operator migration preserves native/category data, grants and numeric sizes", { timeout: 90000 }, async () => {
  const pg = await PGlite.create();
  const dialect = new PgDialect();
  const db = { execute: (query: SQL) => pg.exec(dialect.sqlToQuery(query).sql) };
  const migrate = (fn: typeof up) => fn({ db } as unknown as Parameters<typeof up>[0]);
  try {
    await pg.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await pg.exec(await readFile(new URL("../../supabase/migrations/20261030231725_create_arnaud_blog.sql", import.meta.url), "utf8"));
    await pg.exec(await readFile(new URL("../../deploy/cms/roles.sql", import.meta.url), "utf8"));
    await assert.rejects(migrate(up), /owner or migrator/);
    await pg.exec("set role arnaud_cms_migrator");
    await assert.rejects(migrate(up), /native journal and category/);
    await migrate(initial); await migrate(history); await migrate(native); await migrate(categories);
    const actor = randomUUID();
    await pg.query("insert into arnaud_cms.cms_users(id,email) values ($1,'operator-fixture@example.test')", [actor]);
    await pg.exec("insert into arnaud_cms.posts(title,slug,body) values ('Preserved','preserved','{}'); insert into arnaud_cms.videos(title) values ('Private video');");
    const before = (await pg.query("select * from arnaud_cms.posts")).rows;
    const videos = (await pg.query("select * from arnaud_cms.videos")).rows;
    const tablesBefore = (await pg.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='arnaud_cms' order by table_name")).rows;
    await migrate(up);
    assert.deepEqual((await pg.query("select * from arnaud_cms.posts")).rows, before);
    assert.deepEqual((await pg.query("select * from arnaud_cms.videos")).rows, videos);
    const tablesAfter = (await pg.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='arnaud_cms' order by table_name")).rows;
    assert.deepEqual(tablesAfter.filter(row => !tablesBefore.some(old => old.table_name === row.table_name)), [{ table_name: "media_imports" }]);
    for (const role of ["arnaud_cms_runtime", "anon", "authenticated", "service_role"]) {
      for (const permission of ["select", "insert", "update", "delete"]) {
        assert.equal((await pg.query<{ allowed: boolean }>("select has_table_privilege($1,'arnaud_cms.media_imports',$2) allowed", [role, permission])).rows[0].allowed, false);
      }
    }
    await pg.exec("set role arnaud_cms_runtime");
    await assert.rejects(pg.query("select * from arnaud_cms.media_imports"), /permission denied/);
    await assert.rejects(pg.query("insert into arnaud_cms.media_imports(id) values (gen_random_uuid())"), /permission denied/);
    await pg.exec("set role arnaud_cms_migrator");
    const id = randomUUID();
    const insert = `insert into arnaud_cms.media_imports(id,actor_id,idempotency_key,original_filename,expected_bytes,expected_sha256,source_identity,filename,object_key,probe)
      values ($1,$2,$3,'fixture.mp4',$4,$5,'{}',$6,$7,'{}')`;
    const values = [id, actor, "operator-fixture", 7834547136, "a".repeat(64), `${id}.mp4`, `journal-native/large-originals/${id}/${id}.mp4`];
    await pg.query(insert, values);
    assert.equal(Number((await pg.query<{ expected_bytes: string }>("select expected_bytes from arnaud_cms.media_imports")).rows[0].expected_bytes), 7834547136);
    await assert.rejects(pg.query("update arnaud_cms.media_imports set object_key='other' where id=$1", [id]), /immutable/);
    await assert.rejects(pg.query("update arnaud_cms.media_imports set state='registered' where id=$1", [id]), /check constraint/);
    await assert.rejects(pg.query(insert, [randomUUID(), actor, "too-large", 8589934593, "a".repeat(64), "bad.mp4", "bad"]), /check constraint/);
    await assert.rejects(down(), /reviewed recovery plan/);
    // SQL adapter tests use the socket while keeping the isolated in-memory DB's
    // effective role explicit (PGlite has one backend session).
    const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1", maxConnections: 3 });
    await server.start();
    try {
      const url = `postgresql://arnaud_cms_migrator:fixture@${server.getServerConn()}/postgres`;
      const journal = postgresJournal(url, actor);
      const newId = randomUUID();
      const row: ImportRecord = { id: newId, actor, idempotency: "registration-fixture", filename: "synthetic.mp4", bytes: 7834547136, sha256: "b".repeat(64), identity: { ino: "synthetic" }, probe: { duration: 606, width: 3840, height: 2160, videoCodec: "h264", audioCodecs: ["aac"] }, bucket: "arnaudbelec-staging", key: `journal-native/large-originals/${newId}/${newId}.mp4`, state: "reserved" };
      const reserved = await journal.reserve(row);
      assert.equal(reserved.id, newId);
      const retryId = randomUUID();
      assert.equal((await journal.reserve({ ...row, id: retryId, key: `journal-native/large-originals/${retryId}/${retryId}.mp4` })).id, newId);
      const token = randomUUID();
      await journal.lease(newId, token);
      await assert.rejects(journal.lease(newId, randomUUID()), /already leased/);
      await assert.rejects(journal.register(newId, token, { bytes: row.bytes, sha256: row.sha256, mime: "video/mp4", etag: "synthetic-etag" }), /Locked original/);
      await journal.state(newId, token, "verifying");
      await assert.rejects(journal.register(newId, token, { bytes: row.bytes, sha256: "a".repeat(64), mime: "video/mp4", etag: "synthetic-etag" }), /Locked original/);
      const observation = { bytes: row.bytes, sha256: row.sha256, mime: "video/mp4" as const, etag: "synthetic-etag" };
      // An INSERT failure must roll the verified observations back too.
      await pg.query("insert into arnaud_cms.media(id,filename) values ($1,'collision-fixture.mp4')", [newId]);
      await assert.rejects(journal.register(newId, token, observation), /duplicate key/);
      assert.equal((await journal.inspect(newId)).state, "verifying");
      assert.equal((await journal.inspect(newId)).mediaId, undefined);
      await pg.query("delete from arnaud_cms.media where id=$1", [newId]);
      assert.equal(await journal.register(newId, token, observation), newId);
      assert.equal(await journal.register(newId, token, observation), newId);
      const media = (await pg.query<{ filesize: string; _objectkey: string; upload_identity: string; prefix: string; filename: string }>("select * from arnaud_cms.media where id=$1", [newId])).rows[0];
      assert.equal(Number(media.filesize), row.bytes);
      assert.equal(`${media.prefix}/${media._objectkey}/${media.filename}`, row.key);
      assert.equal(media.upload_identity, newId);
      assert.equal((await journal.inspect(newId)).mediaId, newId);
      await journal.release(newId, token, false);
      const expired = randomUUID();
      await journal.lease(newId, expired);
      await pg.query("update arnaud_cms.media_imports set lease_until=now()-interval '1 second' where id=$1", [newId]);
      await assert.rejects(journal.renew(newId, expired), /lease lost/);
      const replacement = randomUUID();
      await journal.lease(newId, replacement);
      await assert.rejects(journal.register(newId, expired, observation), /lease lost/);
      await journal.release(newId, replacement, false);
      const wrongActor = postgresJournal(url, randomUUID());
      await assert.rejects(wrongActor.inspect(newId), /Existing CMS actor/);
      await pg.exec("set role arnaud_cms_runtime");
      await assert.rejects(journal.inspect(newId), /role denied/);
      await pg.exec("set role arnaud_cms_migrator");
    } finally { await server.stop(); }
  } finally { await pg.close(); }
});
