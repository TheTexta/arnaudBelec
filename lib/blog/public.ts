import { cache } from "react";
import { getCms } from "../cms/client";
import { cmsEnabled } from "../cms/session";
import type { Post } from "@/payload-types";

export type PublishedPost = Post;
export type PostSummary = Pick<Post, "id" | "title" | "slug" | "excerpt" | "firstPublishedAt" | "updatedAt">;

export async function publishedPosts(page: number): Promise<{ posts: PostSummary[]; more: boolean }> {
  if (!cmsEnabled()) return { posts: [], more: false };
  const cms = await getCms();
  const result = await cms.find({
    collection: "posts", draft: false, overrideAccess: false, user: null,
    where: { _status: { equals: "published" } }, sort: "-firstPublishedAt,-id",
    page, limit: 20, depth: 0,
    select: { title: true, slug: true, excerpt: true, firstPublishedAt: true, updatedAt: true },
  });
  return { posts: result.docs, more: result.hasNextPage };
}

export const publishedPost = cache(async (slug: string): Promise<PublishedPost | null> => {
  if (!cmsEnabled() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return null;
  const cms = await getCms();
  const result = await cms.find({
    collection: "posts", draft: false, overrideAccess: false, user: null,
    where: { and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }] },
    limit: 1, depth: 1,
  });
  return result.docs[0] ?? null;
});
