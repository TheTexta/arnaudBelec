import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadR2File } from "./r2-browser";
import { PART_SIZE } from "../photographs/storage.mjs";

test("browser resume skips verified parts and signs only remaining parts", async () => {
  const originalFetch = globalThis.fetch;
  const calls: number[] = [];
  const uploads: number[] = [];
  const progress: number[] = [];
  const file = new File([new Uint8Array(PART_SIZE + 1)], "test.jpg");
  globalThis.fetch = async (_url, init) => {
    uploads.push((init?.body as Blob).size);
    return new Response(null, { headers: { ETag: "two" } });
  };
  try {
    await uploadR2File(file, "signed-ticket", async (_path, init) => {
      const input = JSON.parse(init.body as string);
      assert.equal(input.ticket, "signed-ticket");
      if (!input.partNumber) return { partSize: PART_SIZE, parts: [{ number: 1, size: PART_SIZE }] };
      calls.push(input.partNumber);
      return { url: "https://test.r2.cloudflarestorage.com/part" };
    }, value => progress.push(value), new AbortController().signal);
    assert.deepEqual(calls, [2]);
    assert.deepEqual(uploads, [1]);
    assert.equal(progress.at(-1), 100);
  } finally { globalThis.fetch = originalFetch; }
});

test("completed upload recovery never retransfers originals", async () => {
  await uploadR2File(new File(["bytes"], "test.jpg"), "ticket", async () => ({ complete: true }), () => assert.fail("No transfer expected"), new AbortController().signal);
});

test("a failed part remains retryable and missing CORS ETag is reported", async () => {
  const originalFetch = globalThis.fetch;
  const request = async (_path: string, init: RequestInit) => JSON.parse(init.body as string).partNumber ? { url: "https://example.test/part" } : { partSize: PART_SIZE, parts: [] };
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(uploadR2File(new File(["bytes"], "test.jpg"), "ticket", request, () => {}, new AbortController().signal), /Retry to resume/);
    globalThis.fetch = async () => new Response(null);
    await assert.rejects(uploadR2File(new File(["bytes"], "test.jpg"), "ticket", request, () => {}, new AbortController().signal), /CORS/);
  } finally { globalThis.fetch = originalFetch; }
});
