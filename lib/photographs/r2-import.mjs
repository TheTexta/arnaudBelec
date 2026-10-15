import { createHash } from "node:crypto";
import { r2Storage, verifyPromotion } from "./storage.mjs";

/** Stable retry identity for this exact CLI filename and original bytes. */
export function importId(filename, bytes) {
  const hash = createHash("sha256").update("arnaud-r2-import-v1\0").update(filename).update("\0").update(bytes).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function importR2Photograph(service, prepared) {
  const userId = process.env.SUPABASE_ADMIN_USER_IDS?.split(",")[0]?.trim();
  if (!userId || !/^[a-f0-9-]{36}$/i.test(userId)) throw new Error("Set SUPABASE_ADMIN_USER_IDS for the CLI upload journal actor.");
  const id = prepared.photographId;
  const path = prepared.storagePath;
  const { data: existing, error: readError } = await service.from("arnaud_upload_reservations").select("*").eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (existing?.state === "published") return;
  if (!existing) {
    const { error } = await service.from("arnaud_upload_reservations").insert({ id, user_id: userId, filename: prepared.filename, storage_path: path, size_bytes: prepared.buffer.length, content_type: prepared.format.contentType, expires_at: new Date(Date.now() + 86400000).toISOString() });
    if (error) throw error;
  } else if (new Date(existing.expires_at).getTime() < Date.now()) {
    throw new Error(`CLI reservation ${id} expired. Recovery objects were retained; reconcile before renewing it.`);
  }
  const storage = r2Storage();
  if (!await storage.head(path, true)) await storage.put(path, prepared.buffer, prepared.format.contentType, true);
  const expected = createHash("sha256").update(prepared.buffer).digest("hex");
  const source = await storage.hash(path, true);
  if (source.sha256 !== expected || source.size !== prepared.buffer.length) throw new Error("CLI staging bytes differ from the selected original.");
  const verified = await verifyPromotion(storage, path, prepared.buffer.length, prepared.format.contentType);
  const { error: verificationError } = await service.from("arnaud_upload_reservations").update({ state: "verified", sha256: verified.sha256, published_etag: verified.etag }).eq("id", id).eq("state", "uploading");
  if (verificationError) throw verificationError;
  const { error } = await service.rpc("arnaud_publish_r2_photograph", { p_reservation_id: id, p_metadata: prepared.rpcArguments });
  if (error) throw error; // Never remove a possibly published original on RPC failure.
  try { await storage.removeStaging(path); }
  catch { console.error(`Published ${id}; private staging cleanup remains pending.`); }
}
