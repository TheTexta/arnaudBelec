import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import type { UploadOptions } from "tus-js-client";

type TusFixture = { file?: File; options?: UploadOptions; started: number; aborted: number };
const tus: TusFixture = { started: 0, aborted: 0 };
Object.assign(globalThis, { __photographTus: tus });
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "tus-js-client") return {
      url: `data:text/javascript,${encodeURIComponent(`export class Upload {
        constructor(file, options) { globalThis.__photographTus.file = file; globalThis.__photographTus.options = options; }
        start() { globalThis.__photographTus.started++; }
        async abort() { globalThis.__photographTus.aborted++; }
      }`)}`,
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://storage.example.test/";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
const { photographUploadBrowser: adapter } = await import("./photograph-upload-browser");
hooks.deregister();

test("browser sampling preserves oriented dimensions, bounded PNG and bitmap cleanup", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let closed = 0;
  let width = 4000;
  let height = 3000;
  const bitmap = { get width() { return width; }, get height() { return height; }, close() { closed++; } };
  const canvas = { width: 0, height: 0,
    getContext(kind: string, options: unknown) {
      assert.equal(kind, "2d");
      assert.deepEqual(options, { willReadFrequently: true });
      return { drawImage(image: unknown, ...rect: number[]) { assert.equal(image, bitmap); assert.deepEqual(rect, [0, 0, canvas.width, canvas.height]); } };
    },
    toBlob(callback: (blob: Blob) => void, type: string) { assert.equal(type, "image/png"); callback(new Blob(["png"], { type })); },
  };
  globalThis.createImageBitmap = (async (_file, options) => {
    assert.deepEqual(options, { imageOrientation: "from-image" });
    return bitmap;
  }) as typeof createImageBitmap;
  globalThis.document = { createElement: (tag: string) => { assert.equal(tag, "canvas"); return canvas; } } as unknown as Document;
  try {
    const file = new File(["original"], "photo.jpg");
    const result = await adapter.sample(file);
    assert.equal(result.width, 4000);
    assert.equal(result.height, 3000);
    assert.equal(result.sample.type, "image/png");
    assert.deepEqual([canvas.width, canvas.height], [256, 192]);
    assert.equal(closed, 1);
    width = 32; height = 16;
    await adapter.sample(file);
    assert.deepEqual([canvas.width, canvas.height], [32, 16]);
    width = 120_000_001; height = 1;
    await assert.rejects(adapter.sample(file), /120-million-pixel/);
    assert.equal(closed, 3);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});

test("Supabase transfer preserves signed TUS settings, progress and abort cleanup", async () => {
  const file = new File(["original"], "photo.webp");
  const controller = new AbortController();
  const percentages: number[] = [];
  const transferred = adapter.supabase(file, { path: "uploads/fixture.webp", ticket: "ticket", token: "signed-token" }, percent => percentages.push(percent), controller.signal);
  assert.equal(tus.file, file);
  const options = tus.options!;
  assert.equal(options.endpoint, "https://storage.example.test/storage/v1/upload/resumable");
  assert.deepEqual(options.headers, { apikey: "fixture-only", "x-signature": "signed-token" });
  assert.deepEqual(options.metadata, { bucketName: "arnaudbelec", objectName: "uploads/fixture.webp", contentType: "image/webp", cacheControl: "31536000" });
  assert.equal(options.chunkSize, 6 * 1024 * 1024);
  assert.deepEqual(options.retryDelays, [0, 3000, 5000, 10000, 20000]);
  assert.equal(options.uploadDataDuringCreation, true);
  assert.equal(options.storeFingerprintForResuming, false);
  options.onProgress!(1, 4);
  assert.deepEqual(percentages, [25]);
  controller.abort();
  await assert.rejects(transferred, { name: "AbortError" });
  assert.equal(tus.aborted, 1);

  const complete = new AbortController();
  const success = adapter.supabase(file, { path: "original", token: "token", ticket: "ticket" }, () => {}, complete.signal);
  tus.options!.onSuccess!({} as Parameters<NonNullable<UploadOptions["onSuccess"]>>[0]);
  await success;
  complete.abort();
  assert.equal(tus.aborted, 1, "successful transfer removes its abort listener");
});
