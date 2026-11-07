import { APIError, type PayloadRequest, type Where } from "payload";
import { isCmsUser } from "./auth";

export const projectCollections = { video: "videos", fashion: "fashion-projects" } as const;
export function siteExpansionEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ARNAUD_CMS_ENABLED === "true" && env.ARNAUD_SITE_EXPANSION_ENABLED === "true";
}
export function requireSiteExpansion() {
  if (!siteExpansionEnabled()) throw new APIError("The site expansion is not enabled.", 503);
}
export const siteAdmin = ({ req }: { req: PayloadRequest }) => siteExpansionEnabled() && isCmsUser(req.user);
export const siteRead = ({ req }: { req: PayloadRequest }): boolean | Where =>
  !siteExpansionEnabled() ? false : isCmsUser(req.user) ? true : { _status: { equals: "published" } };

export function mediaId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

export type MediaUse = { id: string; kind?: "image" | "video" | "audio" };
export async function validateSiteMedia(req: PayloadRequest, uses: MediaUse[], publishing: boolean) {
  requireSiteExpansion();
  const ids = [...new Set(uses.map(use => use.id))];
  if (!ids.length) return ids;
  const result = await req.payload.find({ collection: "media", where: { id: { in: ids } }, pagination: false, depth: 0, overrideAccess: true, req });
  const media = new Map(result.docs.map(item => [item.id, item]));
  for (const use of uses) {
    const item = media.get(use.id);
    if (!item || item.verified !== true || !/^[a-f0-9]{64}$/i.test(item.sha256 ?? "")) throw new APIError("Use a verified original from the Media library.", 400);
    if (use.kind && !item.mimeType?.startsWith(`${use.kind}/`)) throw new APIError(`Select ${use.kind} media for this field.`, 400);
    if (publishing && item.mimeType?.startsWith("image/") && !item.alt?.trim()) throw new APIError("Add an image description in the Media library before publishing.", 400);
  }
  return ids;
}
