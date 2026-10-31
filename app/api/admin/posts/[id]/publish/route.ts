import { authorizeAdmin, adminErrorResponse, readAdminJson, AdminRequestError } from "@/lib/admin/server";
import { assertPublishable, documentMedia, validateDocument } from "@/lib/blog/document";
import { assertId, blogDatabaseError, inputVersion, noStore, readPost } from "@/lib/blog/server";
import { blogStorage, type BlogMedia } from "@/lib/blog/storage";
import { assertLegacyJournalWrite } from "@/lib/cms/legacy";

export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { service } = await authorizeAdmin(request);
    assertLegacyJournalWrite();
    const id = assertId((await context.params).id);
    const input = await readAdminJson(request);
    const version = inputVersion(input.version);
    const post = await readPost(service, id);
    if (post.version !== version) throw new AdminRequestError("The post has changed. Reload before publishing.", 409, "blog_conflict");
    let document;
    try { document = validateDocument(post); assertPublishable(document.body); }
    catch (error) { throw new AdminRequestError((error as Error).message, 400); }
    const references = documentMedia(document.body);
    const ids = [...new Set(references.map(item => item.id))];
    if (ids.length) {
      if (process.env.ARNAUD_BLOG_UPLOADS_ENABLED !== "true") throw new AdminRequestError("Enable blog R2 media after deployment checks before publishing uploaded media.", 503);
      const { data, error } = await service.from("arnaud_blog_media").select("*").eq("post_id", id).in("id", ids);
      if (error) blogDatabaseError(error);
      const media = data as BlogMedia[];
      if (media.length !== ids.length || media.some(item => item.state === "uploading") || references.some(ref => !media.find(item => item.id === ref.id)?.content_type.startsWith(`${ref.type}/`))) throw new AdminRequestError("Some media is unfinished, has the wrong type, or belongs to another post.", 400);
      const storage = blogStorage();
      for (const item of media) {
        if (item.state === "published") continue;
        const etag = await storage.promote(item);
        const { error: updateError } = await service.from("arnaud_blog_media").update({ state: "published", published_etag: etag }).eq("id", item.id);
        if (updateError) blogDatabaseError(updateError);
      }
    }
    const { error } = await service.rpc("arnaud_publish_blog_post", { p_id: id, p_version: version, p_media_ids: ids });
    if (error) blogDatabaseError(error);
    return noStore({ post: await readPost(service, id) });
  } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { service } = await authorizeAdmin(request);
    assertLegacyJournalWrite();
    const id = assertId((await context.params).id);
    const input = await readAdminJson(request);
    const { error } = await service.rpc("arnaud_unpublish_blog_post", { p_id: id, p_version: inputVersion(input.version) });
    if (error) blogDatabaseError(error);
    return noStore({ post: await readPost(service, id) });
  } catch (error) { return adminErrorResponse(error); }
}
