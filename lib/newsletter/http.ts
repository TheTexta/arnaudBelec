import type { PostgresAdapter } from "@payloadcms/db-postgres";
import { after } from "next/server";
import { getCms } from "../cms/client";
import { isCmsUser } from "../cms/auth";
import { assertOrigin } from "../cms/session";
import { newsletterConfigured, newsletterEnvironment } from "./config";
import { NewsletterStore } from "./store";
import { hash, sendMessage } from "./provider";
import { dispatchBatch, type PublishedPost } from "./dispatch";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const unavailable = () => Response.json({ error: "Newsletter is not available right now." }, { status: 503, headers });
const generic = () => Response.json({ message: "If this address is eligible, a confirmation email will arrive. Follow its link to opt in. Check spam, or try again tomorrow." }, { status: 202, headers });

async function ready() {
  const config = newsletterEnvironment();
  if (!config) return null;
  const payload = await getCms();
  if (!await newsletterConfigured(payload)) return null;
  const pool = (payload.db as unknown as PostgresAdapter).pool;
  if (!pool) return null;
  return { config, payload, store: new NewsletterStore((text, values) => pool.query(text, values)) };
}

// Read streams with a byte budget; Content-Length alone is untrusted.
export async function boundedJSON(request: Request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) throw new Error("Use JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body.");
  let size = 0, body = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error("Body too large."); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid body.");
    return data as Record<string, unknown>;
  } finally { reader.releaseLock(); }
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  // Deliberately conservative ASCII mailbox syntax; reject control/header input.
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email) && email.split("@")[0].length <= 64 ? email : null;
}

export async function subscribe(request: Request) {
  if (!newsletterEnvironment()) return unavailable();
  let email: string | null;
  try {
    const data = await boundedJSON(request);
    email = Object.keys(data).length === 1 ? normalizeEmail(data.email) : null;
  } catch { return Response.json({ error: "Enter a valid email address." }, { status: 400, headers }); }
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400, headers });
  try {
    const context = await ready();
    if (!context) return unavailable();
    // Require the canonical site even for public POSTs. No cross-origin form spam.
    if (request.headers.get("origin") !== context.config.origin) return Response.json({ error: "Use the subscription form on this site." }, { status: 403, headers });
    const confirmation = await context.store.requestConfirmation(email, context.config.secret);
    if (confirmation) {
      // Durable one-per-address-per-day claim is committed BEFORE remote I/O.
      // Failed/uncertain confirmation sends are not automatically retried, so a
      // crash cannot generate repeated requests. Tokens still expire in 24h.
      const message = { to: email, subject: "Confirm your Arnaud Belec journal subscription",
        text: `You requested journal updates from Arnaud Belec. Confirm within 24 hours:\n\n${context.config.origin}/api/newsletter/confirm?token=${confirmation}\n\nIf you did not request this, ignore this email. You are not subscribed until you confirm.` };
      // Provider latency/outcome must not reveal whether an address is already
      // present. Next's after() keeps this work alive after the generic response.
      after(async () => { await sendMessage(message, `arnaud-optin:${hash(confirmation)}`); });
    }
    // Same response for confirmed, suppressed, rate-limited, or a provider failure.
    // This acknowledges the request, never claims subscription or delivery.
    return generic();
  } catch { return unavailable(); }
}

function page(title: string, copy: string, status = 200, action?: "confirm" | "unsubscribe", value?: string) {
  const form = action && value ? `<form method="post" action="/api/newsletter/${action}?token=${value}"><button type="submit">${action === "confirm" ? "Confirm subscription" : "Unsubscribe"}</button></form>` : "";
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Arnaud Belec</title><main><h1>${title}</h1><p>${copy}</p>${form}<p><a href="/">Return to Arnaud Belec</a></p></main></html>`, {
    status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" },
  });
}

export async function authorizedDispatcher(payload: Pick<import("payload").Payload, "auth">, headers: Headers) {
  try {
    assertOrigin(headers);
    const { user } = await payload.auth({ headers });
    return isCmsUser(user);
  } catch { return false; }
}

export async function tokenPage(request: Request, action: "confirm" | "unsubscribe") {
  if (!newsletterEnvironment()) return page("Newsletter unavailable", "Subscriptions are not available right now. Please try again later.", 503);
  const value = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return page("Invalid link", "This newsletter link is invalid. Use the subscription form to request a new confirmation.", 400);
  try {
    const context = await ready();
    if (!context) return page("Newsletter unavailable", "Please try again later.", 503);
    // GET does not mutate state: email link scanners cannot opt in/out for people.
    if (request.method === "GET") return page(action === "confirm" ? "Confirm journal updates" : "Leave journal updates",
      action === "confirm" ? "Choose Confirm subscription to receive new journal entries by email." : "Choose Unsubscribe to stop journal emails.", 200, action, value);
    if (request.headers.get("origin") !== context.config.origin) return page("Request not accepted", "Open the email link and use its confirmation button.", 403);
    if (action === "unsubscribe") {
      await context.store.unsubscribe(value);
      return page("Unsubscribe request complete", "If this link matched a subscription, it is now suppressed. No further journal updates will be sent; a message already in flight may still arrive.");
    }
    return await context.store.confirm(value)
      ? page("Subscription confirmed", "You will receive new journal entries by email. Every update includes an unsubscribe link.")
      : page("Link expired or already used", "This confirmation cannot be used. If you have not already confirmed, request a new link from the subscription form after 24 hours.", 400);
  } catch { return page("Newsletter unavailable", "We could not complete this request. Please try again later.", 503); }
}

export async function dispatch(request: Request) {
  if (!newsletterEnvironment()) return unavailable();
  try { assertOrigin(request.headers); }
  catch { return Response.json({ error: "Use Arnaud’s admin." }, { status: 403, headers }); }
  try {
    const context = await ready();
    if (!context) return unavailable();
    if (!await authorizedDispatcher(context.payload, request.headers)) return Response.json({ error: "Sign in to Arnaud’s admin." }, { status: 403, headers });
    let data: Record<string, unknown>;
    try { data = await boundedJSON(request); }
    catch { return Response.json({ error: "Send a JSON object with an optional limit (1–10)." }, { status: 400, headers }); }
    if (Object.keys(data).some(key => key !== "limit") || (data.limit !== undefined && (!Number.isInteger(data.limit) || Number(data.limit) < 1 || Number(data.limit) > 10))) return Response.json({ error: "Batch limit must be 1–10." }, { status: 400, headers });
    const result = await dispatchBatch({ ...context, readPost: async id => {
      try { return await context.payload.findByID({ collection: "posts", id, draft: false, depth: 0, overrideAccess: true }) as PublishedPost; }
      catch (error) { if ((error as { status?: number }).status === 404) return null; throw error; }
    } }, Number(data.limit ?? 10));
    return Response.json(result, { headers });
  } catch { return Response.json({ error: "Dispatch interrupted. Recorded attempts remain recoverable; do not resend outside the outbox." }, { status: 503, headers }); }
}
