import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";

// Run after a CMS-disabled production build. Exercise real Next rendering,
// including metadata and nested routes: a layout-level 404 alone is insufficient.
await access(".next/BUILD_ID");
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: {
    ...process.env, ARNAUD_CMS_ENABLED: "false",
    ARNAUD_CMS_DATABASE_URL: "postgresql://127.0.0.1:1/must-not-connect",
    SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_ADMIN_USER_IDS: "",
    R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
const exited = new Promise(resolve => child.once("exit", resolve));
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Disabled-CMS test server did not start.")), 15000);
  function collect(chunk) {
    output += chunk.toString();
    if (output.includes("Ready in")) { clearTimeout(timeout); resolve(); }
  }
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.once("error", error => { clearTimeout(timeout); reject(error); });
  child.once("exit", () => { clearTimeout(timeout); reject(new Error("Disabled-CMS test server exited before readiness.")); });
});
const checks = [];
try {
  await ready;
  for (const path of ["/admin", "/admin/posts", "/cms", "/cms/login", "/cms/photographs", "/cms/collections/posts/42345678-1234-4234-8234-123456789abc", "/cms/collections/posts/42345678-1234-4234-8234-123456789abc/versions/52345678-1234-4234-8234-123456789abc", "/api/cms/posts", "/api/cms/cms-users/me"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(15000), redirect: "manual" });
    await response.arrayBuffer();
    const expected = path.startsWith("/admin") ? 200 : 404;
    assert.equal(response.status, expected, path);
    checks.push({ path, status: response.status });
  }
} finally {
  child.kill("SIGTERM");
  await exited;
}
assert.doesNotMatch(output, /connect to Postgres|payloadInitError|unhandledRejection|ECONNREFUSED/i, "Disabled CMS rendering must never initialize a database connection.");
console.log(JSON.stringify({ cmsEnabled: false, databaseInitialization: "none", checks }, null, 2));
