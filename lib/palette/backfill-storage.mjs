import { createHash } from "node:crypto";
import { assertPath, objectProvider, r2Storage } from "../photographs/storage.mjs";
import { PHOTOGRAPH_BUCKET, MAXIMUM_UPLOAD_BYTES } from "../photographs/config.mjs";
import { BackfillError } from "./backfill-error.mjs";

async function boundedBytes(body, expectedSize) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > MAXIMUM_UPLOAD_BYTES || size > expectedSize) throw new BackfillError("Original exceeded its verified size limit.");
    chunks.push(Buffer.from(chunk));
  }
  if (size !== expectedSize) throw new BackfillError("Original byte count does not match its metadata.");
  return Buffer.concat(chunks, size);
}

/** Originals only: no image-transform endpoint, public derivative or remote write. */
export function originalReader(service, origin, serviceKey, storageFactory = r2Storage) {
  return async photo => {
    const path = assertPath(photo.storage_path);
    const provider = objectProvider(photo.storage_provider);
    let bytes, etag;
    if (provider === "r2") {
      const storage = storageFactory();
      const head = await storage.head(path);
      if (!head?.ETag || !Number.isSafeInteger(head.ContentLength) || head.ContentLength < 1 || head.ContentLength > MAXIMUM_UPLOAD_BYTES) throw new BackfillError("Invalid R2 original metadata.");
      bytes = await boundedBytes(await storage.read(path, false, head.ETag), head.ContentLength);
      const after = await storage.head(path);
      if (after?.ETag !== head.ETag || after.ContentLength !== head.ContentLength) throw new BackfillError("R2 original changed during download.");
      etag = head.ETag;
    } else {
      const { data, error } = await service.storage.from(PHOTOGRAPH_BUCKET).info(path);
      if (error || !Number.isSafeInteger(data?.size) || data.size < 1 || data.size > MAXIMUM_UPLOAD_BYTES) throw new BackfillError("Invalid Supabase original metadata.");
      // The self-hosted Storage API accepts credentialed reads at /object/;
      // its newer /object/authenticated/ alias is not available on all versions.
      const response = await fetch(`${origin}/storage/v1/object/${PHOTOGRAPH_BUCKET}/${path}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, redirect: "error", signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok || !response.body) throw new BackfillError("Supabase original could not be read.");
      bytes = await boundedBytes(response.body, data.size);
      etag = response.headers.get("etag");
    }
    return { bytes, provider, path, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), etag };
  };
}
