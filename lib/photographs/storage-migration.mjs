import { createHash } from "node:crypto";
import { assertPath, objectProvider } from "./storage.mjs";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export function reconcileCatalogue(manifest, photographs, sourceUrl) {
  if (manifest.version !== 1 || manifest.sourceUrl !== sourceUrl || !Array.isArray(manifest.photographs)) throw new Error("Migration manifest source or version mismatch.");
  if (manifest.photographs.length !== photographs.length) throw new Error("Catalogue changed since the manifest was created. Re-inventory before cutover.");
  const byId = new Map(photographs.map(photo => [photo.id, photo]));
  const ids = new Set();
  for (const entry of manifest.photographs) {
    assertPath(entry.path);
    const photo = byId.get(entry.id);
    if (ids.has(entry.id) || !photo || photo.storage_path !== entry.path || photo.filename !== entry.filename) throw new Error("Catalogue identity/path changed. Re-inventory before cutover.");
    ids.add(entry.id);
    objectProvider(photo.storage_provider);
  }
}

export async function verifyCopiedOriginal(storage, entry, sourceBytes, contentType, copy = false) {
  assertPath(entry.path);
  const sourceHash = sha256(sourceBytes);
  // A prior successful copy is not proof that the current source is unchanged.
  if (entry.sha256 && (entry.sha256 !== sourceHash || entry.size !== sourceBytes.length)) throw new Error(`Source changed for ${entry.id}; do not overwrite the published R2 object.`);
  const existing = await storage.head(entry.path);
  if (!existing) {
    if (!copy) throw new Error(`Missing R2 original for ${entry.id}.`);
    await storage.put(entry.path, sourceBytes, contentType);
  }
  const destination = await storage.head(entry.path);
  if (!destination?.ETag || destination.ContentLength !== sourceBytes.length || destination.ContentType !== contentType) throw new Error(`R2 metadata mismatch for ${entry.id}.`);
  const actual = await storage.hash(entry.path, false, destination.ETag);
  if (actual.sha256 !== sourceHash || actual.size !== sourceBytes.length) throw new Error(`R2 byte verification failed for ${entry.id}.`);
  return { ...entry, size: sourceBytes.length, sha256: sourceHash, verifiedAt: new Date().toISOString() };
}
