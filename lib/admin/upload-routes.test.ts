import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as prepare } from "../../app/api/admin/uploads/prepare/route";
import { POST as parts } from "../../app/api/admin/uploads/parts/route";
import { POST as publish } from "../../app/api/admin/uploads/publish/route";
import { readAdminJson } from "./server";

test("all upload endpoints reject unauthenticated requests before parsing or storage access", async () => {
  const values = { SUPABASE_URL: "https://supabase.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon", SUPABASE_SERVICE_ROLE_KEY: "test-service", SUPABASE_ADMIN_USER_IDS: "12345678-1234-1234-1234-123456789abc" };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    for (const endpoint of [prepare, parts, publish]) {
      const response = await endpoint(new Request("https://app.example.test/api/admin/uploads", { method: "POST", body: "not-json" }));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("JSON request bounds apply even without a Content-Length header", async () => {
  await assert.rejects(readAdminJson(new Request("https://app.example.test", { method: "POST", body: "x".repeat(9000) })), /too large/);
  for (const body of ["null", "[]", "not-json"]) await assert.rejects(readAdminJson(new Request("https://app.example.test", { method: "POST", body })), /valid JSON/);
});
