"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { documentMedia, mediaId, validateDocument, type BlogBlock, type BlogDocument, type BlogPost } from "@/lib/blog/document";
import { uploadBlogMedia } from "@/lib/blog/upload-browser";
import BlogContent from "../../blog/content";
import { useSiteAdmin, useAdminNavigationWarning } from "../admin-access";

const BlockEditor = dynamic(() => import("./block-editor"), { ssr: false, loading: () => <p role="status" className="blog-editor-help">Loading the writing tools…</p> });
type Revision = { version: number; saved_at: string };

export default function PostEditor({ id }: { id: string }) {
  const { request } = useSiteAdmin();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void request(`/api/admin/posts/${id}`).then(data => { if (active) { setPost(data.post as BlogPost); setError(""); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id, request, reload]);
  if (!post) return error ? <div className="blog-notice blog-error" role="alert"><p>{error}</p><button className="blog-button" onClick={() => setReload(value => value + 1)}>Try again</button></div> : <p role="status">Loading your draft…</p>;
  return <LoadedEditor initialPost={post} />;
}

function LoadedEditor({ initialPost }: { initialPost: BlogPost }) {
  const { request, userId } = useSiteAdmin();
  const [post, setPost] = useState(initialPost);
  const [draft, setDraft] = useState<BlogDocument>(() => ({ title: post.title, slug: post.slug, excerpt: post.excerpt, body: post.body }));
  const draftRef = useRef(draft);
  const versionRef = useRef(post.version);
  const editRef = useRef(0);
  const savedRef = useRef(0);
  const [editNumber, setEditNumber] = useState(0);
  const [savedNumber, setSavedNumber] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const blocked = useRef(false);
  const [error, setError] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [pendingUploads, setPendingUploads] = useState(0);
  const uploads = useRef(new Set<AbortController>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const backupKey = `arnaud-blog-draft-v1:${userId}:${post.id}`;
  const [recovery, setRecovery] = useState<BlogDocument | null>(() => {
    try {
      const stored = localStorage.getItem(backupKey);
      return stored ? validateDocument(JSON.parse(stored).document) : null;
    } catch { return null; }
  });

  const change = useCallback((update: Partial<BlogDocument>) => {
    const next = { ...draftRef.current, ...update };
    draftRef.current = next;
    setDraft(next);
    setEditNumber(++editRef.current);
  }, []);

  const saveDraft = useCallback(() => {
    const operation = queue.current.catch(() => {}).then(async () => {
      if (blocked.current) throw new Error("Download your draft and reload before saving again.");
      if (editRef.current === savedRef.current) return;
      const sequence = editRef.current;
      const document = draftRef.current;
      setSaving(true);
      try {
        const result = await request(`/api/admin/posts/${initialPost.id}`, { method: "PUT", body: JSON.stringify({ ...document, version: versionRef.current }) });
        const saved = result.post as BlogPost;
        versionRef.current = saved.version;
        savedRef.current = sequence;
        setSavedNumber(sequence);
        setPost(saved);
        setError("");
        if (editRef.current === sequence) { try { localStorage.removeItem(backupKey); } catch { /* Optional browser recovery. */ } }
      } catch (error) {
        if ((error as { code?: string }).code === "blog_conflict") { blocked.current = true; setConflict(true); }
        setError((error as Error).message);
        throw error;
      } finally { setSaving(false); }
    });
    queue.current = operation;
    return operation;
  }, [initialPost.id, request, backupKey]);

  useEffect(() => {
    if (editNumber === savedRef.current || busy || conflict) return;
    const timeout = window.setTimeout(() => { void saveDraft().catch(() => {}); }, 1800);
    return () => window.clearTimeout(timeout);
  }, [editNumber, busy, conflict, saveDraft]);

  useEffect(() => {
    if (editNumber === savedNumber) return;
    // Write synchronously after edits so even a failed network save is recoverable.
    try { localStorage.setItem(backupKey, JSON.stringify({ version: versionRef.current, document: draft })); } catch { /* Private browsing/quota may disable recovery. */ }
  }, [draft, editNumber, savedNumber, backupKey]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (editRef.current !== savedRef.current || uploads.current.size) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", beforeUnload);
    const controllers = uploads.current;
    return () => { window.removeEventListener("beforeunload", beforeUnload); controllers.forEach(controller => controller.abort()); };
  }, []);

  const resolveFileUrl = useCallback(async (url: string) => {
    const id = mediaId(url);
    if (!id) return "";
    const result = await request(`/api/admin/posts/${initialPost.id}/media`, { method: "POST", body: JSON.stringify({ action: "read", mediaId: id }) });
    if (typeof result.url !== "string") throw new Error("Could not load the private media preview.");
    return result.url;
  }, [initialPost.id, request]);

  const uploadFile = useCallback(async (file: File) => {
    const controller = new AbortController();
    uploads.current.add(controller);
    setPendingUploads(count => count + 1); setError("");
    try { return await uploadBlogMedia(file, initialPost.id, userId, request, setUploadMessage, controller.signal); }
    catch (error) { if (!controller.signal.aborted) setError((error as Error).message); throw error; }
    finally { uploads.current.delete(controller); setPendingUploads(count => count - 1); setUploadMessage(""); }
  }, [initialPost.id, userId, request]);

  async function showPreview() {
    setBusy(true); setError("");
    try {
      await saveDraft();
      const urls: Record<string, string> = {};
      await Promise.all([...new Set(documentMedia(draftRef.current.body).map(item => `/blog/media/${item.id}`))].map(async url => { urls[url] = await resolveFileUrl(url); }));
      setPreview(urls);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function publish(unpublish = false) {
    if (unpublish && !window.confirm("Unpublish this post? It will leave the public journal, but its draft, revisions, and original media will be retained.")) return;
    setBusy(true); setError("");
    try {
      if (unpublish) await queue.current.catch(() => {});
      else await saveDraft();
      const result = await request(`/api/admin/posts/${post.id}/publish`, { method: unpublish ? "DELETE" : "POST", body: JSON.stringify({ version: versionRef.current }) });
      setPost(result.post as BlogPost);
    } catch (error) {
      if ((error as { code?: string }).code === "blog_conflict") { blocked.current = true; setConflict(true); }
      setError((error as Error).message);
    } finally { setBusy(false); }
  }

  async function showRevisions() {
    if (revisions !== null) { setRevisions(null); return; }
    setBusy(true); setError("");
    try {
      await saveDraft();
      const result = await request(`/api/admin/posts/${post.id}/revisions`);
      setRevisions(result.revisions as Revision[]);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function replaceDraft(document: BlogDocument) {
    change({ ...document, ...(post.first_published_at ? { slug: post.slug } : {}) });
    setEditorKey(value => value + 1); setPreview(null);
  }

  async function restore(version: number) {
    if (!window.confirm(`Restore saved version ${version} into the draft? The current saved version will remain in history. This does not change the published post.`)) return;
    setBusy(true); setError("");
    try {
      await saveDraft();
      const result = await request(`/api/admin/posts/${post.id}/revisions?version=${version}`);
      replaceDraft(validateDocument((result.revision as { snapshot: unknown }).snapshot));
      setRevisions(null);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draftRef.current, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${draftRef.current.slug || "post"}-draft.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const disabled = busy || pendingUploads > 0 || conflict;
  const dirty = editNumber !== savedNumber;
  useAdminNavigationWarning(dirty || pendingUploads > 0 ? "Leave this draft? Active uploads will stop; unsaved writing is kept in this browser’s recovery copy." : null);
  const publicationState = post.publication ? post.publication.source_version === post.version && !dirty ? "Published" : "Published · unpublished changes" : "Private draft";

  return <section>
    <div className="blog-editor-toolbar"><div><Link href="/admin/posts" className="blog-muted" onClick={event => { if ((dirty || pendingUploads) && !window.confirm("Leave this draft? Unsaved work is kept in this browser’s recovery copy.")) event.preventDefault(); }}>Back to posts</Link><p className="blog-muted" aria-live="polite">{publicationState} · {saving ? "Saving draft…" : dirty ? "Unsaved changes" : "All changes saved"}</p></div><div className="blog-actions">
      <button className="blog-button" type="button" disabled={disabled || saving || !dirty} onClick={() => { void saveDraft().catch(() => {}); }}>Save draft</button>
      <button className="blog-button" type="button" disabled={disabled} onClick={showPreview}>{busy ? "Working…" : preview ? "Refresh preview" : "Preview"}</button>
      <button className="blog-button blog-button-primary" type="button" disabled={disabled} onClick={() => publish()}>{post.publication ? "Publish changes" : "Publish post"}</button>
    </div></div>
    {error ? <div className="blog-notice blog-error" role="alert"><p>{error}</p>{conflict ? <button className="blog-button" onClick={downloadDraft}>Download unsaved draft</button> : null}</div> : null}
    {recovery ? <div className="blog-notice"><p>This browser has an unsaved recovery copy for this post. Restore it into the draft, or keep the server’s saved version.</p><div className="blog-actions" style={{ marginTop: 12 }}><button className="blog-button" disabled={disabled} onClick={() => { replaceDraft(recovery); setRecovery(null); }}>Restore recovery copy</button><button className="blog-button" onClick={() => { setRecovery(null); try { localStorage.removeItem(backupKey); } catch { /* Optional recovery. */ } }}>Keep saved version</button></div></div> : null}
    {pendingUploads ? <p className="blog-notice" role="status">{uploadMessage || `Uploading ${pendingUploads} file(s)…`} Keep this tab open. Select the same file again to resume a failed upload.</p> : null}
    {preview ? <div><div className="blog-preview-banner"><p className="blog-muted">Private preview — only visible in this signed-in admin. Media links expire after five minutes; refresh the preview if needed.</p><button className="blog-button" onClick={() => setPreview(null)}>Back to writing</button></div><article className="journal-article"><header><h1>{draft.title}</h1>{draft.excerpt ? <p className="journal-deck">{draft.excerpt}</p> : null}</header><BlogContent body={draft.body} mediaUrls={preview} /></article></div> : <div className="blog-editor-document">
      <label className="blog-field">Post title<textarea className="blog-title-input" rows={1} value={draft.title} maxLength={200} disabled={busy} onChange={event => change({ title: event.target.value })} /></label>
      <label className="blog-field">URL name<input value={draft.slug} maxLength={100} readOnly={!!post.first_published_at} disabled={busy} onChange={event => change({ slug: event.target.value })} autoCapitalize="none" spellCheck={false} /><small>/blog/{draft.slug || "your-post"}{post.first_published_at ? " · Fixed after first publication to preserve links." : " · Lowercase letters, numbers, and hyphens."}</small></label>
      <label className="blog-field">Excerpt <span className="blog-muted">optional</span><textarea rows={2} value={draft.excerpt} maxLength={500} disabled={busy} onChange={event => change({ excerpt: event.target.value })} /><small>A short introduction for the journal index and link previews.</small></label>
      <p className="blog-muted blog-editor-help">Type / to insert text, a photograph, video or audio. Drag blocks to rearrange. Add descriptive photo captions before publishing. Uploads: up to 100 MiB each; JPG, PNG, WebP, MP4, WebM, MP3, Ogg or WAV.</p>
      <BlockEditor key={editorKey} initialContent={draft.body} onChange={(body: BlogBlock[]) => change({ body })} uploadFile={uploadFile} resolveFileUrl={resolveFileUrl} editable={!busy} />
    </div>}
    <div className="blog-actions" style={{ marginTop: 28 }}><button className="blog-button" disabled={disabled} type="button" onClick={showRevisions}>{revisions ? "Hide saved versions" : "Saved versions"}</button><button className="blog-button" type="button" onClick={downloadDraft}>Download draft</button>{post.publication ? <><Link className="blog-button" href={`/blog/${post.publication.slug}`} target="_blank" rel="noopener noreferrer">View published post</Link><button className="blog-button blog-button-danger" disabled={disabled} type="button" onClick={() => publish(true)}>Unpublish</button></> : null}</div>
    {revisions ? <section className="blog-revisions"><h2>Saved versions</h2><p className="blog-muted">The latest 50 saves. Restoring changes only the draft, never the published post.</p><ul>{revisions.map(revision => <li key={revision.version}><span className="blog-muted">Version {revision.version} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.saved_at))}</span><button className="blog-button" disabled={disabled || revision.version === post.version} onClick={() => restore(revision.version)}>Restore into draft</button></li>)}</ul></section> : null}
  </section>;
}
