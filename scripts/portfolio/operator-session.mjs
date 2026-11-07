// Explicit operator-only session lifecycle for an already configured Arnaud admin.
// No passwords, new users, permanent API keys, authorization changes or email sends.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

export const cmsOrigin = "https://arnaud-belec.vercel.app";
const supabaseOrigin = "https://api.dextery.dev";
const host = "dextery@gmkserver.tail077753.ts.net";
const exec = promisify(execFile);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const privateJSON = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
const ssh = async command => (await exec("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, command.map(quote).join(" ")], { timeout: 30000, maxBuffer: 1024 * 1024 })).stdout;

async function readOnly(sql) {
  const stdout = await ssh(["docker", "exec", "supabase-db-qvorfovjsiinni7o8azmlluz", "psql", "-XqAt", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; ${sql}; COMMIT;`]);
  return JSON.parse(stdout);
}

async function sessions(userId, marker = null) {
  assert.ok(uuid(userId));
  if (marker) assert.match(marker, /^arnaud-adobe-import\/[0-9a-f-]{36}$/);
  return readOnly(`SELECT coalesce(json_agg(id ORDER BY id),'[]') FROM auth.sessions WHERE user_id='${userId}'::uuid${marker ? ` AND user_agent='${marker}'` : ""}`);
}

async function authClients(marker = null) {
  // Capture keys directly into private process memory. Never print/persist them.
  const stdout = await ssh(["docker", "exec", "supabase-kong-qvorfovjsiinni7o8azmlluz", "printenv", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"]);
  const [service, anon] = stdout.trim().split(/\r?\n/);
  assert.ok(service && anon, "Server-owned Auth configuration unavailable.");
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, ...(marker ? { global: { headers: { "User-Agent": marker } } } : {}) };
  return { admin: createClient(supabaseOrigin, service, options), client: createClient(supabaseOrigin, anon, options) };
}

export async function importSession(directory) {
  const session = JSON.parse(await readFile(join(directory, "session.private.json"), "utf8"));
  assert.ok(uuid(session.userId) && uuid(session.sessionId) && session.expiresAt > Date.now() / 1000 + 300, "Temporary session needs renewal or reconciliation.");
  return session;
}

export async function createImportSession(directory) {
  const privateRoot = await realpath(join(tmpdir(), "opencode"));
  directory = resolve(directory);
  assert.equal(dirname(directory), privateRoot, "Keep credentials outside the repository, under the approved private OpenCode temporary directory.");
  await mkdir(directory, { mode: 0o700 });
  const identities = await readOnly("SELECT coalesce(json_agg(row_to_json(u)),'[]') FROM (SELECT id,email FROM arnaud_cms.cms_users ORDER BY id LIMIT 2) u");
  assert.equal(identities.length, 1, "Ambiguous CMS identity; operator must choose an existing account explicitly.");
  const existing = identities[0];
  assert.ok(uuid(existing.id));
  const marker = `arnaud-adobe-import/${randomUUID()}`;
  const { admin, client } = await authClients(marker);
  const checked = await admin.auth.admin.getUserById(existing.id);
  assert.ok(!checked.error && checked.data.user?.id === existing.id && checked.data.user?.email === existing.email && checked.data.user?.email_confirmed_at, "Configured CMS/Auth identity mismatch.");
  const before = await sessions(existing.id);
  await privateJSON(join(directory, "prior-sessions.private.json"), before);
  const issuance = { requestedAt: new Date().toISOString(), userId: existing.id, marker, state: "prepared-before-issuance" };
  await privateJSON(join(directory, "session-issuance.private.json"), issuance);
  // Reserve and test the private credential destination before any session is issued.
  await privateJSON(join(directory, "session.private.json"), { state: "reserved", userId: existing.id, marker });
  await sessions(existing.id, marker); // Verify marker-based reconciliation is supported before issuance.
  // generateLink does NOT send email. This is the existing confirmed identity,
  // not signUp, an invented API-key mechanism, or a permission/claim change.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: existing.email });
  assert.ok(!link.error && link.data.properties?.hashed_token, "Existing-admin session preparation failed.");
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  assert.ok(!verified.error && verified.data.session && verified.data.user?.id === existing.id, "Existing-admin session verification failed.");
  const issued = verified.data.session;
  const claims = JSON.parse(Buffer.from(issued.access_token.split(".")[1], "base64url").toString());
  assert.ok(uuid(claims.session_id));
  const session = { userId: existing.id, sessionId: claims.session_id, accessToken: issued.access_token, refreshToken: issued.refresh_token, expiresAt: issued.expires_at, createdAt: new Date().toISOString() };
  // Persist before live checks: a transport failure must not lose revocation identity.
  try {
    const pending = join(directory, "session.private.json.writing");
    await privateJSON(pending, session);
    await rename(pending, join(directory, "session.private.json"));
  } catch (error) {
    // On a known-response persistence failure, revoke this exact in-memory token.
    // A lost verify response is instead handled by the pre-issuance marker journal.
    await admin.auth.admin.signOut(session.accessToken, "local");
    throw error;
  }
  const me = await fetch(`${cmsOrigin}/api/cms/cms-users/me`, { headers: { Authorization: `Bearer ${session.accessToken}` }, signal: AbortSignal.timeout(30000) });
  const data = await me.json().catch(() => null);
  assert.ok(me.status === 200 && data?.user?.id === existing.id, "Deployed CMS did not accept the existing-admin token; revoke this temporary session.");
  const after = await sessions(existing.id);
  assert.ok(after.includes(session.sessionId) && before.every(id => after.includes(id)), "Unexpected session preservation result.");
  assert.ok((await sessions(existing.id, marker)).includes(session.sessionId), "Auth did not retain the unique recovery marker; finish this known session before proceeding.");
  const receipt = { createdAt: session.createdAt, temporarySessionCreated: true, liveCmsAccepted: true, priorSessionsPreserved: before.length, emailSent: false, newAccount: false, passwordOrPermissionsChanged: false, secretsPrinted: false };
  await privateJSON(join(directory, "session-created.json"), receipt);
  return receipt;
}

export async function refreshImportSession(directory) {
  const path = join(directory, "session.private.json");
  const pending = join(directory, "session.private.json.writing");
  try { await stat(pending); throw new Error("Pending credential write requires explicit reconciliation, not another refresh."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const previous = JSON.parse(await readFile(path, "utf8"));
  const { admin, client } = await authClients();
  const result = await client.auth.refreshSession({ refresh_token: previous.refreshToken });
  assert.ok(!result.error && result.data.session && result.data.user?.id === previous.userId, "Temporary session refresh failed.");
  const issued = result.data.session;
  const claims = JSON.parse(Buffer.from(issued.access_token.split(".")[1], "base64url").toString());
  assert.equal(claims.session_id, previous.sessionId, "Refresh unexpectedly changed the session identity.");
  try {
    await privateJSON(pending, { ...previous, accessToken: issued.access_token, refreshToken: issued.refresh_token, expiresAt: issued.expires_at });
    await rename(pending, path);
  } catch (error) { await admin.auth.admin.signOut(issued.access_token, "local"); throw error; }
  return { refreshed: true, secretsPrinted: false };
}

export async function finishImportSession(directory) {
  const path = join(directory, "session.private.json");
  let session;
  try { session = JSON.parse(await readFile(path, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    try { return JSON.parse(await readFile(join(directory, "session-revoked.json"), "utf8")); }
    catch (receiptError) { if (receiptError.code !== "ENOENT") throw receiptError; }
    session = {};
  }
  if (!session.sessionId) {
    const issuance = JSON.parse(await readFile(join(directory, "session-issuance.private.json"), "utf8"));
    const marked = await sessions(issuance.userId, issuance.marker);
    assert.equal(marked.length, 0, "Ambiguous issuance: marked sessions exist without a persisted token. Run inspect and reconcile explicitly; never revoke unidentified differences.");
    for (const owned of [path, join(directory, "session.private.json.writing")]) {
      try { await unlink(owned); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const receipt = { completedAt: new Date().toISOString(), noMarkedSessionPresent: true, reservedCredentialArtifactDeleted: true, revocationClaimed: false };
    await privateJSON(join(directory, "session-reconciled.json"), receipt);
    return receipt;
  }
  const before = await sessions(session.userId);
  const wasPresent = before.includes(session.sessionId);
  if (wasPresent) {
    if (session.expiresAt <= Date.now() / 1000 + 60) { await refreshImportSession(directory); session = await importSession(directory); }
    try {
      const response = await fetch(`${cmsOrigin}/api/cms/cms-users/logout`, { method: "POST", headers: { Origin: cmsOrigin, Authorization: `Bearer ${session.accessToken}` }, signal: AbortSignal.timeout(30000) });
      await response.arrayBuffer();
    } catch { /* A lost logout response is reconciled by the exact session-ID read below. */ }
  }
  const after = await sessions(session.userId);
  const prior = JSON.parse(await readFile(join(directory, "prior-sessions.private.json"), "utf8"));
  assert.ok(!after.includes(session.sessionId), "Temporary session revocation not confirmed.");
  const othersPreserved = before.filter(id => id !== session.sessionId).every(id => after.includes(id));
  const originalPreserved = prior.every(id => after.includes(id));
  await unlink(path); // Only this run's newly created token artifact.
  try { await unlink(join(directory, "session.private.json.writing")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const receipt = { revokedAt: new Date().toISOString(), temporarySessionRevoked: true, alreadyAbsentAtCleanup: !wasPresent, localScopeOnly: true, otherSessionsPreserved: othersPreserved, priorSessionsPreserved: originalPreserved,
    historicalSessionsMissingBeforeCleanup: prior.filter(id => !before.includes(id)).length, tokenArtifactDeleted: true, secretsPrinted: false };
  await privateJSON(join(directory, "session-revoked.json"), receipt);
  assert.ok(othersPreserved, "Other active sessions changed during cleanup; inspect the revocation receipt.");
  return receipt;
}

export async function inspectImportSession(directory) {
  const issuance = JSON.parse(await readFile(join(directory, "session-issuance.private.json"), "utf8"));
  const marked = await sessions(issuance.userId, issuance.marker);
  const prior = JSON.parse(await readFile(join(directory, "prior-sessions.private.json"), "utf8"));
  const current = await sessions(issuance.userId);
  let credential;
  try { credential = JSON.parse(await readFile(join(directory, "session.private.json"), "utf8")).sessionId; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return { markedSessions: marked.length, hasPersistedSessionIdentity: !!credential, knownSessionPresent: !!credential && current.includes(credential), priorSessionsPreserved: prior.every(id => current.includes(id)),
    ambiguousIssuanceNeedsExplicitReconciliation: !credential && marked.length > 0, noSessionMutationPerformed: true, secretsPrinted: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, directory, confirmation] = process.argv.slice(2);
  try {
    assert.ok(directory && confirmation === "--confirm=arnaud-private-content-import", "Explicit session-operation confirmation required.");
    const result = action === "create" ? await createImportSession(directory) : action === "refresh" ? await refreshImportSession(directory) : action === "finish" ? await finishImportSession(directory) : action === "inspect" ? await inspectImportSession(directory) : null;
    assert.ok(result, "Use create, inspect, refresh or finish.");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Operator session operation stopped (${error.code || error.name}). No credentials printed. Any issued private session artifact is retained for exact local-scope revocation.`);
    process.exitCode = 1;
  }
}
