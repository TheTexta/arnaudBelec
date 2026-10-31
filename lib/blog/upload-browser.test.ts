import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadBlogMedia } from "./upload-browser";

async function withRecoveryStorage(run: (stored: Map<string, string>) => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  } });
  try { await run(stored); }
  finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
}

test("browser multipart uploads skip completed parts, verify completion, and return only stable media references", async () => {
  const originalFetch = globalThis.fetch;
  const size = 8 * 1024 * 1024;
  const file = new File([new Uint8Array(size + 5)], "film.mp4", { type: "video/mp4" });
  const calls: Record<string, unknown>[] = [];
  let transferred = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://r2.example.test/one-part");
    assert.equal((init?.body as Blob).size, 5);
    assert.equal(init?.credentials, "omit");
    transferred++;
    return new Response(null, { status: 200, headers: { ETag: "part" } });
  };
  try {
    const result = await uploadBlogMedia(file, "post", "user", async (_path, init) => {
      const input = JSON.parse(init?.body as string); calls.push(input);
      if (input.action === "prepare") return { id: "asset" };
      if (input.action === "complete") return { url: "/blog/media/asset" };
      if (input.partNumber) { assert.equal(input.partNumber, 2); return { url: "https://r2.example.test/one-part" }; }
      return { partSize: size, parts: [{ number: 1, size }] };
    }, () => {}, new AbortController().signal);
    assert.equal(result, "/blog/media/asset");
    assert.equal(transferred, 1);
    assert.equal(calls.at(-1)?.action, "complete");
  } finally { globalThis.fetch = originalFetch; }
});

test("a lost ETag response retains recovery and reselecting skips the server-verified part", async () => withRecoveryStorage(async stored => {
  const originalFetch = globalThis.fetch;
  const file = new File([Uint8Array.from([255, 216, 255, 0])], "photo.jpg", { type: "image/jpeg" });
  let preparations = 0;
  let transferred = false;
  let completions = 0;
  const request = async (_path: string, init?: RequestInit) => {
    const input = JSON.parse(init?.body as string);
    if (input.action === "prepare") { preparations++; return { id: "asset" }; }
    if (input.action === "complete") { completions++; return { url: "/blog/media/asset" }; }
    if (input.partNumber) return { url: "https://r2.example.test/part" };
    return { partSize: 8 * 1024 * 1024, parts: transferred ? [{ number: 1, size: file.size }] : [] };
  };
  globalThis.fetch = async () => { assert.equal(transferred, false); transferred = true; return new Response(null, { status: 200 }); };
  try {
    await assert.rejects(uploadBlogMedia(file, "post", "user", request, () => {}, new AbortController().signal), /CORS must expose ETag/);
    assert.equal(stored.size, 1);
    assert.equal(completions, 0);
    assert.equal(await uploadBlogMedia(file, "post", "user", request, () => {}, new AbortController().signal), "/blog/media/asset");
    assert.equal(preparations, 1);
    assert.equal(completions, 1);
  } finally { globalThis.fetch = originalFetch; }
}));

test("expired reservations clear their recovery pointer so the next attempt starts fresh", async () => withRecoveryStorage(async stored => {
  const file = new File(["RIFF0000WAVE"], "music.wav", { type: "audio/wav" });
  let preparations = 0;
  const request = async (_path: string, init?: RequestInit) => {
    const input = JSON.parse(init?.body as string);
    if (input.action === "prepare") { preparations++; return { id: `asset-${preparations}` }; }
    if (input.action === "parts" && preparations === 1) throw Object.assign(new Error("expired"), { status: 410 });
    return { complete: true, url: `/blog/media/asset-${preparations}` };
  };
  await assert.rejects(uploadBlogMedia(file, "post", "user", request, () => {}, new AbortController().signal), /expired/);
  assert.equal(stored.size, 0);
  assert.equal(await uploadBlogMedia(file, "post", "user", request, () => {}, new AbortController().signal), "/blog/media/asset-2");
  assert.equal(preparations, 2);
}));

test("cancelled transfers do not finalize a media reservation", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  const actions: string[] = [];
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.signal, controller.signal);
    controller.abort();
    throw new DOMException("Cancelled", "AbortError");
  };
  try {
    await assert.rejects(uploadBlogMedia(new File(["0000ftypisom"], "film.mp4"), "post", "user", async (_path, init) => {
      const input = JSON.parse(init?.body as string); actions.push(input.action);
      assert.equal(init?.signal, controller.signal);
      if (input.action === "prepare") return { id: "asset" };
      if (input.partNumber) return { url: "https://r2.example.test/part" };
      return { partSize: 8 * 1024 * 1024, parts: [] };
    }, () => {}, controller.signal), { name: "AbortError" });
    assert.equal(actions.includes("complete"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("unsupported files are rejected before upload requests", async () => {
  await assert.rejects(uploadBlogMedia(new File(["<svg/>"], "active.svg"), "post", "user", async () => assert.fail("No reservation for an unsupported file"), () => {}, new AbortController().signal), /SVG and HTML/);
});
