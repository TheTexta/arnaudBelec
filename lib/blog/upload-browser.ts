import { validateMedia } from "./media";
type Request = (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;

export async function uploadBlogMedia(file: File, postId: string, userId: string, request: Request, progress: (message: string) => void, signal: AbortSignal) {
  validateMedia({ filename: file.name, size: file.size });
  const endpoint = `/api/admin/posts/${postId}/media`;
  const call = (input: Record<string, unknown>) => request(endpoint, { method: "POST", body: JSON.stringify(input), signal });
  const key = `arnaud-blog-upload-v1:${userId}:${postId}:${file.name}:${file.size}:${file.lastModified}`;
  let mediaId: string | null = null;
  try { mediaId = sessionStorage.getItem(key); } catch { /* Recovery is optional. */ }
  if (!mediaId) {
    progress(`Preparing ${file.name}…`);
    const prepared = await call({ action: "prepare", filename: file.name, size: file.size });
    if (typeof prepared.id !== "string") throw new Error("The upload could not be prepared.");
    mediaId = prepared.id;
    try { sessionStorage.setItem(key, mediaId); } catch { /* The server retains the reservation. */ }
  }
  let status;
  try { status = await call({ action: "parts", mediaId }); }
  catch (error) {
    if ((error as { status?: number }).status === 410) { try { sessionStorage.removeItem(key); } catch { /* Optional recovery. */ } }
    throw error;
  }
  if (!status.complete && !status.transferred) {
    if (typeof status.partSize !== "number" || status.partSize < 5 * 1024 * 1024 || !Array.isArray(status.parts)) throw new Error("Invalid upload response.");
    const completed = new Map((status.parts as { number: number; size: number }[]).map(part => [part.number, part.size]));
    for (let start = 0, number = 1; start < file.size; start += status.partSize, number++) {
      const body = file.slice(start, Math.min(start + status.partSize, file.size));
      if (completed.get(number) !== body.size) {
        const signed = await call({ action: "parts", mediaId, partNumber: number });
        if (signed.complete || signed.transferred) break;
        if (typeof signed.url !== "string") throw new Error("No upload URL was returned.");
        const response = await fetch(signed.url, { method: "PUT", body, signal, credentials: "omit", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error(`Upload failed (${response.status}). Select the same file again to resume.`);
        if (!response.headers.get("ETag")) throw new Error("R2 CORS must expose ETag. Select the same file again after configuration is corrected.");
      }
      progress(`Uploading ${file.name} · ${Math.round(Math.min(start + status.partSize, file.size) / file.size * 100)}%`);
    }
  }
  progress(`Verifying ${file.name}…`);
  const finished = await call({ action: "complete", mediaId });
  if (typeof finished.url !== "string") throw new Error("Media verification did not finish. Select the same file to retry.");
  // Keep the recovery pointer: selecting this exact file again reuses its verified
  // immutable object, including after a lost finalization response.
  return finished.url;
}
