"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BlogPost } from "@/lib/blog/document";
import { useSiteAdmin } from "@/app/admin/admin-access";

export default function PostsPage() {
  const { request } = useSiteAdmin();
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void request("/api/admin/posts").then(result => { if (active) { setPosts(result.posts as BlogPost[]); setError(""); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [request, reload]);

  async function create() {
    setBusy(true); setError("");
    try { const result = await request("/api/admin/posts", { method: "POST", body: "{}" }); router.push(`/admin/posts/${result.id}`); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }

  return <section><div className="blog-heading-row"><div><h1>Your posts</h1><p className="blog-muted">Draft freely. Only Publish changes the public journal.</p></div><button className="blog-button blog-button-primary" type="button" disabled={busy || posts === null} onClick={create}>{busy ? "Creating…" : "New post"}</button></div>
    {error ? <div className="blog-notice blog-error" role="alert"><p>{error}</p><button className="blog-button" type="button" onClick={() => setReload(value => value + 1)}>Try again</button></div> : null}
    {posts === null && !error ? <p role="status">Loading posts…</p> : null}
    {posts?.length === 0 ? <div className="blog-empty"><h2>A place to start writing.</h2><p className="blog-muted">Create your first post, add photographs, film or music, and save it privately until it is ready.</p></div> : null}
    {posts?.map(post => <article className="blog-post-row" key={post.id}><div><h2><Link href={`/admin/posts/${post.id}`}>{post.title}</Link></h2><p className="blog-muted">{post.publication ? post.publication.source_version === post.version ? "Published" : "Published · unpublished changes" : "Draft"} · Saved {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.updated_at))}</p></div><Link className="blog-button" href={`/admin/posts/${post.id}`}>Edit post</Link></article>)}
    {posts?.length === 200 ? <p className="blog-muted">Showing the 200 most recently edited posts.</p> : null}
  </section>;
}
