import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reservationFor, verifyAndPromote } from "./r2-upload";
import type { UploadTicket } from "./upload-ticket";

const ticket: UploadTicket = { photographId: "12345678-1234-1234-1234-123456789abc", userId: "22345678-1234-1234-1234-123456789abc", filename: "test.jpg", size: 3, expiresAt: Date.now() + 60000, provider: "r2" };
const reservation = { id: ticket.photographId, user_id: ticket.userId, filename: ticket.filename, size_bytes: 3, storage_path: `uploads/${ticket.photographId}.jpg`, expires_at: new Date(ticket.expiresAt).toISOString(), multipart_id: "upload", state: "uploading" };

function serviceFor(row = reservation) {
  const updates: Record<string, unknown>[] = [];
  const query = {
    select: () => query, eq: () => query,
    single: async () => ({ data: row, error: null }),
    update: (value: Record<string, unknown>) => { updates.push(value); return query; },
  };
  return { service: { from: () => query } as unknown as SupabaseClient, updates };
}

test("reservation binds owner, exact file and canonical object to the signed ticket", async () => {
  const { service } = serviceFor();
  assert.equal((await reservationFor(service, ticket)).id, ticket.photographId);
  await assert.rejects(reservationFor(service, { ...ticket, userId: "other" }), /does not match/);
  await assert.rejects(reservationFor(service, { ...ticket, size: 4 }), /does not match/);
  await assert.rejects(reservationFor(service, { ...ticket, provider: "supabase" }), /R2 upload ticket/);
});

test("finalization verifies completed multipart bytes before updating the recovery journal", async () => {
  const { service, updates } = serviceFor();
  let complete = false, promoted = false;
  const storage = {
    head: async (_path: string, staging?: boolean) => staging ? complete ? { ETag: "source", ContentLength: 3, ContentType: "image/jpeg", $metadata: {} } : null : promoted ? { ETag: "destination", ContentLength: 3, ContentType: "image/jpeg", $metadata: {} } : null,
    parts: async () => [{ PartNumber: 1, Size: 3, ETag: "part" }],
    complete: async () => { complete = true; },
    hash: async () => ({ sha256: "a".repeat(64), size: 3 }),
    promote: async () => { promoted = true; },
  };
  await verifyAndPromote(service, ticket, storage);
  assert.equal(promoted, true);
  assert.deepEqual(updates, [{ state: "verified", sha256: "a".repeat(64), published_etag: "destination" }]);
});

test("failed storage verification leaves journal and recovery objects untouched", async () => {
  const { service, updates } = serviceFor();
  const metadata = { ETag: "etag", ContentLength: 3, ContentType: "image/jpeg", $metadata: {} };
  const storage = {
    head: async () => metadata, parts: async () => [], complete: async () => {}, promote: async () => assert.fail("Do not overwrite an existing original"),
    hash: async (_path: string, staging?: boolean) => ({ sha256: staging ? "source" : "different", size: 3 }),
  };
  await assert.rejects(verifyAndPromote(service, ticket, storage), /checksum verification failed/);
  assert.deepEqual(updates, []);
});
