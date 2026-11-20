"use client";

import Image from "next/image";
import Link from "next/link";
import { useAdminNavigationWarning, useSiteAdmin } from "./admin-access";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPhotographUploadController, type PhotographUpload, type UploadProgress } from "@/lib/admin/photograph-upload";
import { MIME_BY_EXTENSION, photographUploadBrowser } from "@/lib/admin/photograph-upload-browser";

type UploadEntry = PhotographUpload & {
  previewUrl: string;
};

const MAXIMUM_UPLOAD_BYTES = 500 * 1024 * 1024;

export default function AdminPanel() {
  const { userId, email: adminEmail, request: adminRequest, confirmNavigation } = useSiteAdmin();
  const [message, setMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const previewsRef = useRef<string[]>([]);
  const updateUpload = useCallback((id: string, changes: UploadProgress) => {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...changes } : entry));
  }, []);
  const uploads = useMemo(() => createPhotographUploadController({
    userId, request: adminRequest, update: updateUpload, adapter: photographUploadBrowser,
  }), [userId, adminRequest, updateUpload]);
  const uploadBusyRef = useRef(false);

  const hasPendingPhotos = uploadBusy || entries.some(entry => entry.status !== "published");
  useAdminNavigationWarning(hasPendingPhotos ? "Leave photographs? Active uploads will stop and the unsent photo queue will be cleared. Original files are unchanged." : null);

  useEffect(() => {
    if (!hasPendingPhotos) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasPendingPhotos]);

  useEffect(() => () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => () => uploads.cancel(), [uploads]);

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
        status: "ready", progress: 0, error: null, href: null, recovery: null,
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

  async function uploadAll() {
    if (uploadBusyRef.current) return;
    uploadBusyRef.current = true;
    setUploadBusy(true);
    setMessage("");
    try {
      await uploads.submit(entries);
    } finally {
      uploadBusyRef.current = false;
      setUploadBusy(false);
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
