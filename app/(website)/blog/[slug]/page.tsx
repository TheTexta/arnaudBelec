import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { publishedPost } from "@/lib/blog/public";
import BlogContent from "@/app/blog/content";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await publishedPost((await params).slug);
  if (!post) return { title: "Post not found — Arnaud Belec", robots: { index: false } };
  return { title: `${post.title} — Arnaud Belec`, description: post.excerpt || undefined, openGraph: { type: "article", title: post.title, description: post.excerpt || undefined, publishedTime: post.firstPublishedAt ?? undefined, modifiedTime: post.updatedAt } };
}

export default async function PostPage({ params }: Props) {
  const post = await publishedPost((await params).slug);
  if (!post) notFound();
  return <article className="journal-article">
    <header><Link className="blog-muted" href="/blog">Back to journal</Link><p className="journal-date" style={{ marginTop: 32 }}><time dateTime={post.firstPublishedAt ?? post.updatedAt}>{new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(post.firstPublishedAt ?? post.updatedAt))}</time></p><h1>{post.title}</h1>{post.excerpt ? <p className="journal-deck">{post.excerpt}</p> : null}</header>
    <BlogContent body={post.body} />
  </article>;
}
