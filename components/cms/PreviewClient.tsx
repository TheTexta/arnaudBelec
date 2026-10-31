"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BlogContent from "@/app/blog/content";
import { documentMedia, validateDocument, UUID, type BlogDocument } from "@/lib/blog/document";
import { cmsRequest } from "./request";

export function PreviewClient() {
  const id = useSearchParams().get("id") ?? "";
  const [preview, setPreview] = useState<{ document: BlogDocument; media: Record<string, string> } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!UUID.test(id)) throw new Error("Choose a journal post to preview.");
      const result = await cmsRequest(`/api/cms/posts/${id}?draft=true`);
      const document = validateDocument(result);
      const entries = await Promise.all(documentMedia(document.body).map(async item => {
        const result = await cmsRequest(`/api/admin/posts/${id}/media`, { method: "POST", body: JSON.stringify({ action: "read", mediaId: item.id }) });
        return [`/blog/media/${item.id}`, String(result.url)];
      }));
      if (active) setPreview({ document, media: Object.fromEntries(entries) });
    }
    load().catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id]);
  return <section className="journal-shell cms-preview"><p>Private preview · saved draft only. Media links expire after five minutes; reload to refresh.</p>{error ? <p role="alert">{error}</p> : preview ? <article className="journal-article"><h1>{preview.document.title}</h1><p>{preview.document.excerpt}</p><BlogContent body={preview.document.body} mediaUrls={preview.media} /></article> : <p role="status">Loading preview…</p>}</section>;
}
