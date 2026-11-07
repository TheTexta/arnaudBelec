import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = readFileSync(new URL("../../deploy/cms/gateway/pgbouncer.ini", import.meta.url), "utf8");
const compose = readFileSync(new URL("../../deploy/cms/gateway/compose.yaml", import.meta.url), "utf8");
const hba = readFileSync(new URL("../../deploy/cms/gateway/runtime.hba", import.meta.url), "utf8");

test("gateway admits bounded frontend clients without raising the six-backend budget", () => {
  for (const key of ["max_client_conn", "max_db_client_connections", "max_user_client_connections"]) assert.match(config, new RegExp(`^${key} = 120$`, "m"));
  assert.match(config, /^arnaud_cms = .*pool_size=6 reserve_pool_size=0 max_db_connections=6 max_db_client_connections=120$/m);
  for (const key of ["default_pool_size", "max_db_connections", "max_user_connections"]) assert.match(config, new RegExp(`^${key} = 6$`, "m"));
  assert.match(config, /^reserve_pool_size = 0$/m);
});

test("gateway keeps transaction pooling, per-source admission and resource limits", () => {
  assert.match(config, /^pool_mode = transaction$/m);
  assert.match(compose, /mem_limit: 128m/);
  assert.match(compose, /inflightconn.amount: "30"/);
  assert.ok(!/^\s+ports:/m.test(compose));
});

test("gateway continues to use private HBA credentials and denies console access", () => {
  assert.match(config, /^auth_type = hba$/m);
  assert.match(config, /^auth_hba_file = \/etc\/pgbouncer\/runtime.hba$/m);
  assert.match(config, /^auth_file = \/etc\/pgbouncer\/users.txt$/m);
  assert.match(config, /^admin_users =\s*$/m);
  assert.match(config, /^stats_users =\s*$/m);
  assert.deepEqual(hba.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#")), ["host arnaud_cms arnaud_cms_runtime 0.0.0.0/0 scram-sha-256"]);
});
