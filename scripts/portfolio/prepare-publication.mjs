// Offline image/sample preparation and read-only original duplicate evidence.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { parsedSourceBundle } from "./upload.mjs";
import { draftMappings, verifyBundle } from "./prepare.mjs";
import { originalUrl, saveNew, sha } from "./publication.mjs";

const [bundle, audit] = process.argv.slice(2);
await verifyBundle(bundle);
const source = await parsedSourceBundle(bundle, JSON.parse(await readFile(join(bundle, "manifest.json"), "utf8")));
const mapping = draftMappings(source).photographs;
const candidates = [];
for (const group of mapping) for (const item of group.media) {
  const asset = source.assets.find(a => a.id === item.assetId);
  if (asset.status === "staged" && !candidates.some(c => c.assetId === asset.id)) candidates.push({ assetId: asset.id, group: group.group, order: item.order,
    file: asset.file, sha256: asset.sha256, bytes: asset.bytes, mimeType: asset.mimeType, sourcePage: item.sourcePage, filename: `${group.group}-${String(item.order).padStart(2, "0")}--${asset.id}.${asset.file.split(".").pop()}` });
}
assert.equal(candidates.length, 78);
await mkdir(join(audit, "existing-originals"), { mode: 0o700 });
const old = JSON.parse(await readFile(join(audit, "photos-before.json"), "utf8"));
const originals = [];
for (const row of old) {
  const r = await fetch(originalUrl(row), { redirect: "error", signal: AbortSignal.timeout(180000) }); assert.equal(r.status, 200);
  const bytes = Buffer.from(await r.arrayBuffer());
  const file = `existing-originals/${row.id}.${row.storage_path.split(".").pop()}`;
  await writeFile(join(audit, file), bytes, { flag: "wx", mode: 0o600 });
  originals.push({ id: row.id, filename: row.filename, sha256: sha(bytes), bytes: bytes.length, file });
}
async function tiny(file) { return sharp(file).rotate().resize(16, 16, { fit: "fill" }).greyscale().raw().toBuffer(); }
const oldPixels = await Promise.all(originals.map(o => tiny(join(audit, o.file))));
for (const c of candidates) {
  const pixels = await tiny(join(bundle, c.file));
  c.exactMatches = originals.filter(o => o.sha256 === c.sha256).map(o => o.id);
  c.nearestExisting = originals.map((o, i) => ({ id: o.id, filename: o.filename, meanAbsoluteDifference: [...pixels].reduce((sum, v, j) => sum + Math.abs(v - oldPixels[i][j]), 0) / pixels.length })).sort((a, b) => a.meanAbsoluteDifference - b.meanAbsoluteDifference).slice(0, 2);
}
await saveNew(join(audit, "photograph-candidates.json"), candidates);
await saveNew(join(audit, "existing-original-hashes.json"), originals);
async function sheet(items, name, fileFor) {
  const parts = [];
  for (const [i, item] of items.entries()) {
    const x = i % 4 * 320, y = Math.floor(i / 4) * 260;
    parts.push({ input: await sharp(fileFor(item)).rotate().resize(310, 225, { fit: "contain", background: "#ddd" }).png().toBuffer(), left: x + 5, top: y + 5 });
    parts.push({ input: Buffer.from(`<svg width="320" height="28"><rect width="320" height="28" fill="white"/><text x="7" y="19" font-size="15">${i + 1}. ${name}</text></svg>`), left: x, top: y + 232 });
  }
  await sharp({ create: { width: 1280, height: Math.ceil(items.length / 4) * 260, channels: 3, background: "#eee" } }).composite(parts).png().toFile(join(audit, `sheet-${name}.png`));
}
await sheet(originals, "existing", o => join(audit, o.file));
for (const group of mapping) await sheet(candidates.filter(c => c.group === group.group), group.group, c => join(bundle, c.file));
// Native browser decoding/resampling, not a Sharp approximation of the upload sample.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir(join(audit, "samples"), { mode: 0o700 });
try {
  const page = await browser.newPage();
  for (const c of candidates) {
    const bytes = await readFile(join(bundle, c.file)); assert.equal(sha(bytes), c.sha256);
    const result = await page.evaluate(async ({ base64, mimeType }) => {
      const input = Uint8Array.from(atob(base64), v => v.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([input], { type: mimeType }), { imageOrientation: "from-image" });
      try {
        const { width, height } = bitmap, scale = Math.min(1, 256 / Math.max(width, height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        const sample = await blob.arrayBuffer(); let raw = ""; for (const b of new Uint8Array(sample)) raw += String.fromCharCode(b);
        return { width, height, png: btoa(raw) };
      } finally { bitmap.close(); }
    }, { base64: bytes.toString("base64"), mimeType: c.mimeType });
    const png = Buffer.from(result.png, "base64"); assert.ok(png.length < 300000);
    Object.assign(c, { width: result.width, height: result.height, sample: `samples/${c.assetId}.png`, sampleSha256: sha(png) });
    await writeFile(join(audit, c.sample), png, { flag: "wx", mode: 0o600 });
  }
} finally { await browser.close(); }
await saveNew(join(audit, "photograph-samples.json"), candidates);
console.log(JSON.stringify({ candidates: candidates.length, originalBytesVerified: originals.length, exactDuplicates: candidates.filter(c => c.exactMatches.length).length, browserSamplesPrepared: candidates.length,
  closestMatches: candidates.map(c => ({ group: c.group, order: c.order, ...c.nearestExisting[0] })).sort((a, b) => a.meanAbsoluteDifference - b.meanAbsoluteDifference).slice(0, 12), remoteWrites: false }, null, 2));
