import { createHash } from "node:crypto";
import { S3Client, HeadObjectCommand, GetObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, CopyObjectCommand, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Config, PART_SIZE, validateParts } from "../photographs/storage.mjs";
import { matchesMediaType } from "./media";

export { PART_SIZE };
const PATH = /^blog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm|mp3|ogg|wav)$/;
export type BlogMedia = { id: string; post_id: string; storage_path: string; filename: string; content_type: string; size_bytes: number; multipart_id: string | null; state: "uploading" | "ready" | "published"; sha256: string | null; source_etag: string | null; published_etag: string | null; created_at: string };

export function blogStorage(env: NodeJS.ProcessEnv = process.env, requestHandler?: S3ClientConfig["requestHandler"]) {
  const config = r2Config(env);
  const client = new S3Client({ endpoint: config.endpoint, region: "auto", forcePathStyle: true, credentials: config.credentials, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED", ...(requestHandler ? { requestHandler } : {}) });
  const params = (path: string, staging = true) => {
    if (!PATH.test(path)) throw new Error("Invalid blog media path.");
    return { Bucket: staging ? config.staging : config.published, Key: path };
  };
  const head = async (path: string, staging = true) => {
    try { return await client.send(new HeadObjectCommand(params(path, staging))); }
    catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null; throw error; }
  };
  const hash = async (path: string, staging: boolean, etag: string) => {
    const result = await client.send(new GetObjectCommand({ ...params(path, staging), IfMatch: etag }));
    if (!result.Body) throw new Error("The media object is missing.");
    const digest = createHash("sha256");
    let size = 0;
    let prefix = Buffer.alloc(0);
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      digest.update(chunk); size += chunk.length;
      if (prefix.length < 512) prefix = Buffer.concat([prefix, chunk.slice(0, 512 - prefix.length)]);
    }
    return { sha256: digest.digest("hex"), size, prefix };
  };
  return {
    head, hash,
    async create(path: string, contentType: string) {
      const result = await client.send(new CreateMultipartUploadCommand({ ...params(path), ContentType: contentType, CacheControl: "private, no-store" }));
      if (!result.UploadId) throw new Error("Could not begin the upload.");
      return result.UploadId;
    },
    async signPart(path: string, uploadId: string, number: number) {
      return getSignedUrl(client, new UploadPartCommand({ ...params(path), UploadId: uploadId, PartNumber: number }), { expiresIn: 900 });
    },
    async parts(path: string, uploadId: string) {
      const result = await client.send(new ListPartsCommand({ ...params(path), UploadId: uploadId }));
      if (result.IsTruncated) throw new Error("Too many upload parts.");
      return result.Parts ?? [];
    },
    async finish(media: BlogMedia) {
      let source = await head(media.storage_path);
      if (!source) {
        if (!media.multipart_id) throw new Error("The upload has not been initialized. Select the file again.");
        const parts = await this.parts(media.storage_path, media.multipart_id);
        validateParts(parts, media.size_bytes);
        try { await client.send(new CompleteMultipartUploadCommand({ ...params(media.storage_path), UploadId: media.multipart_id, MultipartUpload: { Parts: parts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })) } })); }
        catch (error) { if (!await head(media.storage_path)) throw error; }
        source = await head(media.storage_path);
      }
      if (!source?.ETag || source.ContentLength !== media.size_bytes || source.ContentType !== media.content_type) throw new Error("Uploaded media does not match its reservation.");
      const checked = await hash(media.storage_path, true, source.ETag);
      if (checked.size !== media.size_bytes || !matchesMediaType(checked.prefix, media.content_type)) throw new Error("The file contents do not match the selected media format.");
      return { sha256: checked.sha256, source_etag: source.ETag };
    },
    async promote(media: BlogMedia) {
      if (!media.sha256 || !media.source_etag || media.state === "uploading") throw new Error("Finish uploading all media before publishing.");
      if (!await head(media.storage_path, false)) {
        const command = new CopyObjectCommand({ ...params(media.storage_path, false), CopySource: `${config.staging}/${media.storage_path}`, CopySourceIfMatch: media.source_etag, MetadataDirective: "REPLACE", ContentType: media.content_type, CacheControl: "private, no-store" });
        command.middlewareStack.add(next => async args => {
          (args.request as { headers: Record<string, string> }).headers["cf-copy-destination-if-none-match"] = "*";
          return next(args);
        }, { step: "build", name: "arnaudBlogImmutableDestination" });
        try { await client.send(command); }
        catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412 || !await head(media.storage_path, false)) throw error; }
      }
      const destination = await head(media.storage_path, false);
      if (!destination?.ETag || destination.ContentLength !== media.size_bytes || destination.ContentType !== media.content_type) throw new Error("Published media verification failed. Recovery objects were retained.");
      const checked = await hash(media.storage_path, false, destination.ETag);
      if (checked.sha256 !== media.sha256 || checked.size !== media.size_bytes) throw new Error("Published media checksum failed. Recovery objects were retained.");
      return destination.ETag;
    },
    async signRead(path: string, contentType: string, staging: boolean) {
      return getSignedUrl(client, new GetObjectCommand({ ...params(path, staging), ResponseContentType: contentType, ResponseContentDisposition: "inline", ResponseCacheControl: "private, no-store" }), { expiresIn: 300 });
    },
  };
}
