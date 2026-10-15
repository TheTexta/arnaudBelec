"use client";

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

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

type Access = "checking" | "signed-out" | "authorised" | "denied" | "unconfigured";

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

class AdminApiError extends Error {
  constructor(message: string, public code: string | null) {
    super(message);
  }
}

async function imageSample(file: File): Promise<{ sample: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    if (width < 1 || height < 1 || width * height > MAXIMUM_INPUT_PIXELS) {
      throw new Error("The image dimensions are invalid or exceed the 120-million-pixel limit.");
    }
    const scale = Math.min(1, 96 / Math.max(width, height));
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
  const supabase = useMemo(() => SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null, []);
  const [access, setAccess] = useState<Access>(SUPABASE_URL && SUPABASE_ANON_KEY ? "checking" : "unconfigured");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [message, setMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const previewsRef = useRef<string[]>([]);
  const activeUploadRef = useRef<Upload | null>(null);
  const activeR2Ref = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    let verification = 0;
    const checkAccess = async () => {
      const currentVerification = ++verification;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted || currentVerification !== verification) return;
        if (!session) {
          setAccess("signed-out");
          setAdminEmail("");
          return;
        }
        const response = await fetch("/api/admin/session", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!mounted || currentVerification !== verification) return;
        if (!response.ok) {
          setAccess(response.status === 403 ? "denied" : response.status === 503 ? "unconfigured" : "signed-out");
          setMessage(result.error ?? "Could not verify this account.");
          return;
        }
        setAdminEmail(result.email ?? "");
        setAccess("authorised");
        setMessage("");
      } catch (error) {
        if (mounted && currentVerification === verification) {
          setAccess("signed-out");
          setMessage(messageFrom(error));
        }
      }
    };
    void checkAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      verification += 1;
      window.setTimeout(() => { void checkAccess(); }, 0);
    });
    return () => { mounted = false; verification += 1; subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => () => {
    void activeUploadRef.current?.abort();
    activeR2Ref.current?.abort();
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const updateEntry = (id: string, changes: Partial<UploadEntry>) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...changes } : entry));
  };

  async function adminRequest(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error("Your session has expired. Sign in again.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    const response = await fetch(path, { ...init, headers, cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AdminApiError(
        typeof result.error === "string" ? result.error : "The request failed.",
        typeof result.code === "string" ? result.code : null,
      );
    }
    return result;
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setPassword("");
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAccess("signed-out");
      setAdminEmail("");
      setMessage("");
    } catch (error) {
      setMessage(messageFrom(error));
    }
  }

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

  async function uploadOne(entry: UploadEntry) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase is not configured.");
    updateEntry(entry.id, { status: "analysing", progress: 0, error: null });
    const { sample, width, height } = await imageSample(entry.file);
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) throw new Error("Your session has expired. Sign in again.");
    const recoveryKey = `arnaud-r2-v1:${session.user.id}:${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`;
    let savedTicket: string | null = null;
    try { savedTicket = sessionStorage.getItem(recoveryKey); } catch { /* Storage may be unavailable. */ }
    const clearRecovery = () => { try { sessionStorage.removeItem(recoveryKey); } catch { /* Optional browser recovery. */ } };
    let ticket = entry.pendingTicket;
    let r2Ticket = entry.pendingTicket ? (entry.pendingProvider === "r2" ? entry.pendingTicket : null) : savedTicket;
    if (!ticket && r2Ticket) ticket = r2Ticket;
    if (r2Ticket) updateEntry(entry.id, { pendingTicket: r2Ticket, pendingProvider: "r2" });
    if (!ticket) {
      const prepared = await adminRequest("/api/admin/uploads/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: entry.file.name, size: entry.file.size }),
      });
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
            onProgress: (sent, total) => updateEntry(entry.id, { progress: Math.round(sent / total * 100) }),
            onError: (error) => { activeUploadRef.current = null; reject(error); },
            onSuccess: () => { activeUploadRef.current = null; resolve(); },
          });
          activeUploadRef.current = upload;
          upload.start();
        });
        ticket = prepared.ticket;
        updateEntry(entry.id, { pendingTicket: ticket, pendingProvider: "supabase" });
      }
    }

    if (r2Ticket) {
      updateEntry(entry.id, { status: "uploading" });
      const controller = new AbortController();
      activeR2Ref.current = controller;
      try {
        const { uploadR2File } = await import("@/lib/admin/r2-browser");
        await uploadR2File(entry.file, r2Ticket, adminRequest, progress => updateEntry(entry.id, { progress }), controller.signal);
      } catch (error) {
        if (error instanceof AdminApiError && error.code === "ticket_invalid") {
          clearRecovery();
          updateEntry(entry.id, { pendingTicket: null, pendingProvider: null });
        }
        throw error;
      } finally { activeR2Ref.current = null; }
    }

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
      published = await adminRequest("/api/admin/uploads/publish", { method: "POST", body: form });
    } catch (error) {
      if (error instanceof AdminApiError && ["ticket_invalid", "upload_missing", "upload_removed"].includes(error.code ?? "")) {
        updateEntry(entry.id, { pendingTicket: null, pendingProvider: null });
        clearRecovery();
      }
      throw error;
    }
    if (typeof published.href !== "string") throw new Error("The photograph was published, but no link was returned.");
    updateEntry(entry.id, { status: "published", href: published.href, error: null, pendingTicket: null, pendingProvider: null });
    clearRecovery();
  }

  async function uploadAll() {
    if (uploadBusy) return;
    setUploadBusy(true);
    setMessage("");
    try {
      for (const entry of entries) {
        if (entry.status === "published") continue;
        try {
          await uploadOne(entry);
        } catch (error) {
          updateEntry(entry.id, { status: "error", error: messageFrom(error) });
        }
      }
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-4 py-6 text-[#20201f] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4 border-b border-[#20201f]/20 pb-5">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.22em] uppercase">Arnaud Belec</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Photo admin</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="underline underline-offset-4">View photo section</Link>
            {access === "authorised" && <button type="button" disabled={uploadBusy} onClick={signOut} className="underline underline-offset-4 disabled:opacity-50">Sign out</button>}
          </div>
        </header>

        {message && <p role="alert" className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">{message}</p>}

        {access === "checking" && <p className="text-sm">Checking your session…</p>}
        {access === "unconfigured" && <p className="rounded-lg bg-white p-6 text-sm">Photo admin is not configured. Set the Supabase public URL, anon key, service role key, and admin user IDs.</p>}
        {access === "denied" && (
          <section className="rounded-lg bg-white p-6">
            <h2 className="text-xl font-semibold">Access unavailable</h2>
            <p className="mt-2 text-sm">This Supabase account is not on the photo admin allowlist.</p>
            <button type="button" onClick={signOut} className="mt-5 rounded-md bg-[#20201f] px-4 py-2 text-sm text-white">Sign out</button>
          </section>
        )}
        {access === "signed-out" && (
          <form onSubmit={signIn} className="max-w-md space-y-5 rounded-lg bg-white p-6 shadow-sm sm:p-8">
            <div>
              <h2 className="text-xl font-semibold">Sign in</h2>
              <p className="mt-1 text-sm text-[#20201f]/65">Use your photo admin Supabase account.</p>
            </div>
            <label className="block text-sm font-medium">Email
              <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-md border border-[#20201f]/25 bg-white px-3 py-2 outline-offset-2" />
            </label>
            <label className="block text-sm font-medium">Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-md border border-[#20201f]/25 bg-white px-3 py-2 outline-offset-2" />
            </label>
            <button disabled={authBusy} type="submit" className="rounded-md bg-[#20201f] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{authBusy ? "Signing in…" : "Sign in"}</button>
          </form>
        )}

        {access === "authorised" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Upload photographs</h2>
                <p className="mt-1 text-sm text-[#20201f]/65">Signed in as {adminEmail}. JPG, PNG, or WebP; up to 500 MiB each.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-md border border-[#20201f] px-4 py-2.5 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2">
                Add photos
                <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploadBusy} onChange={addFiles} />
              </label>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#20201f]/30 p-10 text-center text-sm text-[#20201f]/65">Choose photographs to prepare an upload.</p>
            ) : (
              <div className="space-y-5">
                {entries.map((entry) => (
                  <section key={entry.id} className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <Image src={entry.previewUrl} alt="Selected photograph preview" width={160} height={120} unoptimized className="h-32 w-full rounded object-cover sm:w-40" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="break-all font-semibold">{entry.file.name}</h3>
                            <p className="mt-1 text-xs text-[#20201f]/60">{(entry.file.size / 1024 / 1024).toFixed(1)} MiB</p>
                          </div>
                          {!uploadBusy && entry.status !== "published" && <button type="button" onClick={() => removeEntry(entry)} className="text-sm underline underline-offset-4">Remove</button>}
                        </div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <label className="text-sm font-medium">Title <span className="font-normal text-[#20201f]/55">optional</span>
                            <input disabled={uploadBusy || entry.status === "published"} maxLength={200} value={entry.title} onChange={(event) => updateEntry(entry.id, { title: event.target.value })} placeholder="Defaults to filename" className="mt-2 w-full rounded border border-[#20201f]/25 px-3 py-2 disabled:bg-[#f4f1eb]" />
                          </label>
                          <label className="text-sm font-medium">Capture date <span className="font-normal text-[#20201f]/55">optional</span>
                            <input disabled={uploadBusy || entry.status === "published"} type="date" value={entry.capturedAt} onChange={(event) => updateEntry(entry.id, { capturedAt: event.target.value })} className="mt-2 w-full rounded border border-[#20201f]/25 px-3 py-2 disabled:bg-[#f4f1eb]" />
                          </label>
                          <label className="text-sm font-medium sm:col-span-2">Alt text <span className="font-normal text-[#20201f]/55">optional</span>
                            <textarea disabled={uploadBusy || entry.status === "published"} maxLength={500} rows={2} value={entry.altText} onChange={(event) => updateEntry(entry.id, { altText: event.target.value })} placeholder="Describe the photograph for screen readers" className="mt-2 w-full rounded border border-[#20201f]/25 px-3 py-2 disabled:bg-[#f4f1eb]" />
                          </label>
                          <label className="text-sm font-medium">Sort order <span className="font-normal text-[#20201f]/55">optional</span>
                            <input disabled={uploadBusy || entry.status === "published"} type="number" step="1" value={entry.sortOrder} onChange={(event) => updateEntry(entry.id, { sortOrder: event.target.value })} placeholder="Default ordering" className="mt-2 w-full rounded border border-[#20201f]/25 px-3 py-2 disabled:bg-[#f4f1eb]" />
                          </label>
                        </div>
                        <div className="mt-5 text-sm" aria-live="polite">
                          {entry.status === "ready" && <span>Ready to upload</span>}
                          {entry.status === "analysing" && <span>Preparing image sample…</span>}
                          {entry.status === "uploading" && <div><span>Uploading {entry.progress}%</span><progress max={100} value={entry.progress} className="mt-2 block h-2 w-full" /></div>}
                          {entry.status === "publishing" && <span>Publishing palette and photo details…</span>}
                          {entry.status === "published" && entry.href && <Link href={entry.href} className="font-medium underline underline-offset-4">Published · View photograph</Link>}
                          {entry.status === "error" && <span className="text-rose-800">{entry.error}</span>}
                        </div>
                      </div>
                    </div>
                  </section>
                ))}
                <button type="button" disabled={uploadBusy || entries.every((entry) => entry.status === "published")} onClick={() => { void uploadAll(); }} className="rounded-md bg-[#20201f] px-6 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {uploadBusy ? "Uploading…" : entries.some((entry) => entry.status === "error") ? "Retry remaining uploads" : "Upload and publish"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
