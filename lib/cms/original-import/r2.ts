import { S3Client, HeadObjectCommand, CreateMultipartUploadCommand, ListPartsCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { PRIVATE_BUCKET, type Storage } from "./core";

export function originalR2(env: Partial<NodeJS.ProcessEnv>): Storage {
  const account = env.ARNAUD_ORIGINALS_R2_ACCOUNT_ID;
  const accessKeyId = env.ARNAUD_ORIGINALS_R2_ACCESS_KEY_ID;
  const secretAccessKey = env.ARNAUD_ORIGINALS_R2_SECRET_ACCESS_KEY;
  if (!account || !/^[a-f0-9]{32}$/.test(account) || !accessKeyId || !secretAccessKey) throw new Error("Explicit operator R2 credentials required.");
  const client = new S3Client({ endpoint: `https://${account}.r2.cloudflarestorage.com`, region: "auto", forcePathStyle: true, credentials: { accessKeyId, secretAccessKey, sessionToken: env.ARNAUD_ORIGINALS_R2_SESSION_TOKEN || undefined }, maxAttempts: 1, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
  function target(key: string) {
    const match = /^journal-native\/large-originals\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\/([a-f0-9-]+)\.mp4$/.exec(key);
    if (!match || match[1] !== match[2]) throw new Error("Private original key denied.");
    return { Bucket: PRIVATE_BUCKET, Key: key };
  }
  const options = () => ({ abortSignal: AbortSignal.timeout(5 * 60_000) });
  return {
    async head(key) {
      try {
        const result = await client.send(new HeadObjectCommand(target(key)), options());
        if (!result.ETag || result.ContentLength === undefined) throw new Error("Incomplete object HEAD.");
        return { bytes: result.ContentLength, etag: result.ETag };
      } catch (error) {
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async create(key) {
      const result = await client.send(new CreateMultipartUploadCommand({ ...target(key), ContentType: "video/mp4", CacheControl: "private, no-store" }), options());
      if (!result.UploadId) throw new Error("Multipart creation uncertain.");
      return result.UploadId;
    },
    async list(key, uploadId, marker) {
      const result = await client.send(new ListPartsCommand({ ...target(key), UploadId: uploadId, PartNumberMarker: marker, MaxParts: 1000 }), options());
      if (result.IsTruncated && !result.NextPartNumberMarker) throw new Error("Missing ListParts continuation.");
      return { parts: (result.Parts ?? []).map(part => ({ number: part.PartNumber!, bytes: part.Size!, etag: part.ETag! })), next: result.IsTruncated ? result.NextPartNumberMarker : undefined };
    },
    async put(key, uploadId, number, body) {
      const result = await client.send(new UploadPartCommand({ ...target(key), UploadId: uploadId, PartNumber: number, Body: body, ContentLength: body.length }), options());
      if (!result.ETag) throw new Error("Part acknowledgement missing.");
      return result.ETag;
    },
    async complete(key, uploadId, parts) {
      await client.send(new CompleteMultipartUploadCommand({ ...target(key), UploadId: uploadId, IfNoneMatch: "*", MultipartUpload: { Parts: parts.map(part => ({ PartNumber: part.number, ETag: part.etag })) } }), options());
    },
    async read(key, etag) {
      const result = await client.send(new GetObjectCommand({ ...target(key), IfMatch: etag }), { abortSignal: AbortSignal.timeout(60 * 60_000) });
      if (!result.Body || !(Symbol.asyncIterator in result.Body)) throw new Error("Expected streaming original body.");
      return result.Body as AsyncIterable<Uint8Array>;
    },
  };
}
