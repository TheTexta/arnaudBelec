import { cache } from "react";
import { publicBlogClient } from "./server";
import { validateBody, type BlogDocument } from "./document";

export type PublishedPost = BlogDocument & { id: string; published_at: string; updated_at: string; source_version: number };
export type PostSummary = Omit<PublishedPost, "body">;

export async function publishedPosts(page: number): Promise<{ posts: PostSummary[]; more: boolean }> {
  const client = publicBlogClient();
  if (!client) return { posts: [], more: false };
  const start = (page - 1) * 20;
  const { data, error } = await client.from("arnaud_blog_publications").select("id,title,slug,excerpt,published_at,updated_at,source_version").order("published_at", { ascending: false }).order("id").range(start, start + 20);
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return { posts: [], more: false };
    throw new Error("The journal could not be loaded.");
  }
  return { posts: (data ?? []).slice(0, 20) as PostSummary[], more: (data?.length ?? 0) > 20 };
}

export const publishedPost = cache(async (slug: string): Promise<PublishedPost | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return null;
  const client = publicBlogClient();
  if (!client) return null;
  const { data, error } = await client.from("arnaud_blog_publications").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return null;
    throw new Error("The post could not be loaded.");
  }
  return data ? { ...data, body: validateBody(data.body) } as PublishedPost : null;
});
