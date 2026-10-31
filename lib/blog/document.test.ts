import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import BlogContent from "../../app/blog/content";
import { assertPublishable, documentMedia, EMPTY_BODY, safeLink, validateBody, validateDocument } from "./document";
import { matchesMediaType, validateMedia } from "./media";

const id = "12345678-1234-1234-1234-123456789abc";
const doc = { title: "First post", slug: "first-post", excerpt: "A short note.", body: EMPTY_BODY };

test("document validation preserves supported block data without carrying arbitrary HTML or code", () => {
  const body = validateBody([{ id: "text", type: "paragraph", props: {}, content: [{ type: "text", text: "<script>alert(1)</script>", styles: { bold: true } }], children: [] }]);
  assert.equal(body[0].content?.[0].type, "text");
  const html = renderToStaticMarkup(createElement(BlogContent, { body }));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.throws(() => validateBody([{ ...EMPTY_BODY[0], type: "html" }]), /not supported/);
  assert.throws(() => validateBody([{ ...EMPTY_BODY[0], content: [{ type: "text", text: "x", styles: { onClick: "evil" } }] }]), /formatting/);
});

test("links exclude executable, protocol-relative, whitespace and encoded control schemes", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "/\\evil.test", " javaScript:x", "java\nscript:x"]) assert.equal(safeLink(url), false, url);
  for (const url of ["https://example.test/a", "http://example.test", "mailto:a@example.test", "/blog/post", "#section"]) assert.equal(safeLink(url), true, url);
  assert.throws(() => validateBody([{ ...EMPTY_BODY[0], content: [{ type: "link", href: "javascript:x", content: [] }] }]), /valid http/);
});

test("drafts allow empty media, publication requires finished media and descriptive image captions", () => {
  const empty = validateBody([{ id: "photo", type: "image", props: { url: "" }, children: [] }]);
  assert.throws(() => assertPublishable(empty), /empty media/);
  assert.throws(() => assertPublishable(EMPTY_BODY), /Write something/);
  const body = validateBody([{ id: "photo", type: "image", props: { url: `/blog/media/${id}`, caption: "A red coat hanging in a doorway" }, children: [] }]);
  assertPublishable(body);
  assert.deepEqual(documentMedia(body), [{ id, type: "image" }]);
  assert.throws(() => assertPublishable([{ ...body[0], props: { url: `/blog/media/${id}` } }]), /caption/);
  assert.throws(() => validateBody([{ ...body[0], props: { url: "https://external.test/x.jpg" } }]), /Upload media/);
});

test("document limits, duplicate IDs and reserved slugs are rejected", () => {
  assert.deepEqual(validateDocument(doc), doc);
  for (const slug of ["media", "../post", "Post", "a--b", "a/b"]) assert.throws(() => validateDocument({ ...doc, slug }), /URL name/);
  assert.throws(() => validateBody([EMPTY_BODY[0], EMPTY_BODY[0]]), /duplicate/);
  assert.throws(() => validateBody(Array.from({ length: 501 }, (_, i) => ({ ...EMPTY_BODY[0], id: `block-${i}` }))), /500 blocks/);
});

test("upload validation rejects active formats, oversize inputs, and mismatched magic bytes", () => {
  assert.equal(validateMedia({ filename: "photo.jpeg", size: 123 }).contentType, "image/jpeg");
  for (const filename of ["a.svg", "a.html", "../a.jpg", "a.gif", "a\u0000.jpg"]) assert.throws(() => validateMedia({ filename, size: 1 }));
  for (const size of [0, -1, 1.1, 104857601]) assert.throws(() => validateMedia({ filename: "a.jpg", size }));
  assert.equal(matchesMediaType(Buffer.from("<svg>"), "image/jpeg"), false);
  assert.equal(matchesMediaType(Uint8Array.from([255, 216, 255, 0]), "image/jpeg"), true);
  assert.equal(matchesMediaType(Buffer.from("RIFF0000WAVE"), "audio/wav"), true);
  assert.equal(matchesMediaType(Buffer.from("0000ftypisom"), "video/mp4"), true);
});
