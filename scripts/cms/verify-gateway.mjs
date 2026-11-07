import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { lookup } from "node:dns/promises";
import { writeFile } from "node:fs/promises";
import tls from "node:tls";
import pg from "pg";

const url = new URL(process.env.ARNAUD_CMS_DATABASE_URL || "http://invalid");
assert.equal(url.hostname, "arnaud-cms-db.dextery.dev");
assert.equal(url.username, "arnaud_cms_runtime");
assert.equal(url.searchParams.get("sslmode"), "verify-full");
const base = { host: url.hostname, port: 443, user: url.username, password: decodeURIComponent(url.password), database: "arnaud_cms", ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 4000 };
const checks = [];
async function rejected(name, overrides, expected) {
  const client = new pg.Client({ ...base, ...overrides });
  let failure;
  try { await client.connect(); } catch (error) { failure = error; }
  finally { await client.end(); }
  assert.ok(failure, `${name} unexpectedly connected`);
  if (expected) assert.ok(expected.includes(failure.code), `${name}: unexpected rejection code ${failure.code}`);
  checks.push({ name, rejected: true, code: failure.code || failure.name });
}

const client = new pg.Client(base);
await client.connect();
try {
  assert.equal(client.connection.stream.encrypted, true);
  assert.equal(client.connection.stream.authorized, true);
  const identity = (await client.query("select current_user,current_database()" )).rows[0];
  assert.equal(identity.current_user, "arnaud_cms_runtime");
  assert.equal(identity.current_database, "postgres");
  checks.push({ name: "verified public TLS, SNI, SCRAM and existing database", protocol: client.connection.stream.getProtocol() });
  const scope = (await client.query(`select
    has_database_privilege(current_user,current_database(),'CREATE') as database_create,
    has_schema_privilege(current_user,'public','CREATE') as public_create,
    has_schema_privilege(current_user,'arnaud_cms','CREATE') as cms_create,
    pg_has_role(current_user,'arnaud_cms_owner','MEMBER') as owner_membership,
    (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname !~ '^pg_' and n.nspname<>'information_schema' and c.relkind in ('r','p','v','m','f')
      and has_schema_privilege(current_user,n.oid,'USAGE')
      and n.nspname<>'arnaud_cms' and not (n.nspname='public' and c.relname like 'arnaud_blog_%')
      and has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) as unrelated_relation_access,
    (select count(*)::int from pg_proc p where p.prosecdef and p.pronamespace<>'pg_catalog'::regnamespace
      and has_schema_privilege(current_user,p.pronamespace,'USAGE') and has_function_privilege(current_user,p.oid,'EXECUTE')) as privileged_function_access`)).rows[0];
  assert.deepEqual(scope, { database_create: false, public_create: false, cms_create: false, owner_membership: false, unrelated_relation_access: 0, privileged_function_access: 0 });
  await client.query("begin");
  let ddlDenied = false;
  try { await client.query("create table arnaud_cms.__gateway_ddl_must_fail(id integer)"); }
  catch (error) { assert.equal(error.code, "42501"); ddlDenied = true; }
  finally { await client.query("rollback"); }
  assert.equal(ddlDenied, true);
  checks.push({ name: "runtime DDL, role escalation, unrelated relations and privileged functions denied" });
} finally { await client.end(); }

const authCodes = ["28000", "28P01", "3D000", "08P01"];
await rejected("wrong password", { password: "deliberately-invalid-not-production" }, authCodes);
await rejected("migration identity", { user: "arnaud_cms_migrator" }, authCodes);
await rejected("database superuser identity", { user: "postgres" }, authCodes);
await rejected("direct database name", { database: "postgres" }, authCodes);
await rejected("pooler administration console", { database: "pgbouncer" }, authCodes);
await rejected("plaintext connection", { ssl: false });
await rejected("wrong certificate hostname", { ssl: { rejectUnauthorized: true, checkServerIdentity: (_host, cert) => tls.checkServerIdentity("unmatched.invalid", cert) } }, ["ERR_TLS_CERT_ALTNAME_INVALID"]);
const unrelatedCA = tls.rootCertificates.find(pem => !/ISRG|Let's Encrypt|DST Root/i.test(new X509Certificate(pem).subject));
await rejected("untrusted certificate chain", { ssl: { rejectUnauthorized: true, ca: unrelatedCA } }, ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN"]);
const { address } = await lookup(url.hostname);
await rejected("missing SNI", { host: address }, ["ECONNRESET", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]);
await rejected("wrong SNI", { host: address, ssl: { rejectUnauthorized: true, servername: "unmatched.invalid" } }, ["ECONNRESET", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]);

const pool = new pg.Pool({ ...base, max: 3 });
try {
  await Promise.all(Array.from({ length: 24 }, async (_, index) => {
    const result = await pool.query({ name: "arnaud_gateway_prepared_v1", text: "select $1::integer + 1 as value", values: [index] });
    assert.equal(result.rows[0].value, index + 1);
  }));
  const sessions = (await pool.query("select count(*)::int as count from pg_stat_activity where usename=current_user and backend_type='client backend'" )).rows[0].count;
  assert.ok(sessions <= 6);
  checks.push({ name: "concurrent protocol-prepared queries and backend budget", queries: 24, runtimeBackendSessions: sessions });
} finally { await pool.end(); }
const result = { passed: true, checks };
await writeFile(".local/cms-migration-20261102/gateway-verification.json", JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify(result, null, 2));
