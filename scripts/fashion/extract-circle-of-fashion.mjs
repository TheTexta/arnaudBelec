// Public-source GETs and local files only. No .env, CMS, storage or database writes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const sourcePage = "https://arnaudnaudbel.myportfolio.com/copie-de-sewing";
export const sourceText = "Circle of Fashion, McGill University, Runway Fall 2025. Designed in collaboration with Sophie Miretsky.";
const ownerPath = "/f5a01f46-fd9e-4866-9cc9-b9f5d38cd68e/";
export const sourceIds = [
  "cc0f7f99-9ead-426a-b26a-8a3d38878801", "31e4123d-0aa3-479c-824e-48beb4346b39",
  "b8b4a4bf-5fc1-4781-80fc-83bf23d33756", "dfbbdb99-47d8-43cd-8d8f-368dec9d2913",
  "fbf53e78-f863-4561-8d26-519226adbe0b", "980dd4d1-a806-4090-8e2b-5d873d48b5cc",
  "1d806ec8-50d3-4dce-9e7f-481684ba1940", "543f2b32-2fc7-42f4-8ec2-cef313a0954a",
  "51fcca0a-4f4c-4281-ac40-715cec0f4043", "34f63ccd-3a41-4f8f-bb98-84cdcc973069",
];
const descriptions = [
  "Three models in black, orange and burgundy garments pose together in a hallway.",
  "Three models in textured tan dresses and separates pose together in a hallway.",
  "Model in a burgundy diamond-patterned outfit on a warmly lit runway.",
  "Model looking down at a black outfit with orange and yellow patchwork.",
  "Side view of a model in a black dress and knee-high boots on the runway.",
  "Model in a cropped black-and-orange top and loose dark trousers on the runway.",
  "Model in a patterned short dress and knee-high black boots on the runway.",
  "Side view of a model in a light-coloured outfit and tall black boots.",
  "Model in a burgundy outfit walks across the runway under warm stage lights.",
  "Model in a textured tan sleeveless garment and shorts walks down the runway.",
];

export function parseCircleOfFashion(html) {
  const start = html.indexOf(sourceText);
  const end = html.indexOf("PHASSION", start);
  assert.ok(start >= 0 && end > start, "Source copy/section changed; review before extracting.");
  const urls = [...html.slice(start, end).matchAll(/\bdata-src="([^"]+)"/g)].map(match => new URL(match[1]));
  assert.deepEqual(urls.map(url => url.pathname), sourceIds.map(id => `${ownerPath}${id}_rw_1920.jpg`), "Source image membership/order changed; review before extracting.");
  assert.ok(urls.every(url => url.origin === "https://cdn.myportfolio.com" && !url.username && !url.password), "Unexpected source image origin.");
  return urls.map(url => url.href);
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), redirect: "error" });
  assert.equal(response.status, 200, `Source request failed: ${url}`);
  return response;
}

export async function extractCircleOfFashion(output) {
  const html = await (await get(sourcePage)).text();
  const urls = parseCircleOfFashion(html);
  await mkdir(dirname(output), { recursive: true });
  // Refuse existing destinations, including partial runs; never overwrite files.
  await mkdir(output, { mode: 0o700 });
  const media = [];
  for (let offset = 0; offset < urls.length; offset += 3) {
    const batch = await Promise.all(urls.slice(offset, offset + 3).map(async (url, position) => {
      const index = offset + position;
      const response = await get(url);
      assert.match(response.headers.get("content-type") || "", /^image\/jpeg(?:;|$)/);
      const bytes = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "jpeg");
      assert.equal(metadata.width, 1920); assert.equal(metadata.height, 3416);
      // Decode every image, but retain the downloaded bytes without re-encoding.
      await sharp(bytes).resize({ width: 1 }).toBuffer();
      const filename = `circle-of-fashion-${String(index + 1).padStart(2, "0")}.jpg`;
      await writeFile(join(output, filename), bytes, { flag: "wx", mode: 0o600 });
      return { filename, sourceUrl: url, sourceId: sourceIds[index], order: index + 1,
        sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
        mimeType: "image/jpeg", width: metadata.width, height: metadata.height,
        alt: descriptions[index], caption: "" };
    }));
    media.push(...batch);
  }
  const manifest = {
    version: 1, sourcePage, sourceText, extractedAt: new Date().toISOString(),
    note: "Published Adobe JPEG renditions, not camera originals. Local preparation only; no CMS records or uploads created.",
    project: { collection: "fashion-projects", title: "Circle of Fashion", slug: "circle-of-fashion",
      year: "2025", excerpt: sourceText, _status: "draft" },
    // Filenames are an import mapping, not fabricated native Media IDs.
    coverFilename: media[0].filename, galleryFilenames: media.slice(1).map(item => item.filename), media,
  };
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await writeFile(join(output, "source-text.txt"), `${sourceText}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [output, ...extra] = process.argv.slice(2);
  assert.ok(output && !extra.length, "Usage: node scripts/fashion/extract-circle-of-fashion.mjs .local/circle-of-fashion-NEW-DIRECTORY");
  const directory = resolve(output);
  const manifest = await extractCircleOfFashion(directory);
  console.log(`Extracted ${manifest.media.length} ordered JPEGs (${manifest.media.reduce((sum, item) => sum + item.bytes, 0)} bytes) and exact source text to ${directory}. No remote writes.`);
}
