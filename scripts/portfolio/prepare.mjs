// Explicit local preparation only: no dotenv, credentials, CMS or storage writes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import sharp from "sharp";
import { adobeUrl, bestRendition, cssImages, hlsSegments, hlsVariant, imageId, origin, parsePage, parsePlayer, parseSitemap } from "./source.mjs";
import { compositionAliases, existingImages, groupForImage, groups, youtubeProjects } from "./mapping.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const limit = 100 * 1024 * 1024;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const write = (path, bytes) => writeFile(path, bytes, { flag: "wx", mode: 0o600 });
const json = (path, value) => write(path, `${JSON.stringify(value, null, 2)}\n`);

async function get(url, maximum = limit) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (response.status !== 200) { await response.body?.cancel(); throw new Error(`Public source returned HTTP ${response.status}.`); }
  if (Number(response.headers.get("content-length")) > maximum) { await response.body?.cancel(); throw new Error("Public source exceeds the preparation size limit."); }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maximum) throw new Error("Public source exceeds the preparation size limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function feature(bytes) {
  const raw = await sharp(bytes).rotate().resize(32, 32, { fit: "fill" }).removeAlpha().greyscale().raw().toBuffer();
  const d = await sharp(bytes).rotate().resize(17, 16, { fit: "fill" }).removeAlpha().greyscale().raw().toBuffer();
  return { raw, bits: Array.from({ length: 256 }, (_, i) => d[Math.floor(i / 16) * 17 + i % 16] > d[Math.floor(i / 16) * 17 + i % 16 + 1]) };
}

export function distance(a, b) {
  return { rmse: Math.sqrt(a.raw.reduce((sum, value, i) => sum + (value - b.raw[i]) ** 2, 0) / a.raw.length) / 255,
    dhash: a.bits.reduce((sum, value, i) => sum + Number(value !== b.bits[i]), 0) };
}

async function localImages(directory) {
  const images = new Map();
  for (const filename of (await readdir(directory)).sort()) {
    if (filename.startsWith(".") || !/\.(jpe?g|png|webp)$/i.test(filename)) continue;
    const bytes = await readFile(join(directory, filename));
    images.set(filename, { filename, bytes: bytes.length, sha256: digest(bytes), feature: await feature(bytes) });
  }
  for (const filename of Object.values(existingImages)) assert.ok(images.has(filename), `Required existing image unavailable: ${filename}`);
  return images;
}

function inside(base, path) {
  const rel = relative(base, path);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

export async function createOutput(path) {
  const local = await realpath(join(root, ".local"));
  const output = resolve(path);
  assert.ok(inside(local, output) && dirname(output) === local, "Use a new, direct child directory of this repository's .local/.");
  // This is deliberately first: an existing/partial run is never overwritten.
  await mkdir(output, { mode: 0o700 });
  for (const name of ["sources", "images", "videos"]) await mkdir(join(output, name), { mode: 0o700 });
  return output;
}

async function crawl(output) {
  const sitemap = await get(`${origin}/sitemap.xml`, 1024 * 1024);
  await write(join(output, "sources", "sitemap.xml"), sitemap);
  const queue = parseSitemap(sitemap.toString()), pages = [], seen = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    assert.ok(seen.size < 60, "More than 60 pages discovered; review crawl scope.");
    seen.add(path);
    const html = await get(`${origin}${path}`, 4 * 1024 * 1024);
    const page = parsePage(html.toString(), path);
    const filename = `${path.slice(1) || "root"}.html.txt`;
    await write(join(output, "sources", filename), html);
    await write(join(output, "sources", filename.replace(".html.txt", ".text.txt")), `${page.plainText}\n`);
    page.snapshot = `sources/${filename}`;
    page.snapshotSha256 = digest(html);
    for (const href of page.links) {
      const url = new URL(href, origin);
      if (url.origin === origin && !url.search && !url.hash && /^\/(?:[a-z0-9-]+)?$/.test(url.pathname) && !seen.has(url.pathname) && !queue.includes(url.pathname)) queue.push(url.pathname);
    }
    pages.push(page);
  }
  return pages;
}

async function inventory(pages, output) {
  const assets = new Map(), cssPages = new Map();
  const add = (id, urls, placement, previewUrl, alt = "") => {
    if (!assets.has(id)) assets.set(id, { id, sourceUrls: [], placements: [], alt, previewUrl });
    const asset = assets.get(id);
    asset.sourceUrls = [...new Set([...asset.sourceUrls, ...urls])];
    if (!asset.placements.some(p => p.page === placement.page && p.group === placement.group && p.role === placement.role && p.order === placement.order)) asset.placements.push(placement);
  };
  for (const page of pages) {
    for (const [index, image] of page.images.entries()) add(image.id, image.urls, { page: page.path, group: groupForImage(page, image), order: index + 1, role: page.path === "/work" ? "collection-cover" : ["/contact", "/previous-service-request"].includes(page.path) ? "placement-review" : "content" }, image.previewUrl, image.alt);
    for (const css of page.css) {
      if (!cssPages.has(css)) cssPages.set(css, []);
      cssPages.get(css).push(page.path);
    }
  }
  // OG renditions improve an already discovered cover, but do not add icons/meta-only assets.
  for (const page of pages) for (const url of page.metaImages) {
    const id = imageId(url);
    if (assets.has(id)) assets.get(id).sourceUrls.push(url);
  }
  let cssIndex = 0;
  for (const [url, paths] of cssPages) {
    const cssUrl = new URL(url);
    assert.ok(cssUrl.origin === "https://cdn.myportfolio.com" && cssUrl.pathname.startsWith("/f5a01f46-fd9e-4866-9cc9-b9f5d38cd68e/") && cssUrl.pathname.endsWith(".css"), "Unexpected stylesheet origin/owner.");
    const bytes = await get(url, 2 * 1024 * 1024);
    await write(join(output, "sources", `stylesheet-${++cssIndex}.css.txt`), bytes);
    for (const image of cssImages(bytes.toString())) for (const path of paths) add(image.id, [image.url], { page: path, group: "placement-review", role: "background", order: 0 }, image.url);
  }
  for (const asset of assets.values()) {
    asset.sourceUrls = [...new Set(asset.sourceUrls)];
    // Prefer the highest advertised full rendition. Lightbox URLs are retained in
    // source snapshots, not assumed to be better or camera originals.
    asset.sourceUrl = bestRendition(asset.sourceUrls);
  }
  return assets;
}

async function stageImages(assets, locals, output) {
  const byHash = new Map([...locals.values()].map(image => [image.sha256, image]));
  const previewFeatures = new Map();
  let stagedBytes = 0;
  const preview = async asset => {
    if (!previewFeatures.has(asset.id)) previewFeatures.set(asset.id, await feature(await get(asset.previewUrl)));
    return previewFeatures.get(asset.id);
  };
  for (const asset of assets.values()) {
    const filename = existingImages[asset.id];
    if (filename) {
      const local = locals.get(filename);
      if (!local) {
        Object.assign(asset, { status: "recorded-existing-composition-not-downloaded", existing: { filename }, reviewRequired: true,
          note: "Source ID/composition matched in the prior 2026-11-06 read-only comparison. Supplied drive is unavailable: no fresh local hash or comparison is claimed. Resolve against current CMS before upload; review alternate edits." });
        continue;
      }
      const comparison = distance(await preview(asset), local.feature);
      assert.ok(comparison.rmse < 0.085 && comparison.dhash < 40, `Known composition changed: ${asset.id}; review before excluding.`);
      Object.assign(asset, { status: "existing-composition-not-downloaded", existing: { filename, bytes: local.bytes, sha256: local.sha256 }, comparison,
        reviewRequired: true, note: "Preview composition match, not source-byte identity. Review alternate grading/cropping before dismissing variants." });
      continue;
    }
    const canonicalId = compositionAliases[asset.id];
    if (canonicalId) {
      const canonical = assets.get(canonicalId);
      assert.ok(canonical, "Missing canonical composition.");
      const comparison = distance(await preview(asset), await preview(canonical));
      assert.ok(comparison.rmse === 0 && comparison.dhash === 0, "Known cross-gallery preview changed.");
      Object.assign(asset, { status: "same-composition-alias", canonicalId, comparison, reviewRequired: true, note: "Identical preview, not a claim of identical full-resolution bytes." });
      continue;
    }
    try {
      assert.ok(stagedBytes < 2 * 1024 ** 3, "Image bundle exceeds the 2 GiB preparation budget.");
      const bytes = await get(asset.sourceUrl);
      const metadata = await sharp(bytes).metadata();
      assert.ok(["jpeg", "png", "webp"].includes(metadata.format), "Image format needs separate CMS handling.");
      await sharp(bytes).resize({ width: 1 }).raw().toBuffer();
      const hash = digest(bytes), duplicate = byHash.get(hash);
      Object.assign(asset, { bytes: bytes.length, sha256: hash, width: metadata.width, height: metadata.height, orientation: metadata.orientation || 1,
        mimeType: `image/${metadata.format}`, quality: "Highest advertised Adobe rendition; not a camera-original claim." });
      if (duplicate) {
        Object.assign(asset, { status: "exact-byte-duplicate", duplicateOf: duplicate.id || duplicate.filename });
        continue;
      }
      const group = asset.placements.find(p => p.group !== "placement-review")?.group || "placement-review";
      const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
      const file = `images/${group}--${asset.id}.${extension}`;
      assert.ok(stagedBytes + bytes.length <= 2 * 1024 ** 3, "Image bundle exceeds the 2 GiB preparation budget.");
      await write(join(output, file), bytes);
      asset.file = file;
      stagedBytes += bytes.length;
      asset.status = "staged";
      byHash.set(hash, asset);
    } catch {
      asset.status = "download-failed";
      asset.note = "Public download, size, format or image decode failed. Source snapshot and URL retained; do not upload this entry.";
    }
  }
}

async function stageAdobe(id, output) {
  assert.match(id, /^[\w-]+$/);
  const playerUrl = `https://www-ccv.adobe.io/v1/player/ccv/${id}/embed?api_key=BehancePro2View`;
  const data = parsePlayer((await get(playerUrl, 1024 * 1024)).toString(), id);
  assert.ok(Number(data.duration) > 0 && Number(data.duration) <= 120, "Long Adobe films require a separate intake decision.");
  const master = adobeUrl(data.m3u8URL, null, id);
  const variant = hlsVariant((await get(master, 1024 * 1024)).toString(), master, id);
  const playlist = (await get(variant.url, 1024 * 1024)).toString();
  const segments = hlsSegments(playlist, variant.url, id);
  const directory = join(output, "videos", id);
  await mkdir(directory, { mode: 0o700 });
  const files = [], localNames = [];
  let segmentBytes = 0;
  for (const [index, url] of segments.entries()) {
    assert.ok(segmentBytes < limit, "Adobe clip exceeds the 100 MiB preparation budget.");
    const bytes = await get(url, limit - segmentBytes);
    segmentBytes += bytes.length;
    const name = `segment-${String(index).padStart(3, "0")}.ts`;
    await write(join(directory, name), bytes);
    localNames.push(name);
    files.push({ file: `videos/${id}/${name}`, bytes: bytes.length, sha256: digest(bytes) });
  }
  let index = 0;
  const localPlaylist = playlist.split(/\r?\n/).map(line => line && !line.startsWith("#") ? localNames[index++] : line).join("\n");
  // Local-only HLS: never persist expiring Adobe bearer URLs or give ffmpeg network access.
  await write(join(directory, "source.m3u8"), localPlaylist);
  await exec("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-protocol_whitelist", "file,crypto", "-allowed_extensions", "ts", "-i", join(directory, "source.m3u8"), "-map", "0:v:0", "-map", "0:a?", "-c", "copy", "-movflags", "+faststart", join(directory, "playback.mp4")], { timeout: 120000 });
  const { stdout } = await exec("ffprobe", ["-v", "error", "-protocol_whitelist", "file", "-show_streams", "-show_format", "-of", "json", join(directory, "playback.mp4")], { timeout: 30000 });
  const probe = JSON.parse(stdout), video = probe.streams.find(stream => stream.codec_type === "video");
  assert.ok(video?.width === variant.width && video?.height === variant.height, "Remuxed resolution mismatch.");
  assert.ok(Math.abs(Number(probe.format.duration) - Number(data.duration)) < 1, "Remuxed duration mismatch.");
  const bytes = await readFile(join(directory, "playback.mp4"));
  assert.ok(bytes.length <= limit, "Adobe clip exceeds the native uploader limit.");
  return { id, provider: "adobe", status: "staged", playerUrl, group: id === "An-nBB7Dn58" ? "xix-visuals-for-december" : "placement-review",
    file: `videos/${id}/playback.mp4`, bytes: bytes.length, sha256: digest(bytes), width: video.width, height: video.height, duration: Number(probe.format.duration),
    videoCodec: video.codec_name, audioCodecs: probe.streams.filter(stream => stream.codec_type === "audio").map(stream => stream.codec_name),
    contentFingerprint: digest(Buffer.from(files.map(file => file.sha256).join("\n"))), segments: files, quality: "Highest exposed HLS rendition, remuxed to MP4 without re-encoding. Not an original master." };
}

async function videos(pages, output, includeAdobe) {
  const result = [];
  for (const id of [...new Set(pages.flatMap(page => page.youtube))]) {
    const url = `https://www.youtube.com/watch?v=${id}`;
    const known = youtubeProjects[id];
    assert.ok(known, "A new YouTube embed needs a destination/credit review.");
    try {
      const metadata = JSON.parse((await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, 1024 * 1024)).toString());
      result.push({ id, provider: "youtube", status: "original-required", url, ...known, title: metadata.title, author: metadata.author_name, authorUrl: metadata.author_url,
        pages: pages.filter(page => page.youtube.includes(id)).map(page => page.path), note: "Reference only: no installed downloader, no original file or rehosting acceptance. Obtain an authorized master/download before filling the native film field." });
    } catch { result.push({ id, provider: "youtube", status: "metadata-unavailable", url, ...known }); }
  }
  for (const id of [...new Set(pages.flatMap(page => page.adobe))]) {
    if (!includeAdobe) { result.push({ id, provider: "adobe", status: "not-requested" }); continue; }
    try { result.push(await stageAdobe(id, output)); }
    catch { result.push({ id, provider: "adobe", status: "download-failed", note: "Public player/HLS/segment/remux verification failed; any partial local files are retained. Do not upload this entry." }); }
  }
  for (const clip of result.filter(video => video.contentFingerprint)) {
    const first = result.find(video => video !== clip && video.contentFingerprint === clip.contentFingerprint && result.indexOf(video) < result.indexOf(clip));
    if (first) clip.sameEncodedSegmentsAs = first.id;
  }
  return result;
}

export function draftMappings(manifest) {
  const templates = [], photographs = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.kind === "hold") continue;
    const primaryPage = ["circle-of-fashion", "phassion"].includes(key) && manifest.pages.some(page => page.path === "/copie-de-sewing") ? "/copie-de-sewing" : null;
    const members = manifest.assets.flatMap(asset => asset.placements.filter(p => p.group === key && (!primaryPage || p.page === primaryPage))
      .map(p => ({ assetId: asset.id, order: p.order, sourcePage: `${origin}${p.page}`, status: asset.status }))).sort((a, b) => a.sourcePage.localeCompare(b.sourcePage) || a.order - b.order);
    if (!members.length) continue;
    if (group.kind === "photographs") { photographs.push({ group: key, title: group.title, target: "Photographs in /cms", publicPath: "/", sourceOnlyFuturePath: "/photos", publication: "BLOCKED: this uploader publishes immediately; obtain explicit approval", media: members }); continue; }
    const sourcePaths = [...new Set(manifest.assets.flatMap(asset => asset.placements.filter(p => p.group === key).map(p => p.page)))];
    let sourceTexts = manifest.pages.filter(page => sourcePaths.includes(page.path)).flatMap(page => page.texts.map(block => block.text));
    if (["phassion", "circle-of-fashion"].includes(key)) sourceTexts = sourceTexts.filter(value => value.startsWith(key === "phassion" ? "PHASSION," : "Circle of Fashion,"));
    const uniqueText = [...new Set(sourceTexts)].filter(Boolean);
    templates.push({ key, collection: group.kind, operation: group.existingSelection ? "look-up-existing-project-do-not-modify" : "propose-new-private-draft-after-CMS-dedupe",
      publicPath: `${group.kind === "posts" ? "/blog" : group.kind === "videos" ? "/video" : "/fashion"}/${key}`,
      data: { title: group.title, slug: key, ...(group.year ? { year: group.year } : {}), _status: "draft" }, sourceText: uniqueText,
      mediaBindings: { orderedImages: members, ...(key === "xix-visuals-for-december" ? { film: "An-nBB7Dn58" } : {}) },
      review: ["Resolve real existing/returned Media IDs; asset IDs are not CMS IDs.", "Review cover/order, exact source text and credits; write image alt text before publication.", "Do not submit this mapping JSON directly to Payload."] });
  }
  for (const video of manifest.videos.filter(video => video.provider === "youtube")) templates.push({ key: video.slug, collection: "videos", operation: "propose-new-private-draft-after-CMS-dedupe",
    publicPath: `/video/${video.slug}`, data: { title: video.title || video.slug, slug: video.slug, year: video.year, _status: "draft" }, externalSource: video.url,
    sourceContext: (video.pages || []).flatMap(path => manifest.pages.find(page => page.path === path)?.texts.map(block => block.text) || []),
    review: ["Original film file is missing; do not fabricate a Media relationship or claim playback readiness.", "Preserve source credits and confirm authorization for rehosting, especially TVMTelevision material."] });
  return { templates, photographs };
}

export async function prepare(outputPath, existingDirectory, includeAdobe = false) {
  const output = await createOutput(outputPath);
  const locals = existingDirectory ? await localImages(existingDirectory) : new Map();
  const pages = await crawl(output);
  const assets = await inventory(pages, output);
  assert.ok(assets.size <= 500, "More than 500 images discovered; review the scrape budget.");
  // Freeze discovery before downloading. Failed/interrupted runs keep their evidence.
  await json(join(output, "inventory.json"), { origin, pages, assets: [...assets.values()] });
  await stageImages(assets, locals, output);
  const clips = await videos(pages, output, includeAdobe);
  const manifest = { version: 1, preparedAt: new Date().toISOString(), origin, remoteWrites: false, uploadAuthorized: false, publicationAuthorized: false,
    exclusionEvidence: existingDirectory ? "fresh-local-original-hashes-and-preview-comparison" : "recorded-source-ID-and-prior-preview-comparison-only",
    localExistingDirectory: existingDirectory ? resolve(existingDirectory) : null, localExistingImages: [...locals.values()].map(({ filename, bytes, sha256 }) => ({ filename, bytes, sha256 })),
    limitations: ["Existing original/draft evidence comes from the supplied drive and prior intake records, not a fresh authenticated CMS inventory.", "Composition exclusions/aliases need review for meaningful alternate edits; they are not byte-identity claims.", "Password-protected content and linked social-channel archives were not accessed.", "Source copy and credits are retained, not an approval to publish or a substitute for image alt text."],
    pages, assets: [...assets.values()], videos: clips };
  const mappings = draftMappings(manifest);
  await json(join(output, "cms-drafts.json"), mappings.templates);
  await json(join(output, "photographs-queue.json"), mappings.photographs);
  const staged = manifest.assets.filter(asset => asset.status === "staged");
  const summary = { output, pages: pages.length, protectedPages: pages.filter(page => page.protected).map(page => page.path), imageAssets: assets.size,
    stagedImages: staged.length, stagedImageBytes: staged.reduce((sum, asset) => sum + asset.bytes, 0), existingCompositions: manifest.assets.filter(asset => asset.status === "existing-composition-not-downloaded").length,
    recordedExclusions: manifest.assets.filter(asset => asset.status === "recorded-existing-composition-not-downloaded").length,
    compositionAliases: manifest.assets.filter(asset => asset.status === "same-composition-alias").length, exactDuplicates: manifest.assets.filter(asset => asset.status === "exact-byte-duplicate").length,
    failedImages: manifest.assets.filter(asset => asset.status === "download-failed").length, stagedVideos: clips.filter(clip => clip.status === "staged").length,
    failedVideos: clips.filter(clip => clip.status === "download-failed").length, youtubeReferences: clips.filter(clip => clip.provider === "youtube").length, proposedCmsDraftMappings: mappings.templates.length };
  await json(join(output, "summary.json"), summary);
  await write(join(output, "UPLOAD-REVIEW.md"), `# Adobe Portfolio intake — LOCAL PREPARATION ONLY\n\n${staged.length} image files and ${summary.stagedVideos} Adobe MP4 renditions staged. Nothing uploaded or published.\n\n- Verify: \`node scripts/portfolio/prepare.mjs verify ${relative(root, output)}\`.\n- Read \`manifest.json\` for hashes, provenance, duplicate decisions and failures.\n- \`cms-drafts.json\` proposes Fashion/Video/Journal drafts; asset IDs are NOT native Media IDs. This is not an executable Payload import.\n- \`photographs-queue.json\` is blocked: the photograph uploader publishes immediately.\n- Refresh the authenticated CMS inventory before upload; reuse existing verified originals and drafts.\n- Upload only reviewed unmatched files through native signing/direct upload/server verification; never inject verified metadata.\n- Preserve exact text/credits from \`sources/\`; add reviewed alt text, cover selection and source order.\n- Artwork/music are proposed Journal posts; theatre material is photography, not an asserted fashion-design credit.\n- Covers, backgrounds and the contact portrait are held for placement review, not automatically assigned to Site settings.\n- YouTube entries need authorized film files. Adobe MP4s are highest-exposed HLS stream copies without re-encoding, not 4K masters.\n- Review all composition-only exclusions and video \`sameEncodedSegmentsAs\` before deduplicating publication.\n- Keep \`sporadic-thread\` blocked. No external social-channel archive was scraped.\n- Publication, migrations, deployment and any changes to existing drafts are separate approvals.\n`);
  manifest.files = await bundleFiles(output);
  await json(join(output, "manifest.json"), manifest);
  const bytes = await readFile(join(output, "manifest.json"));
  await write(join(output, "manifest.sha256"), `${digest(bytes)}  manifest.json\n`);
  return summary;
}

export async function prepareVideoSupplement(sourceDirectory, outputPath) {
  await verifyBundle(sourceDirectory);
  const sourceBytes = await readFile(join(sourceDirectory, "manifest.json"));
  const source = JSON.parse(sourceBytes);
  assert.equal(source.origin, origin);
  const ids = [...new Set(source.videos.filter(video => video.provider === "adobe").map(video => video.id))];
  assert.ok(ids.length > 0 && ids.length <= 8, "Unexpected video supplement scope.");
  const output = await createOutput(outputPath);
  const clips = await videos([{ youtube: [], adobe: ids }], output, true);
  const summary = { output, sourceBundle: resolve(sourceDirectory), stagedVideos: clips.filter(clip => clip.status === "staged").length, failedVideos: clips.filter(clip => clip.status === "download-failed").length };
  await json(join(output, "summary.json"), summary);
  const manifest = { version: 1, preparedAt: new Date().toISOString(), origin, remoteWrites: false,
    sourceBundle: { directory: resolve(sourceDirectory), manifestSha256: digest(sourceBytes) }, assets: [], pages: [], videos: clips, files: await bundleFiles(output) };
  await json(join(output, "manifest.json"), manifest);
  const bytes = await readFile(join(output, "manifest.json"));
  await write(join(output, "manifest.sha256"), `${digest(bytes)}  manifest.json\n`);
  return summary;
}

async function bundleFiles(output, directory = output) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await bundleFiles(output, path));
    else {
      assert.ok(entry.isFile(), "Unexpected non-file in bundle.");
      const bytes = await readFile(path);
      files.push({ file: relative(output, path), bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  return files;
}

export async function verifyBundle(directory) {
  const output = resolve(directory), bytes = await readFile(join(output, "manifest.json"));
  const expected = (await readFile(join(output, "manifest.sha256"), "utf8")).trim();
  assert.equal(expected, `${digest(bytes)}  manifest.json`, "Manifest checksum mismatch.");
  const manifest = JSON.parse(bytes);
  const references = [...manifest.assets.filter(asset => asset.file), ...manifest.videos.filter(video => video.file), ...manifest.videos.flatMap(video => video.segments || []),
    ...manifest.pages.map(page => ({ file: page.snapshot, sha256: page.snapshotSha256 }))];
  assert.ok(Array.isArray(manifest.files) && manifest.files.length, "Missing complete bundle file inventory.");
  const files = manifest.files;
  assert.equal(new Set(files.map(file => file.file)).size, files.length, "Duplicate file inventory entries.");
  for (const reference of references) {
    const file = files.find(file => file.file === reference.file);
    assert.ok(file && file.sha256 === reference.sha256 && (reference.bytes == null || reference.bytes === file.bytes), "Unpinned/inconsistent bundle reference.");
  }
  for (const file of files) {
    const path = resolve(output, file.file);
    assert.ok(inside(output, path) && inside(output, await realpath(path)), "Bundle reference escapes its directory.");
    const data = await readFile(path);
    assert.equal(digest(data), file.sha256, `Checksum mismatch: ${file.file}`);
    if (file.bytes != null) assert.equal(data.length, file.bytes, `Byte-count mismatch: ${file.file}`);
  }
  return { verifiedFiles: files.length, remoteWrites: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "verify" && args.length === 2) console.log(JSON.stringify(await verifyBundle(args[1]), null, 2));
    else if (args[0] === "videos" && args.length === 3) {
      const summary = await prepareVideoSupplement(args[1], args[2]);
      console.log(JSON.stringify(summary, null, 2));
      if (summary.failedVideos) process.exitCode = 1;
    }
    else if (args[0] && !args[0].startsWith("-") && args[1] === "--existing" && args[2] && args.slice(3).every(arg => arg === "--adobe-video") && args.length <= 4) {
      const summary = await prepare(args[0], args[2], args.includes("--adobe-video"));
      console.log(JSON.stringify(summary, null, 2));
      if (summary.failedImages || summary.failedVideos) process.exitCode = 1;
    } else if (args[0] && !args[0].startsWith("-") && args[1] === "--recorded-exclusions" && args.slice(2).every(arg => arg === "--adobe-video") && args.length <= 3) {
      const summary = await prepare(args[0], null, args.includes("--adobe-video"));
      console.log(JSON.stringify(summary, null, 2));
      if (summary.failedImages || summary.failedVideos) process.exitCode = 1;
    } else {
      console.log('Usage: node scripts/portfolio/prepare.mjs .local/NEW-DIRECTORY --existing "/Volumes/A044/arnaud portfolio" [--adobe-video]\n       node scripts/portfolio/prepare.mjs .local/NEW-DIRECTORY --recorded-exclusions [--adobe-video]\n       node scripts/portfolio/prepare.mjs videos .local/SOURCE-BUNDLE .local/NEW-SUPPLEMENT\n       node scripts/portfolio/prepare.mjs verify .local/EXISTING-BUNDLE\nRecorded exclusions do not claim fresh original-byte verification. No .env, authentication, CMS writes, uploads, publication or deployment.');
      if (args.length && !["--help", "-h"].includes(args[0])) process.exitCode = 1;
    }
  } catch (error) {
    // Avoid printing remote capability URLs, response bodies or subprocess inputs.
    const message = String(error.message).replace(/https?:\/\/[^\s)]+/g, value => { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return "[source URL]"; } }).slice(0, 300);
    console.error(`Preparation stopped (${error.code || error.name}): ${message}. Existing/partial files were retained.`);
    process.exitCode = 1;
  }
}
