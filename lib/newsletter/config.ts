import type { Payload, PayloadRequest } from "payload";

export function newsletterEnvironment() {
  if (process.env.ARNAUD_SITE_EXPANSION_ENABLED !== "true" || process.env.ARNAUD_NEWSLETTER_ENABLED !== "true" || process.env.ARNAUD_CMS_ENABLED !== "true") return null;
  const key = process.env.ARNAUD_NEWSLETTER_API_KEY ?? "";
  const from = process.env.ARNAUD_NEWSLETTER_FROM ?? "";
  const secret = process.env.ARNAUD_NEWSLETTER_TOKEN_SECRET ?? "";
  if (!/^re_[A-Za-z0-9_-]{16,}$/.test(key) || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) || /[\r\n]/.test(from) || secret.length < 32 || !process.env.ARNAUD_CMS_DATABASE_URL || (process.env.PAYLOAD_SECRET?.length ?? 0) < 32) return null;
  try {
    const origin = new URL(process.env.ARNAUD_CMS_ORIGIN ?? "");
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null;
    return { key, from, secret, origin: origin.origin };
  } catch { return null; }
}

// No database initialization, settings read or provider I/O while flags/config are off.
export async function newsletterConfigured(payload?: Payload, req?: PayloadRequest): Promise<boolean> {
  if (!newsletterEnvironment()) return false;
  try {
    const cms = payload ?? await (await import("../cms/client")).getCms();
    // The string cast is temporary until the parent regenerates Payload types.
    const settings = await cms.findGlobal({ slug: "site-settings" as never, draft: false, depth: 0, overrideAccess: true, ...(req ? { req } : {}) });
    const published = settings as unknown as { _status?: string; newsletterEnabled?: boolean };
    return published._status === "published" && published.newsletterEnabled === true;
  } catch { return false; }
}
