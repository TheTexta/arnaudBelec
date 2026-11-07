"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BlogContent from "@/app/blog/content";
import type { Post } from "@/payload-types";
import { cmsRequest } from "./request";

export function PreviewClient() {
  const id = useSearchParams().get("id") ?? "";
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    cmsRequest(`/api/cms/posts/${encodeURIComponent(id)}?draft=true&depth=1`)
      .then(result => { if (active) setPost(result as unknown as Post); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id]);
  return <section className="journal-shell cms-preview"><p>Private preview · saved draft only.</p>{error ? <p role="alert">{error}</p> : post ? <article className="journal-article"><h1>{post.title}</h1><p>{post.excerpt}</p><BlogContent body={post.body} /></article> : <p role="status">Loading preview…</p>}</section>;
}
