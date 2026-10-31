import { authorizeAdmin, adminErrorResponse, readAdminJson, AdminRequestError } from "@/lib/admin/server";
import { validateDocument } from "@/lib/blog/document";
import { assertId, blogDatabaseError, inputVersion, noStore, readPost } from "@/lib/blog/server";
import { assertLegacyJournalWrite } from "@/lib/cms/legacy";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { service } = await authorizeAdmin(request);
    return noStore({ post: await readPost(service, (await context.params).id) });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { service, user } = await authorizeAdmin(request);
    assertLegacyJournalWrite();
    const id = assertId((await context.params).id);
    const input = await readAdminJson(request, 1_048_576);
    let document;
    try { document = validateDocument(input); }
    catch (error) { throw new AdminRequestError((error as Error).message, 400); }
    const { data, error } = await service.rpc("arnaud_save_blog_post", { p_id: id, p_version: inputVersion(input.version), p_document: document, p_user_id: user.id }).single();
    if (error) blogDatabaseError(error);
    const { data: publication, error: publicationError } = await service.from("arnaud_blog_publications").select("source_version,slug").eq("id", id).maybeSingle();
    if (publicationError) blogDatabaseError(publicationError);
    // Return this save's exact version, never a subsequent writer's version.
    return noStore({ post: { ...(data as object), publication } });
  } catch (error) { return adminErrorResponse(error); }
}
