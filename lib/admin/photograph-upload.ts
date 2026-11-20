export type UploadRecovery = { provider: "supabase" | "r2"; ticket: string };
export type PhotographUpload = {
  id: string;
  file: File;
  title: string;
  altText: string;
  capturedAt: string;
  sortOrder: string;
  status: "ready" | "analysing" | "uploading" | "publishing" | "published" | "error";
  progress: number;
  error: string | null;
  href: string | null;
  recovery: UploadRecovery | null;
};
export type UploadProgress = Partial<Pick<PhotographUpload, "status" | "progress" | "error" | "href" | "recovery">>;
export type UploadRequest = (path: string, init: RequestInit) => Promise<Record<string, unknown>>;
type PreparedUpload = { path: string; ticket: string; token: string };
export type PhotographUploadAdapter = {
  sample: (file: File) => Promise<{ sample: Blob; width: number; height: number }>;
  supabase: (file: File, prepared: PreparedUpload, progress: (percent: number) => void, signal: AbortSignal) => Promise<void>;
  r2: (file: File, ticket: string, request: UploadRequest, progress: (percent: number) => void, signal: AbortSignal) => Promise<void>;
  recovery: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

function errorCode(error: unknown) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/** Owns batch ordering and recoverable transfer/publication, not editable form state. */
export function createPhotographUploadController({ userId, request, update, adapter }: {
  userId: string;
  request: UploadRequest;
  update: (id: string, progress: UploadProgress) => void;
  adapter: PhotographUploadAdapter;
}) {
  let active: AbortController | null = null;

  async function uploadOne(entry: PhotographUpload, signal: AbortSignal) {
    signal.throwIfAborted();
    const uploadRequest: UploadRequest = (path, init) => request(path, { ...init, signal });
    const progress = (percent: number) => { if (!signal.aborted) update(entry.id, { progress: percent }); };
    update(entry.id, { status: "analysing", progress: 0, error: null });
    const { sample, width, height } = await adapter.sample(entry.file);
    signal.throwIfAborted();
    const recoveryKey = `arnaud-r2-v1:${userId}:${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`;
    let savedTicket: string | null = null;
    try { savedTicket = adapter.recovery.getItem(recoveryKey); } catch { /* Storage may be unavailable. */ }
    const clearRecovery = () => { try { adapter.recovery.removeItem(recoveryKey); } catch { /* Optional browser recovery. */ } };
    let recovery = entry.recovery ?? (savedTicket ? { provider: "r2" as const, ticket: savedTicket } : null);
    if (recovery?.provider === "r2") update(entry.id, { recovery });
    if (!recovery) {
      const prepared = await uploadRequest("/api/admin/uploads/prepare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: entry.file.name, size: entry.file.size }),
      });
      signal.throwIfAborted();
      if (typeof prepared.path !== "string" || typeof prepared.ticket !== "string" || (prepared.provider !== "r2" && typeof prepared.token !== "string")) {
        throw new Error("The upload request returned incomplete data.");
      }
      update(entry.id, { status: "uploading" });
      if (prepared.provider === "r2") {
        recovery = { provider: "r2", ticket: prepared.ticket };
        update(entry.id, { recovery });
        try { adapter.recovery.setItem(recoveryKey, recovery.ticket); } catch { /* The server journal retains the reservation. */ }
      } else {
        await adapter.supabase(entry.file, { path: prepared.path, ticket: prepared.ticket, token: prepared.token as string }, progress, signal);
        signal.throwIfAborted();
        recovery = { provider: "supabase", ticket: prepared.ticket };
        update(entry.id, { recovery });
      }
    }
    if (recovery.provider === "r2") {
      update(entry.id, { status: "uploading" });
      try {
        await adapter.r2(entry.file, recovery.ticket, uploadRequest, progress, signal);
      } catch (error) {
        if (errorCode(error) === "ticket_invalid") {
          clearRecovery();
          update(entry.id, { recovery: null });
        }
        throw error;
      }
    }
    signal.throwIfAborted();
    update(entry.id, { status: "publishing", progress: 100 });
    const form = new FormData();
    form.set("ticket", recovery.ticket);
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
      if (["ticket_invalid", "upload_missing", "upload_removed"].includes(String(errorCode(error) ?? ""))) {
        update(entry.id, { recovery: null });
        clearRecovery();
      }
      throw error;
    }
    signal.throwIfAborted();
    if (typeof published.href !== "string") throw new Error("The photograph was published, but no link was returned.");
    update(entry.id, { status: "published", href: published.href, error: null, recovery: null });
    clearRecovery();
  }

  return {
    cancel() { active?.abort(); },
    async submit(entries: readonly PhotographUpload[]) {
      if (active) return;
      const controller = new AbortController();
      active = controller;
      try {
        for (const entry of entries) {
          if (controller.signal.aborted) break;
          if (entry.status === "published") continue;
          try { await uploadOne(entry, controller.signal); }
          catch (error) {
            if (controller.signal.aborted) break;
            update(entry.id, { status: "error", error: error instanceof Error ? error.message : "Something went wrong. Please try again." });
          }
        }
      } finally {
        active = null;
      }
    },
  };
}
