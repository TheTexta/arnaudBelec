import { randomUUID } from "node:crypto";
import { authorizeAdmin, adminErrorResponse, readAdminJson, AdminRequestError } from "@/lib/admin/server";
import { validateDocument, EMPTY_BODY } from "@/lib/blog/document";
import { blogDatabaseError, noStore } from "@/lib/blog/server";
import { assertLegacyJournalWrite } from "@/lib/cms/legacy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { service } = await authorizeAdmin(request);
    const { data, error } = await service.from("arnaud_blog_posts").select("id,title,slug,version,updated_at,first_published_at,publication:arnaud_blog_publications(source_version,slug)").order("updated_at", { ascending: false }).limit(200);
    if (error) blogDatabaseError(error);
    return noStore({ posts: data });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { service, user } = await authorizeAdmin(request);
    assertLegacyJournalWrite();
    // A create request has no content; every subsequent edit uses optimistic saves.
    await readAdminJson(request);
    const id = randomUUID();
    const document = validateDocument({ title: "Untitled post", slug: `untitled-${id.slice(0, 8)}`, excerpt: "", body: EMPTY_BODY });
    const { error } = await service.rpc("arnaud_save_blog_post", { p_id: id, p_version: 0, p_document: document, p_user_id: user.id });
    if (error) blogDatabaseError(error);
    return noStore({ id }, 201);
  } catch (error) { return adminErrorResponse(error instanceof SyntaxError ? new AdminRequestError("Invalid request.", 400) : error); }
}
