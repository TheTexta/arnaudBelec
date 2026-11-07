import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import { s3Storage } from "@payloadcms/storage-s3";
import { APIError, type CollectionConfig, type CollectionSlug, type GlobalSlug, type Plugin, type PayloadRequest, type Where } from "payload";
import { isCmsUser } from "./auth";
import { MAX_MEDIA_BYTES, MEDIA_FORMATS, validateMedia } from "../blog/media";
import { r2Config } from "../photographs/storage.mjs";
import { mediaId, siteExpansionEnabled } from "./site-access";

export const JOURNAL_PREFIX = "journal-native";
const admin = ({ req }: { req: PayloadRequest }) => isCmsUser(req.user);
const canonicalMime = (mime?: string) => {
  const type = mime?.split(";")[0].trim();
  return type === "audio/x-wav" || type === "audio/wave" ? "audio/wav" : type === "audio/opus" ? "audio/ogg" : type;
};

export async function verifyOriginal(source: AsyncIterable<Uint8Array>, claimedSize: number, filename: string, mimeType: string) {
  let format;
  try { format = validateMedia({ filename, size: claimedSize }); }
  catch (error) { throw new APIError((error as Error).message, 400); }
  const digest = createHash("sha256");
  let size = 0;
  let prefix = Buffer.alloc(0);
  for await (const bytes of source) {
    size += bytes.length;
    if (size > MAX_MEDIA_BYTES) throw new APIError("Media must not exceed 100 MiB.", 400);
    digest.update(bytes);
    if (prefix.length < 8192) prefix = Buffer.concat([prefix, bytes.subarray(0, 8192 - prefix.length)]);
  }
  const detected = await fileTypeFromBuffer(prefix).catch(() => undefined);
  if (!size || size !== claimedSize || canonicalMime(mimeType) !== format.contentType || canonicalMime(detected?.mime) !== format.contentType) throw new APIError("The uploaded bytes, size or format do not match the selected file.", 400);
  return { sha256: digest.digest("hex"), size, mimeType: format.contentType };
}

export const Media: CollectionConfig = {
  slug: "media", labels: { singular: "Journal media", plural: "Journal media" },
  disableDuplicate: true,
  admin: { useAsTitle: "filename", description: "Private originals. Files become anonymously readable only while referenced by a published Journal post, project or Site settings. Homepage selections stay private until Site settings are published. To replace a file, upload a new original." },
  upload: {
    disableLocalStorage: true, filesRequiredOnCreate: true,
    mimeTypes: [...new Set(Object.values(MEDIA_FORMATS).map(item => item.contentType)), "audio/x-wav", "audio/wave", "audio/ogg; codecs=opus"],
    crop: false, focalPoint: false, pasteURL: false, hideRemoveFile: true,
    externalFileHeaderFilter: () => ({}),
  },
  access: {
    create: admin, update: admin, delete: () => false,
    read: async ({ req }): Promise<boolean | Where> => {
      if (isCmsUser(req.user)) return true;
      const posts = await req.payload.find({ collection: "posts", draft: false, overrideAccess: true, showHiddenFields: true, pagination: false, depth: 0, select: { mediaReferences: true }, where: { _status: { equals: "published" } }, req });
       const ids = [...new Set(posts.docs.flatMap(post => (post.mediaReferences ?? []).map(item => typeof item === "string" ? item : item.id)))];
       if (siteExpansionEnabled()) {
         for (const collection of ["videos", "fashion-projects"]) {
           const projects = await req.payload.find({ collection: collection as CollectionSlug, draft: false, overrideAccess: true, showHiddenFields: true, pagination: false, depth: 0, select: { mediaReferences: true }, where: { _status: { equals: "published" } }, req });
           for (const doc of projects.docs) {
             for (const value of (doc as unknown as { mediaReferences?: unknown[] }).mediaReferences ?? []) {
               const id = mediaId(value);
               if (id) ids.push(id);
             }
           }
         }
         const settings = await req.payload.findGlobal({ slug: "site-settings" as GlobalSlug, draft: false, overrideAccess: true, showHiddenFields: true, depth: 0, select: { _status: true, mediaReferences: true }, req }) as { _status?: string; mediaReferences?: unknown[] };
         if (settings._status === "published") {
           for (const value of settings.mediaReferences ?? []) {
             const id = mediaId(value);
             if (id) ids.push(id);
           }
         }
       }
       return { and: [{ verified: { equals: true } }, { id: { in: [...new Set(ids)] } }] } satisfies Where;
    },
  },
  hooks: {
    beforeOperation: [({ args, operation, req }) => {
      if (!["create", "update"].includes(operation)) return args;
      if (!isCmsUser(req.user)) throw new APIError("Sign in to upload journal media.", 403);
      if (operation === "create" && process.env.ARNAUD_BLOG_UPLOADS_ENABLED !== "true") throw new APIError("Journal uploads are not enabled.", 503);
      if (operation === "update" && (req.file || req.query?.uploadEdits)) throw new APIError("Originals are immutable. Upload a new Media item instead.", 400);
      if (operation === "create" && (!req.file?.clientUploadContext || (req.file.clientUploadContext as { prefix?: string }).prefix !== JOURNAL_PREFIX)) throw new APIError("Use the native Media uploader to upload directly to private storage.", 400);
      return args;
    }],
    beforeChange: [async ({ data, originalDoc, operation, req }) => {
      if (operation === "create") {
        const file = req.file!;
        const context = file.clientUploadContext as { _objectKey?: string };
        if (typeof context._objectKey !== "string" || data.filename !== file.name) throw new APIError("The upload identity changed. Select the file again.", 400);
        // Native receipt materialization downloads before createOperation opens its
        // transaction. Hash that local file, never download again inside a hook.
        const source = file.tempFilePath ? createReadStream(file.tempFilePath) : Readable.from([file.data]);
        const verified = await verifyOriginal(source, Number(data.filesize), file.name, file.mimetype);
        return { ...data, mimeType: verified.mimeType, sha256: verified.sha256, verified: true, uploadIdentity: context._objectKey, prefix: JOURNAL_PREFIX };
      }
      // Fileless native updates accept byte-derived metadata too. Expose only
      // descriptive edits; never let a PATCH relabel a verified original.
      return { ...originalDoc, alt: "alt" in data ? data.alt : originalDoc.alt, caption: "caption" in data ? data.caption : originalDoc.caption };
    }],
  },
  fields: [
    { name: "alt", type: "text", maxLength: 500, admin: { description: "Describe the image for people who cannot see it. Required before publishing images." } },
    { name: "caption", type: "textarea", maxLength: 1000 },
    { name: "verified", type: "checkbox", defaultValue: false, admin: { readOnly: true, position: "sidebar" } },
    { name: "sha256", type: "text", access: { read: admin }, admin: { readOnly: true, position: "sidebar" } },
    { name: "uploadIdentity", type: "text", unique: true, index: true, access: { read: admin }, admin: { hidden: true } },
  ],
};

export function journalStorage(enabled: boolean, env: NodeJS.ProcessEnv = process.env): Plugin[] {
  const configured = enabled && Boolean(env.R2_ACCOUNT_ID || env.R2_ACCESS_KEY_ID || env.R2_SECRET_ACCESS_KEY);
  const config = configured ? r2Config(env) : null;
  if (enabled && env.ARNAUD_BLOG_UPLOADS_ENABLED === "true" && !config) throw new Error("Configure private journal R2 storage before enabling uploads.");
  return [s3Storage({
    // The upload flag controls writes, not file delivery. Keep read handlers and
    // receipt enforcement installed when uploads are temporarily switched off.
    enabled: Boolean(config), alwaysInsertFields: true,
    bucket: config?.staging ?? "arnaudbelec-staging",
    collections: { media: { prefix: JOURNAL_PREFIX, signedDownloads: { expiresIn: 60 }, generateFileURL: ({ filename }) => `/api/cms/media/file/${encodeURIComponent(filename)}` } },
    clientUploads: { access: ({ collectionSlug, req }) => env.ARNAUD_BLOG_UPLOADS_ENABLED === "true" && collectionSlug === "media" && isCmsUser(req.user) },
    config: { endpoint: config?.endpoint, credentials: config?.credentials, region: "auto", forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" },
  })];
}
