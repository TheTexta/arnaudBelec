import assert from "node:assert/strict";
import test from "node:test";
import type { PayloadRequest } from "payload";
import { nativeTransaction, nativeEditRevision, isStatusOnlyUnpublish, isStaleNativeWrite, nextNativeRevision } from "./native-write";

test("transaction acquisition awaits the request transaction and fails closed without its session", async () => {
  const db = {};
  const req = { transactionID: Promise.resolve("write"), payload: { db: { sessions: { write: { db } } } } } as unknown as PayloadRequest;
  assert.equal(await nativeTransaction(req, "Journal"), db);
  for (const owner of ["Journal", "Site"] as const) {
    await assert.rejects(nativeTransaction({ ...req, transactionID: undefined } as PayloadRequest, owner), { message: `${owner} writes require a database transaction.`, status: 503 });
    await assert.rejects(nativeTransaction({ ...req, transactionID: "missing" } as PayloadRequest, owner), { status: 503 });
  }
});

test("raw numeric revision decoding preserves validity limits and owner-specific errors", () => {
  assert.equal(nativeEditRevision("12", "journal"), 12);
  assert.equal(nativeEditRevision(0, "content"), 0);
  for (const owner of ["journal", "content"] as const) {
    for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, "invalid"]) {
      assert.throws(() => nativeEditRevision(value, owner), { message: `The ${owner} revision is invalid.`, status: 503 });
    }
  }
});

test("only exact status-only Unpublish bypasses stale content tokens without advancing them", () => {
  for (const data of [{}, { _status: "published" }, { _status: "draft", title: "changed" }, { _status: "draft", editRevision: 1 }]) assert.equal(isStatusOnlyUnpublish(data), false);
  const statusOnly = isStatusOnlyUnpublish({ _status: "draft" });
  assert.equal(statusOnly, true);
  assert.equal(isStaleNativeWrite(undefined, 5, { restoring: false, statusOnly }), false);
  assert.equal(nextNativeRevision(5, statusOnly), 5);
  assert.equal(isStaleNativeWrite(4, 5, { restoring: false, statusOnly: false }), true);
  assert.equal(isStaleNativeWrite("5", 5, { restoring: false, statusOnly: false }), true);
  assert.equal(isStaleNativeWrite(5, 5, { restoring: false, statusOnly: false }), false);
  assert.equal(isStaleNativeWrite(1, 5, { restoring: true, statusOnly: false }), false);
  assert.equal(nextNativeRevision(5, false), 6);
  assert.equal(nextNativeRevision(0, undefined), 1);
});
