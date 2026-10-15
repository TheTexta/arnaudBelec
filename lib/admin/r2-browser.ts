type AdminRequest = (path: string, init: RequestInit) => Promise<Record<string, unknown>>;

/** No R2 credentials enter the browser; only short-lived, single-part URLs. */
export async function uploadR2File(file: File, ticket: string, request: AdminRequest, progress: (percent: number) => void, signal: AbortSignal) {
  const call = (partNumber?: number) => request("/api/admin/uploads/parts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket, partNumber }), signal });
  const status = await call();
  if (status.complete) return;
  const partSize = status.partSize;
  if (typeof partSize !== "number" || partSize < 5 * 1024 * 1024 || !Array.isArray(status.parts)) throw new Error("Invalid multipart upload response.");
  const completed = new Map((status.parts as { number: number; size: number }[]).map(part => [part.number, part.size]));
  let sent = 0;
  for (let start = 0, number = 1; start < file.size; start += partSize, number++) {
    const body = file.slice(start, Math.min(start + partSize, file.size));
    if (completed.get(number) !== body.size) {
      const signed = await call(number);
      if (signed.complete) return;
      if (typeof signed.url !== "string") throw new Error("No upload URL was returned.");
      const response = await fetch(signed.url, { method: "PUT", body, signal, credentials: "omit" });
      if (!response.ok) throw new Error(`Upload part ${number} failed (${response.status}). Retry to resume.`);
      if (!response.headers.get("ETag")) throw new Error("R2 CORS must expose the upload ETag header.");
    }
    sent += body.size;
    progress(Math.round(sent / file.size * 100));
  }
}
