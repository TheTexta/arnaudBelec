// Local-only integration tests. No dotenv, network clients, ports or host mounts.
// Run from the source repo, or set ARNAUD_PALETTE_SOURCE_DIR explicitly.
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const socket = "unix:///Users/dexteryoung/.colima/elliot-palette-tests/docker.sock";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`Isolated PostgreSQL 15 MMCQ tests (no production access).
Usage: DOCKER_HOST=${socket} [ARNAUD_PALETTE_SOURCE_DIR=/path/to/arnaudBelec] node scripts/test-mmcq-postgres.mjs
Requires cached postgres:15-alpine. Owns and stops only its random --rm --network none container.
No frozen --run artifact support; tests exercise synthetic complete typed snapshots.`);
} else {
  if (args.length) throw new Error(`Unknown argument: ${args[0]}; use --help`);
  if (process.env.DOCKER_HOST !== socket) throw new Error(`Refusing Docker access: explicitly set DOCKER_HOST=${socket}`);
  await test("isolated PostgreSQL 15 Arnaud MMCQ migration", async t => {
    const source = resolve(process.env.ARNAUD_PALETTE_SOURCE_DIR || process.cwd());
    const migrationDir = join(source, "supabase/migrations");
    const migrationFiles = (await readdir(migrationDir)).filter(n => n.endsWith(".sql")).sort();
    assert(migrationFiles.includes("20261105000000_add_arnaud_mmcq_palettes.sql"), "MMCQ migration missing from selected source");
    // Freeze the source in memory for this run. Never rewrite migration files.
    const migrations = await Promise.all(migrationFiles.map(async name => ({ name, sql: await readFile(join(migrationDir, name), "utf8") })));
    console.log(`Source: ${source}`);
    for (const m of migrations) console.log(`${m.name} sha256=${createHash("sha256").update(m.sql).digest("hex")}`);
    const { rgbToLab, rgbToHex } = await import(pathToFileURL(join(source, "lib/palette/oklab-k-medoids.mjs")));
    const name = `arnaud-mmcq-test-${randomUUID()}`;
    // Never inherit a Docker context, TLS override, database URL or credentials.
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      DOCKER_HOST: socket,
      // An intentionally nonexistent per-run config path avoids reading Docker auth/config.
      DOCKER_CONFIG: `/private/var/folders/bx/htl3m38d3qq52n4zs8z6cyh00000gn/T/opencode/${name}-docker-config`,
    };
    const dockerArgs = a => ["--host", socket, ...a];
    const docker = a => spawnSync("docker", dockerArgs(a), { env, encoding: "utf8", timeout: 90_000, maxBuffer: 32 * 1024 * 1024 });
    const psqlArgs = dockerArgs(["exec", "-i", name, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]);
    function sql(input, error) {
      const r = spawnSync("docker", psqlArgs, { env, input, encoding: "utf8", timeout: 30_000, maxBuffer: 32 * 1024 * 1024 });
      if (error) {
        assert.notEqual(r.status, 0, "Expected SQL failure");
        assert.match(r.stderr, error);
      } else assert.equal(r.status, 0, r.stderr || r.error?.message);
      return r.stdout.trim();
    }
    const active = new Set();
    function connection(input, keepOpen = false) {
      const child = spawn("docker", psqlArgs, { env, timeout: 30_000 });
      let stdout = "", stderr = "";
      child.stdout.on("data", b => { stdout += b; });
      child.stderr.on("data", b => { stderr += b; });
      child.on("error", e => { stderr += e.message; });
      child.stdin.on("error", () => {});
      active.add(child);
      const done = new Promise(resolveDone => child.on("close", status => {
        active.delete(child); resolveDone({ status, stdout: stdout.trim(), stderr });
      }));
      if (keepOpen) child.stdin.write(`${input}\n`); else child.stdin.end(input);
      return { child, done, output: () => stdout };
    }
    async function waitFor(predicate, message) {
      const end = Date.now() + 4000;
      while (Date.now() < end) {
        if (predicate()) return;
        await delay(25);
      }
      assert.fail(message);
    }
    async function gate(statement) {
      const session = connection(`begin; ${statement}; select 'gate-ready';`, true);
      await waitFor(() => session.output().includes("gate-ready"), "Independent lock gate did not become ready");
      return async () => {
        session.child.stdin.end("commit;\n");
        const r = await session.done;
        assert.equal(r.status, 0, r.stderr);
      };
    }
    const lit = value => `'${String(value).replaceAll("'", "''")}'`;
    const json = value => `${lit(JSON.stringify(value))}::jsonb`;
    const photoTable = "public.arnaud_photographs";
    const analysisTable = "public.arnaud_photo_palette_analyses";
    const colourTable = "public.arnaud_photo_palette_colours";
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
    const oldModel = "oklab-kmedoids-chroma-background-v2";
    const newModel = "mmcq64-vibrant-oklab-background-v1";
    const oldTime = "2026-01-02T03:04:05.123456+00:00";
    const newTime = "2026-11-05T06:07:08.654321+00:00";
    function colours(id, count, fresh = false) {
      return Array.from({ length: count }, (_, i) => {
        const rgb = [fresh ? 201 + i : 21 + i, 40 + i * 10, 80 + i * 5];
        const lab = rgbToLab(rgb);
        return { photograph_id: id, rank: i + 1, red: rgb[0], green: rgb[1], blue: rgb[2], hex: rgbToHex(rgb), lab_l: lab[0], lab_a: lab[1], lab_b: lab[2], weight: 1 / count };
      });
    }
    const analysis = (id, count, fresh = false) => ({ photograph_id: id, algorithm: fresh ? newModel : oldModel, algorithm_iterations: fresh ? 2 : 10, sample_longest_side: fresh ? 256 : 96, palette_size: count, analyzed_at: fresh ? newTime : oldTime });
    const insertRows = (table, rows) => `insert into ${table} select * from jsonb_populate_recordset(null::${table},${json(rows)});`;
    const snapshot = () => JSON.parse(sql("set role service_role; select public.arnaud_palette_snapshot();"));
    const unchanged = baseline => assert.deepEqual(snapshot(), baseline);
    const transition = (before, after, verify = false) => `select public.arnaud_apply_palette_snapshot(${json(before)},${json(after)},${verify});`;
    const run = (before, after, verify = false, error) => sql(`set role service_role; ${transition(before, after, verify)}`, error);
    const waiting = app => sql(`select count(*) from pg_stat_activity where application_name=${lit(app)} and wait_event_type='Lock';`) === "1";
    const compete = (app, before, after, prefix = "") => connection(`set application_name=${lit(app)}; set role service_role; ${prefix} ${transition(before, after)}`);
    const success = r => assert.equal(r.status, 0, r.stderr);
    let created = false;
    try {
      const cached = docker(["image", "inspect", "postgres:15-alpine"]);
      assert.equal(cached.status, 0, "Required cached postgres:15-alpine is unavailable; no automatic pull");
      const started = docker(["run", "--rm", "--detach", "--name", name, "--network", "none", "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:15-alpine"]);
      assert.equal(started.status, 0, started.stderr);
      created = true;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        // The image's temporary init server listens only on a Unix socket.
        // Loopback readiness therefore waits for the final server, without networking outside the container.
        if (docker(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).status === 0) { ready = true; break; }
        await delay(100);
      }
      assert(ready, "Owned Postgres container did not become ready");
      assert.match(sql("show server_version;"), /^15\./);
      sql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
      function reset(extraDdl = "") {
        sql(`drop schema if exists public cascade; drop schema if exists storage cascade;
          create schema public; grant usage on schema public to anon,authenticated,service_role;
          create schema storage; create table storage.objects(bucket_id text, name text);
          grant usage on schema storage to service_role; grant select on storage.objects to service_role;
          ${migrations.map(m => m.sql).join("\n")}
          create table public.test_photo_writes(n integer not null); insert into public.test_photo_writes values(0);
          create function public.test_touch_photo() returns trigger language plpgsql as $$ begin
            update public.test_photo_writes set n=n+1; new.updated_at=clock_timestamp(); return new; end $$;
          create trigger test_touch_photo before update on ${photoTable} for each row execute function public.test_touch_photo();
          grant update,select on public.test_photo_writes to service_role;
          ${extraDdl}`);
        const photographs = ids.map((id, i) => ({ id, storage_path: `uploads/${id}.jpg`, filename: `${i}.jpg`, image_width: 640 + i, image_height: 480, captured_at: i ? null : "2020-02-03", title: i ? null : "Owner's original text", alt_text: "Preserve é and 'quotes'", sort_order: i ? null : 4, created_at: oldTime, updated_at: oldTime, background_hex: "#101010", storage_provider: i ? "supabase" : "r2" }));
        sql(insertRows(photoTable, photographs) + insertRows(analysisTable, [analysis(ids[0], 7)]) + insertRows(colourTable, colours(ids[0], 7)));
        // Obtain schema only after all fixtures, grants, triggers and constraints exist.
        const before = snapshot();
        const after = structuredClone(before);
        after.analyses = ids.map((id, i) => analysis(id, [2, 1, 7][i], true));
        after.colours = ids.flatMap((id, i) => colours(id, [2, 1, 7][i], true));
        return { before, after };
      }

      await t.test("exact typed apply, verify, replay and reversed rollback preserve full photographs and timestamps", () => {
        const { before, after } = reset();
        assert.equal(run(before, after, true), "before");
        assert.equal(run(before, after), "applied");
        const applied = snapshot();
        assert.deepEqual(applied.photographs, before.photographs);
        assert.equal(sql("select n from public.test_photo_writes;"), "0");
        assert.equal(run(before, after, true), "after");
        assert.equal(run(before, after), "already_applied");
        unchanged(applied);
        assert.equal(run(after, before), "applied");
        unchanged(before);
        assert.equal(run(after, before), "already_applied");
        assert.equal(run(before, after, true), "before");
        assert.equal(before.analyses.length, 1, "Rollback restores absent analyses, not fabricated rows");
      });

      await t.test("anon/authenticated cannot execute any MMCQ helper", () => {
        const { before, after } = reset();
        const calls = ["select public.arnaud_palette_snapshot();", transition(before, after),
          `select public.arnaud_validate_photo_palette(${lit(newModel)},2::smallint,256::smallint,1::smallint,'#101010',${json(colours(ids[0], 1, true))});`];
        for (const role of ["anon", "authenticated"]) for (const call of calls) sql(`set role ${role}; ${call}`, /42501.*permission denied for function/s);
        unchanged(before);
      });

      await t.test("CHECK failure on new colour after deletes rolls back both palette tables", () => {
        const { before, after } = reset(`alter table ${colourTable} add constraint test_reject_new_red check (red <> 201);`);
        run(before, after, false, /23514.*test_reject_new_red/s);
        unchanged(before);
        assert.equal(run(before, after, true), "before");
      });

      await t.test("later text, schema and palette drift refuse apply and rollback without further changes", () => {
        for (const change of [
          `update ${photoTable} set title='Later owner text' where id=${lit(ids[0])}`,
          `alter table ${colourTable} add constraint test_schema_drift check (red >= 0)`,
          `update ${colourTable} set lab_a=lab_a+1 where rank=1`,
        ]) {
          for (const applied of [false, true]) {
            const { before, after } = reset();
            if (applied) run(before, after);
            sql(change);
            const current = snapshot();
            assert.equal(run(before, after, true), "stale");
            run(applied ? after : before, applied ? before : after, false, /Stale Arnaud palette snapshot/);
            unchanged(current);
          }
        }
      });

      await t.test("REPEATABLE READ and SERIALIZABLE isolation fail closed", () => {
        const { before, after } = reset();
        for (const isolation of ["repeatable read", "serializable"]) {
          sql(`begin isolation level ${isolation}; set role service_role; ${transition(before, after)} commit;`, /requires READ COMMITTED/);
          unchanged(before);
        }
      });

      for (const kind of ["catalogue", "palette"]) await t.test(`${kind} writer committed during lock wait is observed stale`, async () => {
        const { before, after } = reset();
        const change = kind === "catalogue"
          ? `update ${photoTable} set title='Concurrent writer' where id=${lit(ids[0])}`
          : `update ${colourTable} set lab_a=lab_a+1 where rank=1`;
        const release = await gate(change);
        const app = `arnaud-stale-${kind}`;
        const apply = compete(app, before, after);
        try { await waitFor(() => waiting(app), "Apply must actually wait for writer"); }
        finally { await release(); }
        const r = await apply.done;
        assert.notEqual(r.status, 0); assert.match(r.stderr, /Stale Arnaud palette snapshot/);
        const current = snapshot();
        if (kind === "catalogue") {
          assert.equal(current.photographs[0].title, "Concurrent writer");
          assert.deepEqual(current.analyses, before.analyses); assert.deepEqual(current.colours, before.colours);
          assert.deepEqual(current.photographs.slice(1), before.photographs.slice(1));
          assert.deepEqual({ ...current.photographs[0], title: before.photographs[0].title, updated_at: before.photographs[0].updated_at }, before.photographs[0]);
        } else {
          assert.deepEqual(current.photographs, before.photographs); assert.deepEqual(current.analyses, before.analyses);
          for (let i = 0; i < current.colours.length; i++) {
            const row = current.colours[i], old = before.colours[i];
            if (row.rank === 1) {
              assert(Math.abs(row.lab_a - old.lab_a - 1) < 0.00001);
              assert.deepEqual({ ...row, lab_a: old.lab_a }, old);
            } else assert.deepEqual(row, old);
          }
        }
      });

      await t.test("5s lock timeout leaves complete state unchanged and public reads available", async () => {
        const { before, after } = reset();
        const release = await gate(`lock table ${colourTable} in share mode`);
        const start = Date.now();
        const apply = compete("arnaud-lock-timeout", before, after);
        try {
          await waitFor(() => waiting("arnaud-lock-timeout"), "Apply did not wait for palette lock");
          for (const role of ["anon", "authenticated"]) {
            assert.equal(sql(`set role ${role}; set statement_timeout='1s'; select count(*) from ${photoTable}; select count(*) from ${colourTable};`), "3\n7");
          }
          const r = await apply.done;
          assert.notEqual(r.status, 0); assert.match(r.stderr, /55P03.*lock timeout/s);
          assert(Date.now() - start >= 4500, "Expected the configured five-second lock deadline");
          assert(Date.now() - start < 12_000, "Lock timeout was not bounded");
        } finally { await release(); }
        unchanged(before);
      });

      await t.test("verify avoids DML locks even while another writer holds palette locks", async () => {
        const { before, after } = reset();
        const release = await gate(`lock table ${analysisTable},${colourTable} in share row exclusive mode`);
        try { assert.equal(sql(`set statement_timeout='1s'; set role service_role; ${transition(before, after, true)}`), "before"); }
        finally { await release(); }
        unchanged(before);
      });

      await t.test("two racing applies yield one applied and one already_applied", async () => {
        const { before, after } = reset();
        const release = await gate(`lock table ${photoTable} in row exclusive mode`);
        const first = compete("arnaud-race-one", before, after), second = compete("arnaud-race-two", before, after);
        try { await waitFor(() => waiting("arnaud-race-one") && waiting("arnaud-race-two"), "Both applies must wait at photo lock"); }
        finally { await release(); }
        const results = await Promise.all([first.done, second.done]);
        results.forEach(success);
        assert.deepEqual(results.map(r => r.stdout).sort(), ["already_applied", "applied"]);
        assert.equal(run(before, after, true), "after");
        assert.deepEqual(snapshot().photographs, before.photographs);
      });

      function replaceSql(state, id = ids[0]) {
        const a = state.analyses.find(row => row.photograph_id === id);
        const background = state.photographs.find(row => row.id === id).background_hex;
        return `select public.arnaud_replace_photo_palette(${lit(id)}::uuid,${lit(a.algorithm)},${a.algorithm_iterations}::smallint,${a.sample_longest_side}::smallint,${a.palette_size}::smallint,${lit(a.analyzed_at)}::timestamptz,${lit(background)},${json(state.colours.filter(row => row.photograph_id === id))});`;
      }
      await t.test("normal replacement racing batch preserves table-before-row ordering and does not deadlock", async () => {
        const { before, after } = reset();
        const release = await gate(`lock table ${colourTable} in share mode`);
        const batch = compete("arnaud-batch-replace", before, after);
        let writer;
        try {
          await waitFor(() => waiting("arnaud-batch-replace"), "Batch must hold photo SHARE while waiting for palette lock");
          writer = connection(`set application_name='arnaud-normal-replace'; set statement_timeout='8s'; set role service_role; ${replaceSql(after)}`);
          await waitFor(() => waiting("arnaud-normal-replace"), "Replacement must wait for batch photo SHARE");
        } finally { await release(); }
        const results = await Promise.all([batch.done, writer.done]);
        results.forEach(success); assert.equal(results[0].stdout, "applied");
        assert.equal(run(before, after, true), "after");
        assert.deepEqual(snapshot().photographs, before.photographs);
        assert.equal(sql("select n from public.test_photo_writes;"), "0");
        assert.equal(sql("select deadlocks from pg_stat_database where datname=current_database();"), "0");
      });

      await t.test("outer statement deadline survives the function's internal statement_timeout setting", async () => {
        const { before, after } = reset();
        const release = await gate(`lock table ${colourTable} in share mode`);
        const start = Date.now();
        const apply = compete("arnaud-outer-deadline", before, after, "set statement_timeout='750ms';");
        try {
          await waitFor(() => waiting("arnaud-outer-deadline"), "Deadline test must enter lock wait");
          const r = await apply.done;
          assert.notEqual(r.status, 0); assert.match(r.stderr, /57014.*statement timeout/s);
          assert(Date.now() - start < 3500, "Internal timeout must not replace the already-running outer deadline");
        } finally { await release(); }
        unchanged(before);
      });

      await t.test("normal writers still accept legacy seven colours and MMCQ sizes 1 through 7", () => {
        const { before } = reset();
        sql(`set role service_role; ${replaceSql(before)}`);
        unchanged(before);
        for (let count = 1; count <= 7; count++) {
          const state = structuredClone(before);
          state.analyses = [analysis(ids[0], count, true)]; state.colours = colours(ids[0], count, true);
          sql(`set role service_role; ${replaceSql(state)}`);
          assert.equal(snapshot().colours.length, count);
          assert.deepEqual(snapshot().photographs, before.photographs);
        }
      });

      await t.test("invalid desired payloads fail without changing complete state", () => {
        const { before, after } = reset();
        for (const mutate of [
          a => { a.photographs[0].title = "Forbidden edit"; },
          a => { a.analyses[0].palette_size = 3; },
          a => { a.colours[0].hex = "#ffffff"; },
          a => { a.colours[0].lab_a = "NaN"; },
          a => { a.colours[0].weight = 0; },
          a => { a.colours[0].rank = 2; },
        ]) {
          const bad = structuredClone(after); mutate(bad);
          run(before, bad, false, /Palette backfill cannot change|Invalid Arnaud palette/);
          unchanged(before);
        }
      });

      await t.test("palette user triggers, rules and inbound foreign keys are rejected", () => {
        for (const change of [
          `create trigger unexpected after insert on ${colourTable} for each row execute function public.test_touch_photo()`,
          `create rule unexpected as on delete to ${colourTable} do also notify test_rule`,
          `create table public.test_child(id uuid references ${analysisTable}(photograph_id))`,
        ]) {
          const { before, after } = reset(); sql(change);
          sql("set role service_role; select public.arnaud_palette_snapshot();", /Unsupported Arnaud palette schema/);
          run(before, after, false, /Unsupported Arnaud palette schema/);
          // Snapshot intentionally refuses this schema; inspect raw complete table rows.
          const raw = (table, order) => JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r) order by ${order}),'[]') from ${table} r;`));
          assert.deepEqual(raw(photoTable, "r.id"), before.photographs);
          assert.deepEqual(raw(analysisTable, "r.photograph_id"), before.analyses);
          assert.deepEqual(raw(colourTable, "r.photograph_id,r.rank"), before.colours);
        }
      });
    } finally {
      // Close only our own subprocess inputs; never inspect/stop another container.
      for (const child of active) child.stdin.end();
      if (created) {
        const stopped = docker(["stop", "--time", "2", name]);
        assert.equal(stopped.status, 0, `Could not stop owned container ${name}: ${stopped.stderr}`);
      }
    }
  });
}
