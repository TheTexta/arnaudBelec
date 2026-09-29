import assert from "node:assert/strict";
import { test } from "node:test";
import { createUploadTicket, storagePathFor, verifyUploadTicket, type UploadTicket } from "./upload-ticket";
import { capturedDate, validateFilename, validateFileSize } from "./validation";

const adminId = "f10584f9-783c-4fa6-b296-e962cd09d33c";
const photoId = "2c3bb344-e162-4f3b-8fc9-bf7e2e254b91";
const signingSecret = "local-test-secret";

function ticket(overrides: Partial<UploadTicket> = {}): UploadTicket {
  return {
    photographId: photoId,
    filename: "20260929-portrait.jpeg",
    size: 1024,
    userId: adminId,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

test("a valid upload ticket binds the admin, file and canonical storage path", () => {
  const signed = createUploadTicket(ticket(), signingSecret);
  const verified = verifyUploadTicket(signed, signingSecret, adminId);
  assert.equal(verified.filename, "20260929-portrait.jpeg");
  assert.equal(storagePathFor(verified), `uploads/${photoId}.jpg`);
});

test("tampering, another account and expired tickets cannot publish", () => {
  const signed = createUploadTicket(ticket(), signingSecret);
  const [body, signature] = signed.split(".");
  const altered = Buffer.from(JSON.stringify(ticket({ filename: "other.jpg" }))).toString("base64url");
  assert.throws(() => verifyUploadTicket(`${altered}.${signature}`, signingSecret, adminId));
  assert.throws(() => verifyUploadTicket(`${body}.${signature}`, "another-secret", adminId));
  assert.throws(() => verifyUploadTicket(signed, signingSecret, photoId));
  assert.throws(() => verifyUploadTicket(createUploadTicket(ticket({ expiresAt: Date.now() - 1 }), signingSecret), signingSecret, adminId));
});

test("upload input rejects traversal, oversized files and invalid capture dates", () => {
  assert.throws(() => validateFilename("../portrait.jpg"));
  assert.throws(() => validateFilename("portrait.gif"));
  assert.throws(() => validateFileSize(524_288_001));
  assert.equal(capturedDate("", "20260929-portrait.jpg"), "2026-09-29");
  assert.throws(() => capturedDate("2026-02-30", "portrait.jpg"));
});
