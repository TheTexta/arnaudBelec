import type { SupabaseClient } from "@supabase/supabase-js";
import { r2Storage, PART_SIZE, validateParts, verifyPromotion } from "../photographs/storage.mjs";
import { storagePathFor, type UploadTicket } from "./upload-ticket";
import { validateFilename } from "./validation";
import { AdminRequestError } from "./server";

export async function reservationFor(service: SupabaseClient, ticket: UploadTicket) {
  if (ticket.provider !== "r2") throw new AdminRequestError("An R2 upload ticket is required.", 400);
  const { data, error } = await service.from("arnaud_upload_reservations").select("*").eq("id", ticket.photographId).single();
  if (error) throw error;
  if (!data || data.user_id !== ticket.userId || data.filename !== ticket.filename || data.size_bytes !== ticket.size || data.storage_path !== storagePathFor(ticket) || new Date(data.expires_at).getTime() !== ticket.expiresAt) {
    throw new AdminRequestError("The upload reservation does not match its ticket.", 409);
  }
  return data;
}

export async function prepareR2(service: SupabaseClient, ticket: UploadTicket) {
  const path = storagePathFor(ticket);
  const { format } = validateFilename(ticket.filename);
  const { error } = await service.from("arnaud_upload_reservations").insert({ id: ticket.photographId, user_id: ticket.userId, filename: ticket.filename, storage_path: path, size_bytes: ticket.size, content_type: format.contentType, expires_at: new Date(ticket.expiresAt).toISOString() });
  if (error) throw error;
  const multipartId = await r2Storage().create(path, format.contentType);
  const { error: updateError } = await service.from("arnaud_upload_reservations").update({ multipart_id: multipartId }).eq("id", ticket.photographId);
  if (updateError) throw updateError; // Orphan multipart uploads expire via R2 lifecycle.
  return { path, partSize: PART_SIZE };
}

type FinalizationStorage = Pick<ReturnType<typeof r2Storage>, "head" | "parts" | "complete" | "hash" | "promote">;

export async function verifyAndPromote(service: SupabaseClient, ticket: UploadTicket, storage: FinalizationStorage = r2Storage()) {
  const reservation = await reservationFor(service, ticket);
  const path = storagePathFor(ticket);
  if (reservation.state === "published") return;
  let source = await storage.head(path, true);
  if (!source) {
    if (!reservation.multipart_id) throw new AdminRequestError("The upload was not initialized. Select the file again.", 409, "ticket_invalid");
    const parts = await storage.parts(path, reservation.multipart_id);
    validateParts(parts, ticket.size);
    try { await storage.complete(path, reservation.multipart_id, parts); }
    catch (error) {
      // A concurrent request or lost response may have completed the same upload.
      if (!await storage.head(path, true)) throw error;
    }
    source = await storage.head(path, true);
  }
  const { format } = validateFilename(ticket.filename);
  // Completed multipart sources are immutable to outstanding part URLs. Never
  // delete published objects on error: SQL publication may have committed.
  const verified = await verifyPromotion(storage, path, ticket.size, format.contentType);
  const { error } = await service.from("arnaud_upload_reservations").update({ state: "verified", sha256: verified.sha256, published_etag: verified.etag }).eq("id", ticket.photographId).eq("state", "uploading");
  if (error) throw error;
}
