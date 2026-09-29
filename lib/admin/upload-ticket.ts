import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { validateFileSize, validateFilename } from "./validation";

export type UploadTicket = {
  photographId: string;
  filename: string;
  size: number;
  userId: string;
  expiresAt: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signingKey(serviceRoleKey: string): Buffer {
  return createHash("sha256").update("arnaud-admin-upload-ticket-v1\0").update(serviceRoleKey).digest();
}

function signature(body: string, serviceRoleKey: string): Buffer {
  return createHmac("sha256", signingKey(serviceRoleKey)).update(body).digest();
}

export function createUploadTicket(ticket: UploadTicket, serviceRoleKey: string): string {
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${body}.${signature(body, serviceRoleKey).toString("base64url")}`;
}

export function verifyUploadTicket(value: unknown, serviceRoleKey: string, userId: string): UploadTicket {
  if (typeof value !== "string" || value.length > 4096) throw new Error("The upload ticket is invalid.");
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("The upload ticket is invalid.");
  const [body, suppliedSignature] = parts;
  const expectedSignature = signature(body, serviceRoleKey);
  const actualSignature = Buffer.from(suppliedSignature, "base64url");
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new Error("The upload ticket is invalid.");
  }

  let ticket: UploadTicket;
  try {
    ticket = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new Error("The upload ticket is invalid.");
  }
  if (!ticket || typeof ticket !== "object" || !UUID.test(ticket.photographId)
    || !UUID.test(ticket.userId) || ticket.userId !== userId
    || !Number.isInteger(ticket.expiresAt) || ticket.expiresAt < Date.now()) {
    throw new Error("The upload ticket is invalid or expired.");
  }
  validateFilename(ticket.filename);
  validateFileSize(ticket.size);
  return ticket;
}

export function storagePathFor(ticket: Pick<UploadTicket, "photographId" | "filename">): string {
  const { format } = validateFilename(ticket.filename);
  if (!UUID.test(ticket.photographId)) throw new Error("Invalid photograph ID.");
  return `uploads/${ticket.photographId}.${format.extension}`;
}
