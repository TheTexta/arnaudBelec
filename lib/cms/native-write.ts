import type { PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, type PayloadRequest } from "payload";

// Internal protocol only: hooks own locking SQL, request markers, validation and
// persistence. In particular, global restore is not collection restore.
export async function nativeTransaction(req: PayloadRequest, owner: "Journal" | "Site") {
  const id = await req.transactionID;
  const db = id ? req.payload.db.sessions?.[id]?.db : null;
  if (!db) throw new APIError(`${owner} writes require a database transaction.`, 503);
  return db as PostgresAdapter["drizzle"];
}

// Raw node-pg returns Payload numeric columns as strings. Decode locally rather
// than changing PostgreSQL parsers for the rest of the application.
export function nativeEditRevision(value: unknown, owner: "journal" | "content") {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new APIError(`The ${owner} revision is invalid.`, 503);
  return revision;
}

export function isStatusOnlyUnpublish(data: Record<string, unknown>) {
  return Object.keys(data).length === 1 && data._status === "draft";
}

export function isStaleNativeWrite(submitted: unknown, current: number, command: { restoring: boolean; statusOnly: boolean }) {
  return !command.restoring && !command.statusOnly && submitted !== current;
}

// Status-only Unpublish targets latest content without advancing its form token.
// Actual saves, Publish and deliberate historical Restore advance it.
export function nextNativeRevision(current: number, statusOnly: boolean | undefined) {
  return current + (statusOnly ? 0 : 1);
}
