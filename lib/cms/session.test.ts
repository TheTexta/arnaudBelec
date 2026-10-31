import assert from "node:assert/strict";
import { test } from "node:test";
import { accessToken, allowedUser, assertOrigin, cookieNames, sessionCookies, tokenExpiry, verifyToken } from "./session";

test("Supabase bridge fails closed on bearer, expiry, allowlist and exact-origin checks", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    const id = "32345678-1234-4234-8234-123456789abc";
    Object.assign(process.env, { ARNAUD_CMS_ENABLED: "true", ARNAUD_CMS_ORIGIN: "https://arnaud.example.test", SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only", SUPABASE_ADMIN_USER_IDS: id });
    const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
    const names = cookieNames();
    const headers = new Headers({ cookie: `${names.access}=${token}`, origin: "https://arnaud.example.test" });
    assert.equal(accessToken(headers, true), token);
    headers.set("authorization", "Bearer invalid");
    assert.equal(accessToken(headers), "invalid");
    headers.set("authorization", "garbage");
    assert.equal(accessToken(headers), "");
    headers.delete("authorization");
    for (const origin of ["https://other.example.test", "null", "https://arnaud.example.test.attacker.test"]) {
      headers.set("origin", origin);
      assert.throws(() => accessToken(headers, true), /must come from/);
    }
    headers.delete("origin");
    assert.throws(() => assertOrigin(headers));
    globalThis.fetch = async () => Response.json({ id, email: "fixture@example.test" });
    assert.equal((await verifyToken(token))?.id, id);
    globalThis.fetch = async () => Response.json({ id: "another-site", email: "fixture@example.test" });
    assert.equal(await verifyToken(token), null);
    assert.equal(allowedUser("another-site"), false);
    assert.equal(tokenExpiry("malformed"), null);
    assert.equal(tokenExpiry(`header.${Buffer.from('{"exp":1}').toString("base64url")}.signature`), null);
    const response = sessionCookies(new Response(), { access_token: token, refresh_token: "private-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 });
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Strict/);
    assert.match(sessionCookies(new Response()).headers.get("set-cookie") ?? "", /Max-Age=0/);
    process.env.ARNAUD_CMS_ENABLED = "false";
    assert.equal(accessToken(new Headers({ cookie: `${names.access}=${token}` })), "");
  } finally { process.env = previous; globalThis.fetch = originalFetch; }
});
