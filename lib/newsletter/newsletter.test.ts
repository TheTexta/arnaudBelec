import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Payload, PayloadRequest } from "payload";
import { NewsletterStore } from "./store";
import { newsletterConfigured, newsletterEnvironment } from "./config";
import { authorizedDispatcher, boundedJSON, dispatch, normalizeEmail, subscribe, tokenPage } from "./http";
import { hash, sendMessage, unsubscribeToken, type Message } from "./provider";
import { dispatchBatch, type PublishedPost } from "./dispatch";
import { queuePostAnnouncement } from "./queue";
import { NewsletterDeliveries, NewsletterRecipients, NewsletterSubscribers } from "./collections";

const secret = "isolated-newsletter-test-secret-0123456789";
const config = { origin: "https://newsletter.example.test", secret, from: "journal@example.test" };
function enable() {
  Object.assign(process.env, { ARNAUD_SITE_EXPANSION_ENABLED: "true", ARNAUD_NEWSLETTER_ENABLED: "true", ARNAUD_CMS_ENABLED: "true",
    ARNAUD_NEWSLETTER_API_KEY: "re_isolated_fixture_only_not_a_real_key", ARNAUD_NEWSLETTER_FROM: config.from,
    ARNAUD_NEWSLETTER_TOKEN_SECRET: secret, ARNAUD_CMS_ORIGIN: config.origin, ARNAUD_CMS_DATABASE_URL: "postgresql://unused.invalid/unused",
    PAYLOAD_SECRET: secret });
}

// Isolated operational fixture, NOT a replacement for the parent's generated
// migration, grants/RLS and native Payload integration checks.
async function fixture() {
  const db = await PGlite.create();
  await db.exec(`create schema arnaud_cms;
    create type arnaud_cms.subscriber_status as enum ('pending','confirmed','suppressed');
    create type arnaud_cms.delivery_status as enum ('queued','complete','cancelled');
    create type arnaud_cms.recipient_status as enum ('pending','sending','retry','sent','skipped','failed','reconcile');
    create table arnaud_cms.newsletter_subscribers(id uuid primary key,email text unique not null,status arnaud_cms.subscriber_status not null,
      confirmation_hash text unique,confirmation_expires_at timestamptz,confirmation_requested_at timestamptz,unsubscribe_hash text not null unique,
      confirmed_at timestamptz,suppressed_at timestamptz,created_at timestamptz not null,updated_at timestamptz not null);
    create table arnaud_cms.newsletter_deliveries(id uuid primary key,publication_key text unique not null,post_id uuid not null,
      status arnaud_cms.delivery_status not null,created_at timestamptz not null,updated_at timestamptz not null);
    create table arnaud_cms.newsletter_recipients(id uuid primary key,delivery_key text unique not null,delivery_id uuid not null references arnaud_cms.newsletter_deliveries,
      subscriber_id uuid not null references arnaud_cms.newsletter_subscribers,status arnaud_cms.recipient_status not null,
      first_attempt_at timestamptz,claimed_at timestamptz,retry_at timestamptz,claim_token text,message_hash text,provider_id text,last_error text,
      created_at timestamptz not null,updated_at timestamptz not null);`);
  const store = new NewsletterStore((text, values) => db.query(text, values));
  const confirmed = async (email = `${randomUUID()}@example.test`) => {
    const value = await store.requestConfirmation(email, secret);
    assert.ok(value); assert.equal(await store.confirm(value), true);
    return (await db.query<{ id: string }>("select id from arnaud_cms.newsletter_subscribers where email=$1", [email])).rows[0].id;
  };
  const delivery = async () => {
    const id = randomUUID(), post = randomUUID();
    await db.query("insert into arnaud_cms.newsletter_deliveries values ($1,$2,$3,'queued',now(),now())", [id, `first:${post}`, post]);
    return { id, post };
  };
  return { db, store, confirmed, delivery };
}

test("newsletter is disabled with no settings, database or provider I/O; unsafe configuration and origin fail closed", async () => {
  const old = { ...process.env }, original = globalThis.fetch;
  try {
    enable(); process.env.ARNAUD_NEWSLETTER_ENABLED = "false";
    let reads = 0;
    globalThis.fetch = async () => { throw new Error("Unexpected network"); };
    const payload = { findGlobal: async () => { reads++; throw new Error("Unexpected database"); } } as unknown as Payload;
    assert.equal(await newsletterConfigured(payload), false); assert.equal(reads, 0);
    const request = new Request(`${config.origin}/api/newsletter/subscribe`, { method: "POST" });
    assert.equal((await subscribe(request)).status, 503);
    assert.equal((await dispatch(request)).status, 503);
    assert.equal((await tokenPage(request, "confirm")).status, 503);
    assert.deepEqual(await sendMessage({ to: "fixture@example.test", subject: "fixture", text: "fixture" }, "fixture"), { status: "failed", error: "configuration_unavailable" });
    enable(); process.env.ARNAUD_CMS_ORIGIN = "https://newsletter.example.test/path";
    assert.equal(newsletterEnvironment(), null);
    enable(); process.env.ARNAUD_NEWSLETTER_TOKEN_SECRET = "short";
    assert.equal(newsletterEnvironment(), null);
    enable();
    assert.equal((await dispatch(new Request(`${config.origin}/api/newsletter/dispatch`, { method: "POST", headers: { Origin: "https://hostile.example.test" } }))).status, 403);
    for (const collection of [NewsletterSubscribers, NewsletterDeliveries, NewsletterRecipients]) {
      assert.equal(await (collection.access!.read as (args: unknown) => boolean)({ req: { user: null } }), false);
      for (const action of ["create", "update", "delete"] as const) assert.equal(await collection.access![action]!({ req: {} } as never), false);
    }
  } finally { process.env = old; globalThis.fetch = original; }
});

test("newsletter readiness requires explicitly published settings as well as opt-in", async () => {
  const old = { ...process.env }; enable();
  try {
    for (const [settings, expected] of [
      [{ _status: "draft", newsletterEnabled: true }, false],
      [{ newsletterEnabled: true }, false],
      [{ _status: "published", newsletterEnabled: false }, false],
      [{ _status: "published", newsletterEnabled: true }, true],
    ] as const) {
      let reads = 0;
      const payload = { findGlobal: async (args: Record<string, unknown>) => {
        reads++;
        assert.equal(args.slug, "site-settings");
        assert.equal(args.draft, false);
        assert.equal(args.depth, 0);
        return settings;
      } } as unknown as Payload;
      assert.equal(await newsletterConfigured(payload), expected);
      assert.equal(reads, 1);
    }
  } finally { process.env = old; }
});

test("disabled newsletter collections stay unlocked, hidden and reject operations before I/O", async () => {
  const old = { ...process.env }; enable();
  const id = randomUUID(); process.env.SUPABASE_ADMIN_USER_IDS = id;
  let reads = 0;
  const req = { user: { id, collection: "cms-users", _strategy: "supabase" },
    get payload() { reads++; throw new Error("Disabled operation touched Payload"); },
  } as unknown as PayloadRequest;
  try {
    for (const disabledFlag of ["ARNAUD_SITE_EXPANSION_ENABLED", "ARNAUD_CMS_ENABLED"]) {
      process.env[disabledFlag] = "false";
      for (const collection of [NewsletterSubscribers, NewsletterDeliveries, NewsletterRecipients]) {
        assert.equal(collection.lockDocuments, false);
        assert.equal(typeof collection.admin?.hidden, "function");
        assert.equal((collection.admin!.hidden as (args: unknown) => boolean)({ user: req.user }), true);
        assert.equal(await collection.access!.read!({ req }), false);
        const hooks = collection.hooks!.beforeOperation!;
        assert.ok(hooks.length > 0);
        for (const operation of ["read", "create", "update", "delete"]) {
          for (const hook of hooks) await assert.rejects(async () => hook({ operation, args: {}, req } as never), /not enabled/);
        }
      }
      process.env[disabledFlag] = "true";
    }
    assert.equal(reads, 0);
  } finally { process.env = old; }
});

test("bounded JSON and conservative email validation", async () => {
  assert.equal(normalizeEmail(" Person+tag@Example.test "), "person+tag@example.test");
  for (const value of [null, "a\r\nb@example.test", "..a@example.test", "a@localhost", "a@@example.test", `${"a".repeat(65)}@example.test`]) assert.equal(normalizeEmail(value), null);
  await assert.rejects(boundedJSON(new Request(config.origin, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "a".repeat(2000) }) })), /large/);
});

test("dispatch authorization requires both exact origin and the current Arnaud CMS identity", async () => {
  const old = { ...process.env }; enable();
  const id = randomUUID(); process.env.SUPABASE_ADMIN_USER_IDS = id;
  let calls = 0;
  let user: unknown = null;
  const payload = { auth: async () => { calls++; return { user }; } } as unknown as Pick<Payload, "auth">;
  try {
    assert.equal(await authorizedDispatcher(payload, new Headers()), false); assert.equal(calls, 0);
    const headers = new Headers({ Origin: config.origin });
    assert.equal(await authorizedDispatcher(payload, headers), false);
    user = { id, collection: "cms-users", _strategy: "local" };
    assert.equal(await authorizedDispatcher(payload, headers), false);
    user = { id: randomUUID(), collection: "cms-users", _strategy: "supabase" };
    assert.equal(await authorizedDispatcher(payload, headers), false);
    user = { id, collection: "cms-users", _strategy: "supabase" };
    assert.equal(await authorizedDispatcher(payload, headers), true);
  } finally { process.env = old; }
});

test("double opt-in is hashed, expiring and single-use; cooldown survives store instances; suppression cannot resubscribe", async () => {
  const { db, store } = await fixture();
  try {
    const value = await store.requestConfirmation("fixture@example.test", secret); assert.ok(value);
    const row = (await db.query<Record<string, unknown>>("select * from arnaud_cms.newsletter_subscribers")).rows[0];
    assert.equal(row.confirmation_hash, hash(value)); assert.notEqual(row.confirmation_hash, value);
    const other = new NewsletterStore((text, values) => db.query(text, values));
    assert.equal(await other.requestConfirmation("fixture@example.test", secret), null);
    assert.equal(await store.confirm(value), true); assert.equal(await other.confirm(value), false);
    assert.equal(await store.requestConfirmation("fixture@example.test", secret), null);
    const unsubscribe = unsubscribeToken(String(row.id), secret);
    await store.unsubscribe(unsubscribe); await store.unsubscribe(unsubscribe);
    assert.equal(await store.requestConfirmation("fixture@example.test", secret), null);
    assert.equal(await store.confirm(value), false);
    const expired = await store.requestConfirmation("expired@example.test", secret); assert.ok(expired);
    await db.exec("update arnaud_cms.newsletter_subscribers set confirmation_expires_at=now()-interval '1 second' where email='expired@example.test'");
    assert.equal(await store.confirm(expired), false);
    await db.exec("update arnaud_cms.newsletter_subscribers set confirmation_requested_at=now()-interval '25 hours' where email='expired@example.test'");
    assert.ok(await other.requestConfirmation("expired@example.test", secret));
    assert.equal(await store.confirm(expired), false);
  } finally { await db.close(); }
});

test("first publication queues once inside its transaction; no autosaves, restores, republish or backfill", async () => {
  const old = { ...process.env }; enable();
  const { db } = await fixture();
  const dialect = new PgDialect();
  let reads = 0;
  const req = { payload: { findGlobal: async (args: Record<string, unknown>) => {
    reads++; assert.equal(args.draft, false); assert.equal(args.depth, 0); assert.equal(args.req, req);
    return { _status: "published", newsletterEnabled: true };
  }, db: { sessions: { local: { db: { execute: (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const parsed = dialect.sqlToQuery(query); return db.query(parsed.sql, parsed.params);
  } } } } } }, transactionID: Promise.resolve("local"), context: {}, query: {} } as unknown as PayloadRequest;
  const doc = { id: randomUUID(), _status: "published", firstPublishedAt: new Date().toISOString() };
  const run = (previousDoc: Record<string, unknown> = {}) => queuePostAnnouncement({ doc, previousDoc, req } as never);
  try {
    await run(); await run();
    assert.equal((await db.query("select * from arnaud_cms.newsletter_deliveries")).rows.length, 1);
    const before = reads;
    await run({ firstPublishedAt: doc.firstPublishedAt });
    req.query.autosave = "true"; await run(); delete req.query.autosave;
    req.context.arnaudNativeJournal = { restoring: true }; await run(); delete req.context.arnaudNativeJournal;
    assert.equal(reads, before);
    req.transactionID = undefined;
    await assert.rejects(run(), /transaction/);
  } finally { process.env = old; await db.close(); }
});

test("dispatch sends confirmed-at-publication only; suppression and withdrawn posts are skipped", async () => {
  const { db, store, confirmed, delivery } = await fixture();
  try {
    const subscriber = await confirmed(); const d = await delivery();
    const later = await confirmed(); // Make ordering explicit at millisecond DB precision.
    await db.query("update arnaud_cms.newsletter_subscribers set confirmed_at=now()+interval '1 minute' where id=$1", [later]);
    let sent = 0;
    const readPost = async (id: string): Promise<PublishedPost> => ({ id, title: "New entry", slug: "entry", _status: "published" });
    const first = await dispatchBatch({ store, config, readPost, send: async (message, key) => {
      sent++; assert.match(key, /^arnaud-newsletter:/); assert.match(message.text, /\/blog\/entry/);
      assert.ok(message.unsubscribe); return { status: "sent", id: "mock-provider-id" };
    } });
    assert.equal(first.processed, 1); assert.equal(sent, 1);
    await dispatchBatch({ store, config, readPost, send: async () => { throw new Error("duplicate send"); } });
    const suppressed = await delivery(); await store.seed(suppressed.id, 10);
    await store.unsubscribe(unsubscribeToken(subscriber, secret));
    const result = await dispatchBatch({ store, config, readPost, send: async () => ({ status: "sent", id: "mock" }) });
    assert.equal(result.outcomes.skipped, 1);
    const withdrawn = await delivery();
    assert.deepEqual((await dispatchBatch({ store, config, readPost: async () => null })).outcomes, { withdrawn: 1 });
    assert.equal((await db.query<{ status: string }>("select status from arnaud_cms.newsletter_deliveries where id=$1", [withdrawn.id])).rows[0].status, "cancelled");
    assert.equal((await db.query<{ status: string }>("select status from arnaud_cms.newsletter_deliveries where id=$1", [d.id])).rows[0].status, "complete");
  } finally { await db.close(); }
});

test("retry reuses provider key and identical body; old uncertainty and changed messages require reconciliation", async () => {
  const { db, store, confirmed, delivery } = await fixture();
  try {
    await confirmed(); await delivery();
    let title = "Initial title";
    const readPost = async (id: string): Promise<PublishedPost> => ({ id, title, slug: "entry", _status: "published" });
    const calls: { key: string; message: Message }[] = [];
    const send = async (message: Message, key: string) => { calls.push({ key, message }); return { status: "retry" as const, error: "provider_outcome_uncertain" }; };
    assert.equal((await dispatchBatch({ store, config, readPost, send })).outcomes.retry, 1);
    await db.exec("update arnaud_cms.newsletter_recipients set retry_at=now()-interval '1 second'");
    await dispatchBatch({ store, config, readPost, send });
    assert.deepEqual(calls[0], calls[1]);
    title = "Edited title";
    await db.exec("update arnaud_cms.newsletter_recipients set retry_at=now()-interval '1 second'");
    assert.equal((await dispatchBatch({ store, config, readPost, send })).outcomes.reconcile, 1);
    assert.equal(calls.length, 2);
    const next = await delivery(); await store.seed(next.id, 1);
    const claimed = await store.claim(next.id); assert.ok(claimed);
    assert.equal(await store.claim(next.id), null, "active lease excludes concurrent workers");
    await db.exec("update arnaud_cms.newsletter_recipients set first_attempt_at=now()-interval '25 hours',claimed_at=now()-interval '3 minutes' where status='sending'");
    assert.equal(await store.claim(next.id), null);
    assert.equal((await db.query<{ status: string }>("select status from arnaud_cms.newsletter_recipients where id=$1", [claimed.id])).rows[0].status, "reconcile");
  } finally { await db.close(); }
});

test("Resend outcomes use mocked fetch only, with no raw errors/addresses persisted", async () => {
  const old = { ...process.env }, original = globalThis.fetch; enable();
  try {
    const message = { to: "fixture@example.test", subject: "fixture", text: "fixture" };
    for (const [code, expected] of [[429, "retry"], [503, "retry"], [400, "failed"], [409, "reconcile"]] as const) {
      globalThis.fetch = async (url, options) => { assert.equal(url, "https://api.resend.com/emails"); assert.equal((options!.headers as Record<string, string>)["Idempotency-Key"], "stable-key"); return new Response("private provider body", { status: code }); };
      assert.equal((await sendMessage(message, "stable-key")).status, expected);
    }
    globalThis.fetch = async () => { throw new Error("private network error"); };
    assert.deepEqual(await sendMessage(message, "stable-key"), { status: "retry", error: "provider_outcome_uncertain" });
    globalThis.fetch = async () => Response.json({ id: "mock-id" });
    assert.deepEqual(await sendMessage(message, "stable-key"), { status: "sent", id: "mock-id" });
  } finally { process.env = old; globalThis.fetch = original; }
});
