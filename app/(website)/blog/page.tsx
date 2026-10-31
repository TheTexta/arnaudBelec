import type { Metadata } from "next";
import Link from "next/link";
import { publishedPosts } from "@/lib/blog/public";

export const metadata: Metadata = { title: "Journal — Arnaud Belec", description: "Notes, photographs, films, and music by Arnaud Belec." };
export const dynamic = "force-dynamic";
const date = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(query.page ?? "1", 10) || 1));
  const { posts, more } = await publishedPosts(page);
  return <section className="journal-index">
    <h1>Journal</h1>
    <p className="journal-intro">Notes, photographs, films, and music.</p>
    {posts.length ? posts.map(post => <article className="journal-entry" key={post.id}>
      <time dateTime={post.published_at}>{date(post.published_at)}</time>
      <div><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>{post.excerpt ? <p>{post.excerpt}</p> : null}</div>
    </article>) : <p className="blog-empty">{page === 1 ? "The journal is quiet for now. Come back soon." : "No more posts on this page."}</p>}
    {page > 1 || more ? <nav className="journal-pagination" aria-label="Journal pages">{page > 1 ? <Link href={page === 2 ? "/blog" : `/blog?page=${page - 1}`}>Newer posts</Link> : null}{more ? <Link href={`/blog?page=${page + 1}`}>Older posts</Link> : null}</nav> : null}
  </section>;
}
