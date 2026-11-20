import assert from "node:assert/strict";
import test from "node:test";
import { createPhotographUploadController, type PhotographUpload, type PhotographUploadAdapter, type UploadRequest } from "./photograph-upload";
import { cmsRequest } from "../../components/cms/request";

function entry(id = "first"): PhotographUpload {
  return { id, file: new File(["image"], `${id}.jpg`, { type: "image/jpeg", lastModified: 123 }), title: "Original title", altText: "Description", capturedAt: "2026-11-19", sortOrder: "2", status: "ready", progress: 0, error: null, href: null, recovery: null };
}

function fixture(provider: "supabase" | "r2" = "supabase") {
  const entries = [entry(), entry("second")];
  const events: string[] = [];
  const saved = new Map<string, string>();
  const adapter: PhotographUploadAdapter = {
    async sample(file) { events.push(`sample:${file.name}`); return { sample: new Blob(["png"]), width: 20, height: 10 }; },
    async supabase(file, _prepared, progress) { events.push(`supabase:${file.name}`); progress(50); },
    async r2(file, _ticket, _request, progress) { events.push(`r2:${file.name}`); progress(50); },
    recovery: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); }, removeItem: key => { saved.delete(key); } },
  };
  let publish: UploadRequest = async (_path, init) => {
    const form = init.body as FormData;
    assert.equal(form.get("title"), entries[0].title);
    assert.equal(form.get("width"), "20");
    assert.equal(form.get("height"), "10");
    assert.ok(form.get("sample") instanceof Blob);
    return { href: "/photos/first.jpg" };
  };
  let prepare: UploadRequest = async () => ({ provider, path: "uploads/original.jpg", ticket: "ticket", token: "token" });
  const controller = createPhotographUploadController({
    userId: "user", adapter,
    request: async (path, init) => {
      events.push(path.endsWith("prepare") ? "prepare" : "publish");
      return path.endsWith("prepare") ? prepare(path, init) : publish(path, init);
    },
    update: (id, changes) => { Object.assign(entries.find(item => item.id === id)!, changes); },
  });
  return { entries, events, saved, adapter, controller, setPublish: (request: UploadRequest) => { publish = request; }, setPrepare: (request: UploadRequest) => { prepare = request; } };
}

test("cancel while preparation is pending prevents transfer, publication and later batch work", async () => {
  const f = fixture();
  const pending = Promise.withResolvers<Record<string, unknown>>();
  const preparing = Promise.withResolvers<void>();
  let signal: AbortSignal | null = null;
  f.setPrepare(async (_path, init) => { signal = init.signal as AbortSignal; preparing.resolve(); return pending.promise; });
  const batch = f.controller.submit(f.entries);
  await preparing.promise;
  await f.controller.submit(f.entries); // A second submit cannot start another batch.
  f.controller.cancel();
  assert.equal((signal as unknown as AbortSignal).aborted, true);
  // Even an adapter that resolves after cancellation cannot start further work.
  pending.resolve({ path: "original", ticket: "ticket", token: "token" });
  await batch;
  assert.deepEqual(f.events, ["sample:first.jpg", "prepare"]);
  assert.equal(f.entries[1].status, "ready");
});

test("cancel during sampling prevents preparation and remaining batch work", async () => {
  const f = fixture();
  const sample = Promise.withResolvers<{ sample: Blob; width: number; height: number }>();
  f.adapter.sample = async () => sample.promise;
  const batch = f.controller.submit(f.entries);
  f.controller.cancel();
  sample.resolve({ sample: new Blob(["png"]), width: 20, height: 10 });
  await batch;
  assert.deepEqual(f.events, []);
  assert.equal(f.entries[1].status, "ready");
});

test("cancel during accepted publication retains recovery and never starts another photograph", async () => {
  const f = fixture("r2");
  const response = Promise.withResolvers<Record<string, unknown>>();
  const publishing = Promise.withResolvers<void>();
  f.setPublish(async () => { publishing.resolve(); return response.promise; });
  const batch = f.controller.submit(f.entries);
  await publishing.promise;
  f.controller.cancel();
  // An accepted server publication can still commit; cancellation is not rollback.
  response.resolve({ href: "/photos/first.jpg" });
  await batch;
  assert.equal(f.entries[0].status, "publishing");
  assert.deepEqual(f.entries[0].recovery, { provider: "r2", ticket: "ticket" });
  assert.equal(f.entries[1].status, "ready");
  assert.ok(!f.events.includes("sample:second.jpg"));
});

for (const provider of ["supabase", "r2"] as const) {
  test(`${provider} response loss retains recovery, retries new metadata, and publishes only after transfer`, async () => {
    const f = fixture(provider);
    f.setPublish(async () => { throw new Error("response lost"); });
    await f.controller.submit([f.entries[0]]);
    assert.equal(f.entries[0].status, "error");
    assert.deepEqual(f.entries[0].recovery, { provider, ticket: "ticket" });
    assert.deepEqual(f.events, ["sample:first.jpg", "prepare", `${provider}:first.jpg`, "publish"]);
    f.entries[0].title = "Corrected title";
    f.setPublish(async (_path, init) => {
      assert.equal((init.body as FormData).get("title"), "Corrected title");
      assert.equal((init.body as FormData).get("ticket"), "ticket");
      return { href: "/photos/done.jpg" };
    });
    await f.controller.submit([f.entries[0]]);
    assert.equal(f.events.filter(event => event === "prepare").length, 1);
    assert.equal(f.events.filter(event => event === `${provider}:first.jpg`).length, provider === "supabase" ? 1 : 2);
    assert.equal(f.entries[0].status, "published");
    assert.equal(f.entries[0].recovery, null);
    assert.equal(f.saved.size, 0);
  });
}

test("R2 transfer failure retains the reservation, including session recovery after remount", async () => {
  const f = fixture("r2");
  f.adapter.r2 = async () => { throw new Error("part failed"); };
  await f.controller.submit([f.entries[0]]);
  assert.equal(f.saved.get("arnaud-r2-v1:user:first.jpg:5:123"), "ticket");
  f.entries[0].recovery = null;
  f.adapter.r2 = async (_file, ticket) => { assert.equal(ticket, "ticket"); };
  await f.controller.submit([f.entries[0]]);
  assert.equal(f.events.filter(event => event === "prepare").length, 1);
  assert.equal(f.entries[0].status, "published");
});

test("failed Supabase transfer prepares again rather than treating an incomplete object as recoverable", async () => {
  const f = fixture();
  f.adapter.supabase = async () => { throw new Error("transfer failed"); };
  await f.controller.submit([f.entries[0]]);
  assert.equal(f.entries[0].recovery, null);
  f.adapter.supabase = async () => {};
  await f.controller.submit([f.entries[0]]);
  assert.equal(f.events.filter(event => event === "prepare").length, 2);
});

test("missing publication href remains ambiguous success and retains the ticket", async () => {
  const f = fixture();
  f.setPublish(async () => ({}));
  await f.controller.submit([f.entries[0]]);
  assert.match(f.entries[0].error!, /published, but no link/);
  assert.deepEqual(f.entries[0].recovery, { provider: "supabase", ticket: "ticket" });
});

for (const code of ["ticket_invalid", "upload_missing", "upload_removed"]) {
  test(`${code} publication rejection clears both recovery representations`, async () => {
    const f = fixture("r2");
    f.setPublish(async () => { throw Object.assign(new Error("rejected"), { code }); });
    await f.controller.submit([f.entries[0]]);
    assert.equal(f.entries[0].recovery, null);
    assert.equal(f.saved.size, 0);
    assert.equal(f.entries[0].status, "error");
  });
}

test("invalid R2 transfer ticket clears recovery and a retry obtains a fresh preparation", async () => {
  const f = fixture("r2");
  f.adapter.r2 = async () => { throw Object.assign(new Error("expired"), { code: "ticket_invalid" }); };
  await f.controller.submit([f.entries[0]]);
  assert.equal(f.entries[0].recovery, null);
  assert.equal(f.saved.size, 0);
  assert.ok(!f.events.includes("publish"));
  f.adapter.r2 = async () => {};
  await f.controller.submit([f.entries[0]]);
  assert.equal(f.events.filter(event => event === "prepare").length, 2);
});

test("incomplete preparation never transfers or publishes; omitted provider remains Supabase", async () => {
  for (const prepared of [{ ticket: "ticket", token: "token" }, { path: "original", ticket: "ticket" }]) {
    const f = fixture();
    f.setPrepare(async () => prepared);
    await f.controller.submit([f.entries[0]]);
    assert.match(f.entries[0].error!, /incomplete data/);
    assert.deepEqual(f.events, ["sample:first.jpg", "prepare"]);
  }
  const f = fixture();
  f.setPrepare(async () => ({ path: "original", ticket: "ticket", token: "token" }));
  await f.controller.submit([f.entries[0]]);
  assert.ok(f.events.includes("supabase:first.jpg"));
});

test("Payload request adapter preserves invalid-ticket codes for the shared controller", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.credentials, "same-origin");
    return Response.json({ error: "Expired upload", code: "ticket_invalid" }, { status: 400 });
  };
  try {
    await assert.rejects(cmsRequest("/api/admin/uploads/parts"), { message: "Expired upload", status: 400, code: "ticket_invalid" });
  } finally { globalThis.fetch = original; }
});
