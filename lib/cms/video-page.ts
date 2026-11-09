import { APIError, type GroupField, type PayloadRequest } from "payload";
import { mediaId } from "./site-access";

export function mergeVideoPage(original: unknown, next: unknown) {
  if (next === null) return null;
  return { ...(original && typeof original === "object" ? original : {}), ...(next && typeof next === "object" ? next : {}) };
}

export async function validateVideoPage(value: unknown, req: PayloadRequest) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) throw new APIError("Configure the Video page before publishing.", 400);
  const page = value as Record<string, unknown>;
  for (const [key, limit] of [["heading", 200], ["intro", 5000]] as const) {
    if (page[key] != null && (typeof page[key] !== "string" || page[key].length > limit)) throw new APIError(`Video page ${key} must contain at most ${limit} characters.`, 400);
  }
  const rows = page.orderedVideos ?? [];
  if (!Array.isArray(rows) || rows.length > 100) throw new APIError("Choose at most 100 videos in the manual order.", 400);
  const ordered = rows.map(row => mediaId(row?.video));
  if (ordered.some(id => !id) || new Set(ordered).size !== ordered.length) throw new APIError("Select a different published video for every manual-order row.", 400);
  const featured = mediaId(page.featuredVideo);
  if (page.featuredVideo && !featured) throw new APIError("Select a published featured video.", 400);
  const ids = [...new Set([...ordered, ...(featured ? [featured] : [])])] as string[];
  if (!ids.length) return;
  const found = await req.payload.find({ collection: "videos", where: { and: [{ id: { in: ids } }, { _status: { equals: "published" } }] }, draft: false, depth: 0, pagination: false, overrideAccess: false, req });
  if (found.docs.length !== ids.length) throw new APIError("Every featured and ordered video must currently be published. Remove unavailable selections before publishing settings.", 400);
}

export const videoPageField: GroupField = { name: "videoPage", type: "group", label: "Video page", admin: { description: "The featured video appears first, followed by manual order and remaining published videos. Save a draft, preview, then Publish Site settings to release all settings together." }, fields: [
  { name: "heading", type: "text", maxLength: 200 },
  { name: "intro", type: "textarea", maxLength: 5000 },
  { name: "featuredVideo", type: "relationship", relationTo: "videos", filterOptions: { _status: { equals: "published" } } },
  { name: "orderedVideos", dbName: "video_order", type: "array", maxRows: 100, fields: [{ name: "video", type: "relationship", relationTo: "videos", required: true, filterOptions: { _status: { equals: "published" } } }] },
] };
