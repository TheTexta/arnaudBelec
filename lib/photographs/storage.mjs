import { createHash } from "node:crypto";
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PHOTOGRAPH_BUCKET } from "./config.mjs";

export const PART_SIZE = 8 * 1024 * 1024;
export const CANONICAL_PATH = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** @returns {"supabase" | "r2"} */
export function uploadProvider(env = process.env) {
  const provider = env.ARNAUD_UPLOAD_STORAGE || "supabase";
  if (!["supabase", "r2"].includes(provider)) throw new Error("ARNAUD_UPLOAD_STORAGE must be supabase or r2.");
  return provider;
}

export function objectProvider(value) {
  if (value === undefined || value === null || value === "supabase") return "supabase";
  if (value === "r2") return value;
  throw new Error("Unknown photograph storage provider.");
}

export function assertPath(path) {
  if (typeof path !== "string" || !CANONICAL_PATH.test(path)) throw new Error("Invalid photograph storage path.");
  return path;
}

export function r2Config(env = process.env) {
  const account = env.R2_ACCOUNT_ID;
  if (!account || !/^[a-f0-9]{32}$/i.test(account) || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new Error("Configure server-only R2 account and bucket-scoped credentials.");
  // Fixed site buckets prevent accidental cross-project reads/writes.
  return { endpoint: `https://${account}.r2.cloudflarestorage.com`, published: "arnaudbelec", staging: "arnaudbelec-staging", credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } };
}

export function r2Storage(env = process.env, requestHandler) {
  const config = r2Config(env);
  const client = new S3Client({ endpoint: config.endpoint, region: "auto", forcePathStyle: true, credentials: config.credentials, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED", ...(requestHandler ? { requestHandler } : {}) });
  const bucketFor = (staging) => staging ? config.staging : config.published;
  const params = (path, staging = false) => ({ Bucket: bucketFor(staging), Key: assertPath(path) });
  const head = async (path, staging = false) => {
    try { return await client.send(new HeadObjectCommand(params(path, staging))); }
    catch (error) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
  };
  const read = async (path, staging = false, etag) => {
    const object = await client.send(new GetObjectCommand({ ...params(path, staging), ...(etag ? { IfMatch: etag } : {}) }));
    if (!object.Body) throw new Error("R2 object body is missing.");
    return object.Body;
  };
  const hash = async (path, staging = false, etag) => {
    const digest = createHash("sha256");
    let size = 0;
    for await (const chunk of await read(path, staging, etag)) { digest.update(chunk); size += chunk.length; }
    return { sha256: digest.digest("hex"), size };
  };
  return {
    head, read, hash,
    async put(path, bytes, contentType, staging = false) {
      await client.send(new PutObjectCommand({ ...params(path, staging), Body: bytes, ContentType: contentType, CacheControl: staging ? "private, no-store" : "public, max-age=31536000, immutable", IfNoneMatch: "*" }));
    },
    async create(path, contentType) {
      const result = await client.send(new CreateMultipartUploadCommand({ ...params(path, true), ContentType: contentType, CacheControl: "private, no-store" }));
      if (!result.UploadId) throw new Error("No multipart upload ID was returned.");
      return result.UploadId;
    },
    async signPart(path, uploadId, partNumber) {
      return getSignedUrl(client, new UploadPartCommand({ ...params(path, true), UploadId: uploadId, PartNumber: partNumber }), { expiresIn: 900 });
    },
    async parts(path, uploadId) {
      const result = await client.send(new ListPartsCommand({ ...params(path, true), UploadId: uploadId }));
      if (result.IsTruncated) throw new Error("Unexpected number of upload parts.");
      return result.Parts ?? [];
    },
    async complete(path, uploadId, parts) {
      await client.send(new CompleteMultipartUploadCommand({ ...params(path, true), UploadId: uploadId, MultipartUpload: { Parts: parts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })) } }));
    },
    async promote(path, etag, contentType) {
      const command = new CopyObjectCommand({ ...params(path), CopySource: `${config.staging}/${assertPath(path)}`, CopySourceIfMatch: etag, MetadataDirective: "REPLACE", ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" });
      // R2's destination condition is an extension absent from the S3 model.
      // Add it before signing; a competing finalizer must not overwrite a key.
      command.middlewareStack.add(next => async args => {
        args.request.headers["cf-copy-destination-if-none-match"] = "*";
        return next(args);
      }, { step: "build", name: "arnaudImmutableDestination" });
      try { await client.send(command); }
      catch (error) {
        if (error.$metadata?.httpStatusCode !== 412 || !await head(path)) throw error;
        // The caller independently hashes the winner's bytes before publication.
      }
    },
    async removeStaging(path) { await client.send(new DeleteObjectCommand(params(path, true))); },
  };
}

export function validateParts(parts, size) {
  const count = Math.ceil(size / PART_SIZE);
  if (parts.length !== count || parts.some((part, index) => part.PartNumber !== index + 1 || !part.ETag || part.Size !== Math.min(PART_SIZE, size - index * PART_SIZE))) throw new Error("The uploaded parts do not match the reserved file size.");
}

/** Independently hashes both bodies; an ETag or stored hash is not read-back proof. */
export async function verifyPromotion(storage, path, size, contentType) {
  assertPath(path);
  const source = await storage.head(path, true);
  if (!source?.ETag || source.ContentLength !== size || source.ContentType !== contentType) throw new Error("The staging object does not match its reservation.");
  const sourceHash = await storage.hash(path, true, source.ETag);
  if (sourceHash.size !== size) throw new Error("Staging object size verification failed.");
  if (!await storage.head(path)) await storage.promote(path, source.ETag, contentType);
  const destination = await storage.head(path);
  if (!destination?.ETag || destination.ContentLength !== size || destination.ContentType !== contentType) throw new Error("Published object metadata verification failed.");
  const destinationHash = await storage.hash(path, false, destination.ETag);
  if (destinationHash.size !== sourceHash.size || destinationHash.sha256 !== sourceHash.sha256) throw new Error("R2 promotion checksum verification failed. Recovery objects were retained.");
  return { sha256: sourceHash.sha256, etag: destination.ETag };
}

export async function readPhotograph(supabase, photograph) {
  if (objectProvider(photograph.storage_provider) === "r2") {
    const body = await r2Storage().read(photograph.storage_path);
    return Buffer.from(await body.transformToByteArray());
  }
  const { data, error } = await supabase.storage.from(PHOTOGRAPH_BUCKET).download(assertPath(photograph.storage_path));
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
