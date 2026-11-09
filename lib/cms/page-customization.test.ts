import assert from "node:assert/strict";
import { test } from "node:test";
import type { PayloadRequest } from "payload";
import { mergePagePalette, validatePagePalette } from "./page-palette";
import { projectMediaUses } from "./projects";
import { mergeVideoPage, validateVideoPage } from "./video-page";

const id = "12345678-1234-4234-8234-123456789abc";
test("page palettes preserve sibling atmosphere colours and reject incomplete custom publication", () => {
  const palette = { mode: "custom", background: "#112233", colourA: "#AABBCC", colourB: "#445566", accent: "#778899" };
  assert.equal(validatePagePalette(palette), true);
  assert.equal(validatePagePalette({ mode: "inherit", accent: "bad" }), true);
  assert.notEqual(validatePagePalette({ ...palette, colourA: "red" }), true);
  assert.notEqual(validatePagePalette({ mode: "custom" }), true);
  assert.deepEqual(mergePagePalette(palette, { accent: "#ffffff" }), { ...palette, accent: "#ffffff" });
  assert.equal(mergePagePalette(palette, null), null);
});

test("only the active uploaded primary grants film access; body/gallery references remain independent", () => {
  assert.deepEqual(projectMediaUses({ film: id }, "videos"), [{ id, kind: "video" }]);
  for (const videoSource of ["youtube", "none"]) {
    assert.deepEqual(projectMediaUses({ film: id, videoSource }, "videos"), []);
    assert.deepEqual(projectMediaUses({ film: id, videoSource, gallery: [id], body: { root: { type: "root", children: [{ type: "upload", relationTo: "media", value: id }] } } }, "videos"), [{ id, kind: "image" }, { id }]);
  }
  assert.deepEqual(projectMediaUses({ film: id, videoSource: "none" }, "fashion-projects"), [{ id, kind: "video" }]);
});

test("Video landing publication bounds text/order and resolves only current published documents", async () => {
  let ids = [id];
  const req = { payload: { find: async (options: Record<string, unknown>) => {
    assert.equal(options.draft, false);
    assert.equal(options.overrideAccess, false);
    assert.equal(options.depth, 0);
    assert.deepEqual(options.where, { and: [{ id: { in: [id] } }, { _status: { equals: "published" } }] });
    return { docs: ids.map(id => ({ id })) };
  } } } as unknown as PayloadRequest;
  const page = { heading: "Films", intro: "Introduction", featuredVideo: id, orderedVideos: [{ video: id }] };
  await validateVideoPage(page, req);
  assert.deepEqual(mergeVideoPage(page, { heading: "New heading" }), { ...page, heading: "New heading" });
  for (const invalid of [
    { heading: "x".repeat(201) }, { intro: "x".repeat(5001) },
    { orderedVideos: Array.from({ length: 101 }, () => ({ video: id })) },
    { orderedVideos: [{ video: id }, { video: id }] }, { orderedVideos: [{}] },
    { featuredVideo: "missing" },
  ]) await assert.rejects(validateVideoPage(invalid, req));
  ids = [];
  await assert.rejects(validateVideoPage(page, req), /currently be published/);
});
