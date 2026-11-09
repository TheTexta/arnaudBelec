import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { descriptions, document, journalBody, linkedParagraph } from "./editorial.mjs";
import { draftData, parsedSourceBundle, reconcileRegisteredReceipt, requireNoPendingReceipt, validateUploadScope, verifyDraftContent, verifyRecordedDraft } from "./upload.mjs";

test("Journal source order, text and repeated image placement are retained", () => {
  const page = { texts: [{ offset: 1, text: "Exact caption\nExact credit" }], images: [{ id: "a", offset: 2 }, { id: "a", offset: 3 }], links: [] };
  const body = journalBody(page, { a: "existing-media-id" });
  assert.deepEqual(body.root.children.map(node => node.type), ["paragraph", "paragraph", "upload", "upload"]);
  assert.equal(body.root.children[0].children[0].text, "Exact caption");
  assert.equal(body.root.children[2].value, "existing-media-id");
});

test("existing photograph is linked, not uploaded again or given a fake Media ID", () => {
  const body = journalBody({ texts: [], images: [{ id: "c9fb1ff3-758e-4cd2-8c64-2077ffafe054", offset: 1 }], links: [] }, {});
  assert.equal(body.root.children[0].children[0].fields.url, "https://arnaud-belec.vercel.app/photos/will%20in%20living.png");
  assert.equal(body.root.children.some(node => node.type === "upload"), false);
  assert.throws(() => journalBody({ texts: [], images: [{ id: "missing", offset: 1 }], links: [] }, {}));
});

test("source links reject executable schemes and embedded credentials", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://user:password@example.test/"]) assert.throws(() => linkedParagraph("Source", url));
});

test("project uses cover then gallery and only resolved native Media IDs", () => {
  const draft = { kind: "project", sourcePath: "/films", orderedAssets: ["a", "b"], filmAsset: "film", data: { title: "Exact title", slug: "exact-title", _status: "draft" } };
  assert.deepEqual(draftData(draft, { pages: [{ path: "/films" }] }, { a: "cover-id", b: "gallery-id", film: "film-id" }), { ...draft.data, cover: "cover-id", gallery: ["gallery-id"], film: "film-id" });
  assert.throws(() => draftData(draft, { pages: [{ path: "/films" }] }, {}));
});

test("publication and silently dropped native fields fail acceptance", () => {
  const expected = { title: "Title", slug: "title", _status: "draft", body: document([]) };
  verifyDraftContent(expected, { ...expected, firstPublishedAt: null });
  assert.throws(() => verifyDraftContent(expected, { ...expected, _status: "published" }));
  assert.throws(() => verifyDraftContent(expected, { ...expected, body: null }));
  assert.throws(() => verifyDraftContent(expected, { ...expected, firstPublishedAt: "2026-11-07" }));
  assert.equal(Object.keys(descriptions).length, 24);
});

test("a registered draft is re-fetched and re-accepted after interruption, never blindly skipped", async () => {
  const record = { collection: "posts", id: "draft-id" };
  const expected = { title: "Title", slug: "title", _status: "draft", body: document([]) };
  let reads = 0, anonymous = 0;
  const request = async path => { reads++; assert.match(path, /draft-id\?draft=true/); return { data: { ...expected, firstPublishedAt: null } }; };
  const denied = async () => { anonymous++; return new Response(null, { status: 404 }); };
  assert.deepEqual(await verifyRecordedDraft(record, expected, request, denied), { contentVerified: true, anonymousDenied: true });
  assert.equal(reads, 1); assert.equal(anonymous, 1);
  await assert.rejects(verifyRecordedDraft(record, expected, async () => ({ data: { ...expected, body: null } }), denied));
  await assert.rejects(verifyRecordedDraft(record, expected, request, async () => new Response("Visible", { status: 200 })));
});

test("registered receipt is reconciled before another signing; unknown receipts remain untouched", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode", "portfolio-receipt-replay-test-"));
  const path = join(directory, "pending-upload-receipt.private.json");
  const receipt = { filename: "file.jpg", size: 10, mimeType: "image/jpeg", clientUploadContext: { synthetic: true } };
  const expected = { assetId: "asset", bytes: 10, mimeType: "image/jpeg", sha256: "verified-source-hash" };
  const record = { assetId: "asset", filename: "file.jpg", id: "media-id", key: "journal-native/upload-id/file.jpg" };
  const request = async () => ({ data: { id: "media-id", filename: "file.jpg", verified: true, sha256: expected.sha256, filesize: 10, mimeType: expected.mimeType, uploadIdentity: "upload-id" } });
  try {
    await writeFile(path, JSON.stringify(receipt), { mode: 0o600 });
    await assert.rejects(requireNoPendingReceipt(directory), /Outstanding receipt/);
    await assert.rejects(reconcileRegisteredReceipt(directory, { media: [] }, { media: [expected] }, request), /Unregistered/);
    assert.equal(JSON.parse(await readFile(path, "utf8")).filename, "file.jpg");
    await reconcileRegisteredReceipt(directory, { media: [record] }, { media: [expected] }, request);
    await requireNoPendingReceipt(directory);
    await assert.rejects(readFile(path), { code: "ENOENT" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("reparsing frozen snapshots also replaces obsolete template-inclusive mapping placements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "opencode", "portfolio-visible-source-test-"));
  const id = "10000000-0000-4000-8000-000000000001";
  const image = `<img data-src="https://cdn.myportfolio.com/f5a01f46-fd9e-4866-9cc9-b9f5d38cd68e/${id}_rw_1920.jpg?h=synthetic">`;
  try {
    await writeFile(join(directory, "source.txt"), `<html><body><script type="text/html">${image}</script>${image}</body></html>`);
    const source = await parsedSourceBundle(directory, { pages: [{ path: "/fotos", snapshot: "source.txt", snapshotSha256: "fixture" }], assets: [{ id, placements: [
      { page: "/fotos", group: "street-photography", role: "content", order: 1 }, { page: "/fotos", group: "street-photography", role: "content", order: 2 },
    ] }] });
    assert.equal(source.pages[0].images.length, 1);
    assert.deepEqual(source.assets[0].placements, [{ page: "/fotos", group: "street-photography", order: 1, role: "content" }]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unassigned Media intake is library-only, bounded and unique; the original profile stays separate", () => {
  const plan = { scope: "unassigned-journal-media-only", drafts: [], media: [{ bundle: "images", group: "placement-review", sha256: "one" }, { bundle: "videos", group: "placement-review", sha256: "two" }] };
  validateUploadScope(plan);
  assert.throws(() => validateUploadScope({ ...plan, drafts: [{ collection: "posts" }] }));
  assert.throws(() => validateUploadScope({ ...plan, media: [...plan.media, plan.media[0]] }));
  assert.throws(() => validateUploadScope({ ...plan, media: [{ ...plan.media[0], group: "phassion" }] }));
  assert.throws(() => validateUploadScope({ ...plan, scope: undefined }));
});
