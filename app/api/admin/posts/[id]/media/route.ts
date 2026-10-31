import { randomUUID } from "node:crypto";
import { authorizeAdmin, adminErrorResponse, readAdminJson, AdminRequestError } from "@/lib/admin/server";
import { assertId, blogDatabaseError, noStore, readPost } from "@/lib/blog/server";
import { validateMedia } from "@/lib/blog/media";
import { blogStorage, PART_SIZE, type BlogMedia } from "@/lib/blog/storage";

export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { service } = await authorizeAdmin(request);
    const postId = assertId((await context.params).id);
    await readPost(service, postId);
    const input = await readAdminJson(request);
    if (!["prepare", "parts", "complete", "read"].includes(String(input.action))) throw new AdminRequestError("Unknown media action.", 400);
    if (input.action !== "read" && process.env.ARNAUD_BLOG_UPLOADS_ENABLED !== "true") throw new AdminRequestError("Blog uploads are not enabled. Configure site-scoped R2 access and enable ARNAUD_BLOG_UPLOADS_ENABLED after deployment checks.", 503);
    const storage = blogStorage();
    if (input.action === "prepare") {
      let file;
      try { file = validateMedia(input); }
      catch (error) { throw new AdminRequestError((error as Error).message, 400); }
      const id = randomUUID();
      const path = `blog/${id}.${file.extension}`;
      const { error } = await service.from("arnaud_blog_media").insert({ id, post_id: postId, storage_path: path, filename: file.filename, content_type: file.contentType, size_bytes: file.size });
      if (error) blogDatabaseError(error);
      const multipartId = await storage.create(path, file.contentType);
      const { error: updateError } = await service.from("arnaud_blog_media").update({ multipart_id: multipartId }).eq("id", id);
      if (updateError) blogDatabaseError(updateError);
      return noStore({ id, url: `/blog/media/${id}`, partSize: PART_SIZE });
    }
    const { data, error } = await service.from("arnaud_blog_media").select("*").eq("id", assertId(String(input.mediaId))).eq("post_id", postId).maybeSingle();
    if (error) blogDatabaseError(error);
    if (!data) throw new AdminRequestError("Media not found in this post.", 404);
    const media = data as BlogMedia;
    if (input.action === "read") {
      if (media.state === "uploading") throw new AdminRequestError("The media upload is not finished.", 409);
      return noStore({ url: await storage.signRead(media.storage_path, media.content_type, true) });
    }
    if (media.state !== "uploading") return noStore({ complete: true, url: `/blog/media/${media.id}` });
    if (Date.now() - new Date(media.created_at).getTime() > 86_400_000) throw new AdminRequestError("This upload reservation expired. Start a new upload.", 410, "upload_expired");
    if (input.action === "complete") {
      let verified;
      try { verified = await storage.finish(media); }
      catch (error) { throw new AdminRequestError((error as Error).message, 400); }
      const { error: updateError } = await service.from("arnaud_blog_media").update({ ...verified, state: "ready" }).eq("id", media.id).eq("state", "uploading");
      if (updateError) blogDatabaseError(updateError);
      return noStore({ complete: true, url: `/blog/media/${media.id}` });
    }
    if (!media.multipart_id) throw new AdminRequestError("The upload was not initialized. Start a new upload.", 409);
    if (await storage.head(media.storage_path)) return noStore({ transferred: true });
    if (input.partNumber === undefined) {
      const parts = await storage.parts(media.storage_path, media.multipart_id);
      return noStore({ parts: parts.map(part => ({ number: part.PartNumber, size: part.Size })), partSize: PART_SIZE });
    }
    if (!Number.isInteger(input.partNumber) || Number(input.partNumber) < 1 || Number(input.partNumber) > Math.ceil(media.size_bytes / PART_SIZE)) throw new AdminRequestError("Invalid upload part.", 400);
    return noStore({ url: await storage.signPart(media.storage_path, media.multipart_id, Number(input.partNumber)) });
  } catch (error) { return adminErrorResponse(error); }
}
