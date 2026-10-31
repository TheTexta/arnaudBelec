import { authorizeAdmin, adminErrorResponse } from "@/lib/admin/server";
import { assertId, blogDatabaseError, inputVersion, noStore } from "@/lib/blog/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { service } = await authorizeAdmin(request);
    const id = assertId((await context.params).id);
    const version = new URL(request.url).searchParams.get("version");
    if (version !== null) {
      const { data, error } = await service.from("arnaud_blog_revisions").select("version,snapshot,saved_at").eq("post_id", id).eq("version", inputVersion(Number(version))).single();
      if (error) blogDatabaseError(error);
      return noStore({ revision: data });
    }
    const { data, error } = await service.from("arnaud_blog_revisions").select("version,saved_at").eq("post_id", id).order("version", { ascending: false }).limit(50);
    if (error) blogDatabaseError(error);
    return noStore({ revisions: data });
  } catch (error) { return adminErrorResponse(error); }
}
