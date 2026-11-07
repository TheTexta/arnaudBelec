import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import sharp from "sharp";
import { adobeUrl, bestRendition, cssImages, hlsSegments, hlsVariant, imageId, origin, ownerPath, parsePage, parsePlayer, parseSitemap, text } from "./source.mjs";
import { groupForImage } from "./mapping.mjs";
import { createOutput, distance, draftMappings, prepare, verifyBundle } from "./prepare.mjs";

const id = "cc0f7f99-9ead-426a-b26a-8a3d38878801";
const cdn = `https://cdn.myportfolio.com${ownerPath}`;
const image = (asset = id) => `<img src="data:image/gif;base64,placeholder" data-src="${cdn}${asset}_rw_1920.jpg?h=published" data-srcset="${cdn}${asset}_rw_600.jpg?h=small 600w,${cdn}${asset}_rw_3840.jpg?h=large 3840w," alt="Source &amp; description">`;
const page = body => `<html><head><title>Source &amp; title</title><meta property="og:image" content="${cdn}${id}_car_1x1.jpg?h=cover"><link rel="icon" href="${cdn}${id}_carw_1x1x32.jpg?h=icon"></head><body>${body}</body></html>`;

test("reads lazy/srcset images and nested text without counting meta images/icons/placeholders", () => {
  const parsed = parsePage(page(`<div class="rich-text js-text"><div>Exact title<br>Exact credit &amp; text</div><p>Second paragraph</p></div>${image()}`), "/fotos");
  assert.equal(parsed.images.length, 1);
  assert.equal(parsed.images[0].id, id);
  assert.match(parsed.images[0].previewUrl, /_rw_600/);
  assert.equal(parsed.images[0].alt, "Source & description");
  assert.equal(parsed.texts[0].text, "Exact title\nExact credit & text\nSecond paragraph");
  assert.match(bestRendition(parsed.images[0].urls), /_rw_3840/);
});

test("supports non-lazy images and advertised crop output widths", () => {
  assert.equal(parsePage(page(`<img src='${cdn}${id}_rw_1200.jpg?h=test'>`), "/contact").images.length, 1);
  const full = `${cdn}${id}_rwc_80x0x480x480x2048.JPG?h=test`;
  assert.equal(bestRendition([`${cdn}${id}_rw_1920.JPG?h=test`, full]), full);
});

test("retains lightbox URLs as evidence without claiming camera-original quality", () => {
  const parsed = parsePage(page(`<div class="js-lightbox" data-src="${cdn}${id}.jpg?h=public">${image()}</div>`), "/films");
  assert.equal(parsed.images[0].lightboxUrl, `${cdn}${id}.jpg?h=public`);
});

test("refuses foreign image owners, credentials, protocols and mixed-asset srcsets", () => {
  for (const url of [`http://cdn.myportfolio.com${ownerPath}${id}.jpg`, `https://user:password@cdn.myportfolio.com${ownerPath}${id}.jpg`, `https://example.test${ownerPath}${id}.jpg`, `https://cdn.myportfolio.com/other/${id}.jpg`]) assert.throws(() => imageId(url));
  assert.throws(() => parsePage(page(image().replace(`${id}_rw_600`, "31e4123d-0aa3-479c-824e-48beb4346b39_rw_600")), "/fotos"));
});

test("records YouTube, Adobe embed and background-video identities without executing scripts", () => {
  const parsed = parsePage(page('<iframe src="https://www.youtube.com/embed/R7oFdBKswIo?si=public"></iframe><iframe src="https://www-ccv.adobe.io/v1/player/ccv/An-nBB7Dn58/embed?api_key=BehancePro2View"></iframe><video><source src="https://cdn.myportfolio.com/v1/ccvproxy/SKLNuiF_ct9?width=5120&amp;type=mp4"></video><script>throw new Error("Do not execute")</script>'), "/films");
  assert.deepEqual(parsed.youtube, ["R7oFdBKswIo"]);
  assert.deepEqual(parsed.adobe, ["SKLNuiF_ct9", "An-nBB7Dn58"]);
  assert.throws(() => parsePage(page('<iframe src="https://unreviewed.test/embed"></iframe>'), "/films"));
});

test("password-protected pages remain protected and text decoding is inert", () => {
  assert.equal(parsePage(page("Locked").replace("Source &amp; title", "Password Protected Page"), "/sporadic-thread").protected, true);
  assert.equal(text("<script>ignored()</script><p>Credit &#233; &#xE9; &#99999999;</p>"), "Credit é é �");
  const protectedPage = parsePage('<html><head><title>Password Protected Page</title></head><div><input type="password"></div><script>ignored()</script></html>', "/sporadic-thread");
  assert.equal(protectedPage.protected, true);
  assert.deepEqual(protectedPage.images, []);
  assert.deepEqual(protectedPage.links, []);
});

test("sitemap discovery is restricted to the source origin and bounded", () => {
  assert.deepEqual(parseSitemap(`<urlset><loc>${origin}/films</loc><loc>${origin}/films</loc></urlset>`), ["/films"]);
  for (const value of ["https://example.test/films", `${origin}/films?private=1`, `${origin}/films#fragment`, `https://user:password@arnaudnaudbel.myportfolio.com/films`]) assert.throws(() => parseSitemap(`<loc>${value}</loc>`));
  assert.throws(() => parseSitemap(Array.from({ length: 61 }, (_, i) => `<loc>${origin}/page-${i}</loc>`).join("")));
});

test("extracts CSS background media only, not fonts or arbitrary URLs", () => {
  assert.deepEqual(cssImages(`body{background:url('${cdn}${id}_rw_1920.jpg?h=public')} @font-face{src:url(font.woff2)}`), [{ id, url: `${cdn}${id}_rw_1920.jpg?h=public` }]);
  assert.throws(() => cssImages("body{background:url(https://example.test/image.png)}"));
});

test("fashion sections remain separate, and theatre photography is not assigned design credit", () => {
  const parsed = parsePage(page(`<div class="rich-text">Circle of Fashion, exact credit.</div>${image()}<div class="rich-text">PHASSION, different credit.</div>${image("31e4123d-0aa3-479c-824e-48beb4346b39")}`), "/copie-de-sewing");
  assert.deepEqual(parsed.images.map(item => groupForImage(parsed, item)), ["circle-of-fashion", "phassion"]);
  assert.equal(groupForImage({ path: "/sewing-catherine-request" }, {}), "theatre-costuming");
  assert.throws(() => groupForImage({ path: "/copie-de-sewing", texts: [] }, {}));
});

test("HLS resolves only scoped Adobe rendition paths and inherits the public player's query", () => {
  const parent = "https://cdn-prod-ccv.adobe.com/clip/rend/master.m3u8?hdnts=public-player-capability";
  const best = hlsVariant("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1280x720\nhls_720/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2,RESOLUTION=1920x1080\nhls_1080/index.m3u8\n", parent, "clip");
  assert.equal(best.height, 1080);
  assert.equal(new URL(best.url).search, new URL(parent).search);
  assert.deepEqual(hlsSegments("#EXTM3U\n#EXTINF:6,\nindex0.ts\n#EXT-X-ENDLIST\n", best.url, "clip"), ["https://cdn-prod-ccv.adobe.com/clip/rend/hls_1080/index0.ts?hdnts=public-player-capability"]);
  for (const value of ["https://example.test/clip/rend/segment.ts", "https://cdn-prod-ccv.adobe.com/other/rend/segment.ts", "../../../outside.ts", "file:///private/file.ts", "http://cdn-prod-ccv.adobe.com/clip/rend/segment.ts"]) assert.throws(() => adobeUrl(value, best.url, "clip"));
});

test("rejects live/encrypted/unsupported HLS playlists and wrong player identity", () => {
  const parent = "https://cdn-prod-ccv.adobe.com/clip/rend/hls_1080/index.m3u8?hdnts=public";
  for (const playlist of ["<html>Denied</html>", "#EXTM3U\nindex0.ts", "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=key\nindex0.ts\n#EXT-X-ENDLIST", "#EXTM3U\n#EXT-X-SESSION-KEY:METHOD=AES-128,URI=file:///private/key\nindex0.ts\n#EXT-X-ENDLIST", "#EXTM3U\n#EXT-X-MAP:URI=init.mp4\nindex0.ts\n#EXT-X-ENDLIST", "#EXTM3U\nindex0.mp4\n#EXT-X-ENDLIST"]) assert.throws(() => hlsSegments(playlist, parent, "clip"));
  assert.throws(() => parsePlayer('window.ccv$serverData = {"status":"ok","ccvid":"other"};', "clip"));
  assert.equal(parsePlayer('window.ccv$serverData = {"status":"ok","ccvid":"clip"};', "clip").ccvid, "clip");
  assert.throws(() => hlsVariant('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio.m3u8"\n#EXT-X-STREAM-INF:RESOLUTION=1920x1080,AUDIO="audio"\nvideo.m3u8', parent, "clip"), /Separate HLS audio/);
});

test("draft mappings never pretend the publishing photograph uploader supports private drafts", () => {
  const manifest = { assets: [{ id, status: "staged", placements: [{ group: "street-photography", page: "/fotos", order: 1 }] }, { id: "fashion", status: "staged", placements: [{ group: "phassion", page: "/copie-de-sewing", order: 11 }] }],
    pages: [{ path: "/copie-de-sewing", texts: [{ text: "Circle of Fashion, other credits." }, { text: "PHASSION, exact source credit." }] }], videos: [] };
  const mapping = draftMappings(manifest);
  assert.match(mapping.photographs[0].publication, /BLOCKED/);
  assert.equal(mapping.photographs[0].publicPath, "/");
  assert.equal(mapping.templates[0].data._status, "draft");
  assert.deepEqual(mapping.templates[0].sourceText, ["PHASSION, exact source credit."]);
  assert.equal(mapping.templates[0].data.cover, undefined);
  assert.match(mapping.templates[0].review.join(" "), /not CMS IDs/);
});

test("distance is evidence of composition only", () => {
  assert.deepEqual(distance({ raw: [0, 255], bits: [true, false] }, { raw: [0, 255], bits: [true, false] }), { rmse: 0, dhash: 0 });
});

test("draft mappings preserve repeated placements while using one source page for mirrored fashion", () => {
  const manifest = { assets: [{ id, status: "staged", placements: [{ group: "tableaux", page: "/tableaux", order: 1 }, { group: "tableaux", page: "/tableaux", order: 3 }] },
    { id: "fashion", status: "existing-composition-not-downloaded", placements: [{ group: "circle-of-fashion", page: "/", order: 1 }, { group: "circle-of-fashion", page: "/sewing", order: 1 }, { group: "circle-of-fashion", page: "/copie-de-sewing", order: 1 }] }],
    pages: [{ path: "/tableaux", texts: [] }, { path: "/copie-de-sewing", texts: [] }], videos: [] };
  const mappings = draftMappings(manifest).templates;
  assert.deepEqual(mappings.find(item => item.key === "tableaux").mediaBindings.orderedImages.map(item => item.order), [1, 3]);
  assert.equal(mappings.find(item => item.key === "circle-of-fashion").mediaBindings.orderedImages.length, 1);
});

const localRoot = fileURLToPath(new URL("../../.local/", import.meta.url));
test("existing output is preserved before any network request", async () => {
  await mkdir(localRoot, { recursive: true });
  const directory = await mkdtemp(join(localRoot, "portfolio-preparation-test-"));
  try {
    await writeFile(join(directory, "keep.txt"), "User work");
    await assert.rejects(createOutput(directory), { code: "EEXIST" });
    assert.equal(await readFile(join(directory, "keep.txt"), "utf8"), "User work");
    await assert.rejects(createOutput(join(directory, "nested")));
    await assert.rejects(createOutput(fileURLToPath(new URL("../../outside-bundle", import.meta.url))));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("offline bundle verification checks pinned manifest, file bytes and traversal", async () => {
  const directory = await mkdtemp(join(localRoot, "portfolio-verification-test-"));
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  const save = async manifest => {
    const bytes = Buffer.from(JSON.stringify(manifest));
    await writeFile(join(directory, "manifest.json"), bytes);
    await writeFile(join(directory, "manifest.sha256"), `${hash(bytes)}  manifest.json\n`);
  };
  try {
    const bytes = Buffer.from("Synthetic content only");
    await writeFile(join(directory, "image.jpg"), bytes);
    const reference = { file: "image.jpg", bytes: bytes.length, sha256: hash(bytes) };
    const manifest = { assets: [reference], videos: [], pages: [], files: [reference] };
    await save(manifest);
    assert.equal((await verifyBundle(directory)).verifiedFiles, 1);
    await writeFile(join(directory, "image.jpg"), "Changed");
    await assert.rejects(verifyBundle(directory), /Checksum mismatch/);
    await save({ ...manifest, assets: [{ ...reference, file: "../outside.jpg" }], files: [{ ...reference, file: "../outside.jpg" }] });
    await assert.rejects(verifyBundle(directory), /escapes/);
    await save({ ...manifest, files: [{ ...reference, sha256: "0".repeat(64) }] });
    await assert.rejects(verifyBundle(directory), /Unpinned/);
    await save(manifest);
    await writeFile(join(directory, "manifest.json"), "{}");
    await assert.rejects(verifyBundle(directory), /Manifest checksum/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("isolated end-to-end preparation makes only public GETs, pins mappings and leaves publication blocked", async () => {
  const directory = join(localRoot, `portfolio-e2e-test-${randomUUID()}`);
  const asset = "10000000-0000-4000-8000-000000000001";
  const pixels = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#887766" } }).png().toBuffer();
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      requests.push(String(url));
      assert.ok(!options.method || options.method === "GET");
      assert.equal(options.redirect, "error");
      if (url === `${origin}/sitemap.xml`) return new Response(`<loc>${origin}/fotos</loc><loc>${origin}/sporadic-thread</loc>`);
      if (url === `${origin}/fotos`) return new Response(page(image(asset)));
      if (url === `${origin}/sporadic-thread`) return new Response("<html><title>Password Protected Page</title><input type='password'></html>");
      assert.equal(url, `${cdn}${asset}_rw_3840.jpg?h=large`);
      return new Response(pixels, { headers: { "content-type": "image/png" } });
    };
    const summary = await prepare(directory, null);
    assert.equal(summary.stagedImages, 1);
    assert.deepEqual(summary.protectedPages, ["/sporadic-thread"]);
    assert.equal(requests.length, 4);
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json")));
    assert.equal(manifest.uploadAuthorized, false);
    assert.equal(manifest.publicationAuthorized, false);
    assert.equal(manifest.assets[0].sha256, createHash("sha256").update(pixels).digest("hex"));
    assert.ok((await verifyBundle(directory)).verifiedFiles >= 10);
    await writeFile(join(directory, "photographs-queue.json"), "Unreviewed mapping change");
    await assert.rejects(verifyBundle(directory), /Checksum mismatch: photographs-queue/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
