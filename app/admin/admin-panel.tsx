"use client";

import Image from "next/image";
import Link from "next/link";
import { AdminApiError, useAdminNavigationWarning, useSiteAdmin } from "./admin-access";
import { Upload } from "tus-js-client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MMCQ_SAMPLE_LONGEST_SIDE } from "@/lib/palette/config.mjs";

type UploadEntry = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  altText: string;
  capturedAt: string;
  sortOrder: string;
  status: "ready" | "analysing" | "uploading" | "publishing" | "published" | "error";
  progress: number;
  error: string | null;
  href: string | null;
  pendingTicket: string | null;
  pendingProvider: "supabase" | "r2" | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};
const MAXIMUM_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAXIMUM_INPUT_PIXELS = 120_000_000;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

async function imageSample(file: File): Promise<{ sample: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    if (width < 1 || height < 1 || width * height > MAXIMUM_INPUT_PIXELS) {
      throw new Error("The image dimensions are invalid or exceed the 120-million-pixel limit.");
    }
    const scale = Math.min(1, MMCQ_SAMPLE_LONGEST_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser could not create an image sample.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const sample = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the image sample.")), "image/png");
    });
    return { sample, width, height };
  } finally {
    bitmap.close();
  }
}

export default function AdminPanel() {
  const { userId, email: adminEmail, request: adminRequest, confirmNavigation } = useSiteAdmin();
  const [message, setMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const previewsRef = useRef<string[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const hasPendingPhotos = uploadBusy || entries.some(entry => entry.status !== "published");
  useAdminNavigationWarning(hasPendingPhotos ? "Leave photographs? Active uploads will stop and the unsent photo queue will be cleared. Original files are unchanged." : null);

  useEffect(() => {
    if (!hasPendingPhotos) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasPendingPhotos]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const updateEntry = (id: string, changes: Partial<UploadEntry>) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...changes } : entry));
  };

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const selectedNames = new Set(entries.map((entry) => entry.file.name));
    const additions: UploadEntry[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const contentType = MIME_BY_EXTENSION[extension];
      if (!contentType || (file.type && file.type !== contentType) || file.name.length > 240 || /[\u0000-\u001f/\\]/.test(file.name)) {
        rejected.push(`${file.name}: use a JPG, PNG, or WebP image with a valid filename.`);
        continue;
      }
      if (file.size < 1 || file.size > MAXIMUM_UPLOAD_BYTES) {
        rejected.push(`${file.name}: the file must be 500 MiB or smaller.`);
        continue;
      }
      if (selectedNames.has(file.name)) {
        rejected.push(`${file.name}: this filename is already in the queue.`);
        continue;
      }
      selectedNames.add(file.name);
      const previewUrl = URL.createObjectURL(file);
      previewsRef.current.push(previewUrl);
      additions.push({
        id: crypto.randomUUID(), file, previewUrl, title: "", altText: "", capturedAt: "", sortOrder: "",
        status: "ready", progress: 0, error: null, href: null, pendingTicket: null, pendingProvider: null,
      });
    }
    setEntries((current) => [...current, ...additions]);
    setMessage(rejected.join(" "));
  }

  function removeEntry(entry: UploadEntry) {
    URL.revokeObjectURL(entry.previewUrl);
    previewsRef.current = previewsRef.current.filter((url) => url !== entry.previewUrl);
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  }

  async function uploadOne(entry: UploadEntry, signal: AbortSignal) {
    signal.throwIfAborted();
    const uploadRequest = (path: string, init: RequestInit) => adminRequest(path, { ...init, signal });
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase is not configured.");
    updateEntry(entry.id, { status: "analysing", progress: 0, error: null });
    const { sample, width, height } = await imageSample(entry.file);
    signal.throwIfAborted();
    const recoveryKey = `arnaud-r2-v1:${userId}:${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`;
    let savedTicket: string | null = null;
    try { savedTicket = sessionStorage.getItem(recoveryKey); } catch { /* Storage may be unavailable. */ }
    const clearRecovery = () => { try { sessionStorage.removeItem(recoveryKey); } catch { /* Optional browser recovery. */ } };
    let ticket = entry.pendingTicket;
    let r2Ticket = entry.pendingTicket ? (entry.pendingProvider === "r2" ? entry.pendingTicket : null) : savedTicket;
    if (!ticket && r2Ticket) ticket = r2Ticket;
    if (r2Ticket) updateEntry(entry.id, { pendingTicket: r2Ticket, pendingProvider: "r2" });
    if (!ticket) {
      const prepared = await uploadRequest("/api/admin/uploads/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: entry.file.name, size: entry.file.size }),
      });
      signal.throwIfAborted();
      if (typeof prepared.path !== "string" || typeof prepared.ticket !== "string" || (prepared.provider !== "r2" && typeof prepared.token !== "string")) {
        throw new Error("The upload request returned incomplete data.");
      }

      const extension = entry.file.name.split(".").pop()?.toLowerCase() ?? "";
      updateEntry(entry.id, { status: "uploading" });
      if (prepared.provider === "r2") {
        r2Ticket = prepared.ticket;
        ticket = prepared.ticket;
        updateEntry(entry.id, { pendingTicket: ticket, pendingProvider: "r2" });
        try { sessionStorage.setItem(recoveryKey, ticket); } catch { /* The server journal still retains the reservation. */ }
      } else {
        await new Promise<void>((resolve, reject) => {
          const finish = () => signal.removeEventListener("abort", abort);
          const upload = new Upload(entry.file, {
            endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
            headers: { apikey: SUPABASE_ANON_KEY, "x-signature": prepared.token as string },
            metadata: {
              bucketName: "arnaudbelec",
              objectName: prepared.path as string,
              contentType: MIME_BY_EXTENSION[extension],
              cacheControl: "31536000",
            },
            chunkSize: 6 * 1024 * 1024,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            uploadDataDuringCreation: true,
            storeFingerprintForResuming: false,
            onProgress: (sent, total) => { if (!signal.aborted) updateEntry(entry.id, { progress: Math.round(sent / total * 100) }); },
            onError: (error) => { finish(); reject(error); },
            onSuccess: () => { finish(); resolve(); },
          });
          const abort = () => { finish(); void upload.abort().catch(() => {}); reject(signal.reason); };
          signal.addEventListener("abort", abort, { once: true });
          upload.start();
        });
        signal.throwIfAborted();
        ticket = prepared.ticket;
        updateEntry(entry.id, { pendingTicket: ticket, pendingProvider: "supabase" });
      }
    }

    if (r2Ticket) {
      updateEntry(entry.id, { status: "uploading" });
      try {
        const { uploadR2File } = await import("@/lib/admin/r2-browser");
        signal.throwIfAborted();
        await uploadR2File(entry.file, r2Ticket, uploadRequest, progress => { if (!signal.aborted) updateEntry(entry.id, { progress }); }, signal);
      } catch (error) {
        if (error instanceof AdminApiError && error.code === "ticket_invalid") {
          clearRecovery();
          updateEntry(entry.id, { pendingTicket: null, pendingProvider: null });
        }
        throw error;
      }
    }

    signal.throwIfAborted();
    updateEntry(entry.id, { status: "publishing", progress: 100 });
    const form = new FormData();
    form.set("ticket", ticket);
    form.set("width", String(width));
    form.set("height", String(height));
    form.set("sample", sample, "sample.png");
    form.set("title", entry.title);
    form.set("altText", entry.altText);
    form.set("capturedAt", entry.capturedAt);
    form.set("sortOrder", entry.sortOrder);
    let published: Record<string, unknown>;
    try {
      published = await uploadRequest("/api/admin/uploads/publish", { method: "POST", body: form });
    } catch (error) {
      if (error instanceof AdminApiError && ["ticket_invalid", "upload_missing", "upload_removed"].includes(error.code ?? "")) {
        updateEntry(entry.id, { pendingTicket: null, pendingProvider: null });
        clearRecovery();
      }
      throw error;
    }
    signal.throwIfAborted();
    if (typeof published.href !== "string") throw new Error("The photograph was published, but no link was returned.");
    updateEntry(entry.id, { status: "published", href: published.href, error: null, pendingTicket: null, pendingProvider: null });
    clearRecovery();
  }

  async function uploadAll() {
    if (uploadBusy || uploadAbortRef.current) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadBusy(true);
    setMessage("");
    try {
      for (const entry of entries) {
        if (controller.signal.aborted) break;
        if (entry.status === "published") continue;
        try {
          await uploadOne(entry, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) break;
          updateEntry(entry.id, { status: "error", error: messageFrom(error) });
        }
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      if (!controller.signal.aborted) setUploadBusy(false);
    }
  }

  return (
    <section className="photo-admin">
        <div className="blog-heading-row"><div><h1>Photographs</h1><p className="blog-muted">Upload photographs and prepare their titles, descriptions and ordering.</p></div><Link href="/" className="blog-button" onClick={confirmNavigation}>View photographs</Link></div>
        {message && <p role="alert" className="blog-notice blog-error">{message}</p>}
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="photo-upload-heading">Upload photographs</h2>
                <p className="mt-1 blog-muted">Signed in as {adminEmail}. JPG, PNG, or WebP; up to 500 MiB each.</p>
              </div>
              <label className="blog-button cursor-pointer focus-within:outline-2 focus-within:outline-offset-2">
                Add photos
                <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploadBusy} onChange={addFiles} />
              </label>
            </div>

            {entries.length === 0 ? (
              <p className="blog-empty">Choose photographs to prepare an upload.</p>
            ) : (
              <div className="space-y-5">
                {entries.map((entry) => (
                  <section key={entry.id} className="photo-upload-entry">
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <Image src={entry.previewUrl} alt="Selected photograph preview" width={160} height={120} unoptimized className="h-32 w-full object-cover sm:w-40" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="break-all font-semibold">{entry.file.name}</h3>
                            <p className="mt-1 blog-muted">{(entry.file.size / 1024 / 1024).toFixed(1)} MiB</p>
                          </div>
                          {!uploadBusy && entry.status !== "published" && <button type="button" onClick={() => removeEntry(entry)} className="text-sm underline underline-offset-4">Remove</button>}
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <label className="blog-field">Title <span className="blog-muted">optional</span>
                            <input disabled={uploadBusy || entry.status === "published"} maxLength={200} value={entry.title} onChange={(event) => updateEntry(entry.id, { title: event.target.value })} placeholder="Defaults to filename" />
                          </label>
                          <label className="blog-field">Capture date <span className="blog-muted">optional</span>
                            <input disabled={uploadBusy || entry.status === "published"} type="date" value={entry.capturedAt} onChange={(event) => updateEntry(entry.id, { capturedAt: event.target.value })} />
                          </label>
                          <label className="blog-field sm:col-span-2">Alt text <span className="blog-muted">optional</span>
                            <textarea disabled={uploadBusy || entry.status === "published"} maxLength={500} rows={2} value={entry.altText} onChange={(event) => updateEntry(entry.id, { altText: event.target.value })} placeholder="Describe the photograph for screen readers" />
                          </label>
                          <label className="blog-field">Sort order <span className="blog-muted">optional</span>
                            <input disabled={uploadBusy || entry.status === "published"} type="number" step="1" value={entry.sortOrder} onChange={(event) => updateEntry(entry.id, { sortOrder: event.target.value })} placeholder="Default ordering" />
                          </label>
                        </div>
                        <div className="mt-5 text-sm" aria-live="polite">
                          {entry.status === "ready" && <span>Ready to upload</span>}
                          {entry.status === "analysing" && <span>Preparing image sample…</span>}
                          {entry.status === "uploading" && <div><span>Uploading {entry.progress}%</span><progress max={100} value={entry.progress} className="mt-2 block h-2 w-full" /></div>}
                          {entry.status === "publishing" && <span>Publishing palette and photo details…</span>}
                          {entry.status === "published" && entry.href && <Link href={entry.href} className="font-medium underline underline-offset-4" onClick={confirmNavigation}>Published · View photograph</Link>}
                          {entry.status === "error" && <span className="photo-upload-error">{entry.error}</span>}
                        </div>
                      </div>
                    </div>
                  </section>
                ))}
                <button type="button" disabled={uploadBusy || entries.every((entry) => entry.status === "published")} onClick={() => { void uploadAll(); }} className="blog-button blog-button-primary">
                  {uploadBusy ? "Uploading…" : entries.some((entry) => entry.status === "error") ? "Retry remaining uploads" : "Upload and publish"}
                </button>
              </div>
            )}
          </div>
    </section>
  );
}
