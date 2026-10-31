import { UUID } from "@/lib/blog/document";
import { publicBlogClient } from "@/lib/blog/server";
import { blogStorage } from "@/lib/blog/storage";

export const runtime = "nodejs";

// RLS exposes only verified media referenced by a currently published post.
// The browser transfers bytes directly from R2, including video range requests.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  const { id } = await context.params;
  if (!UUID.test(id)) return new Response(null, { status: 404, headers });
  const client = publicBlogClient();
  if (!client) return new Response(null, { status: 503, headers });
  const { data, error } = await client.from("arnaud_blog_media").select("id,storage_path,content_type,state").eq("id", id).maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!data) return new Response(null, { status: 404, headers });
  try {
    const url = await blogStorage().signRead(data.storage_path, data.content_type, false);
    return new Response(null, { status: 307, headers: { ...headers, Location: url } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
