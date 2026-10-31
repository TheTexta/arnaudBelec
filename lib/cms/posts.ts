import { randomUUID } from "node:crypto";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, type CollectionBeforeChangeHook, type CollectionConfig, type PayloadRequest } from "payload";
import { assertPublishable, documentMedia, EMPTY_BODY, validateDocument } from "../blog/document";
import { blogStorage, type BlogMedia } from "../blog/storage";
import { isCmsUser } from "./auth";

export const CMS_IMPORT = Symbol("server-only legacy import");

async function transaction(req: PayloadRequest) {
  const id = await req.transactionID;
  const db = id ? req.payload.db.sessions?.[id]?.db : null;
  // Never silently fall back to a separate connection: both stores must commit
  // or roll back together, including autosave and version restoration.
  if (!db) throw new APIError("CMS writes require a database transaction.", 503);
  return db as PostgresAdapter["drizzle"];
}

export const saveJournal: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context, operation }) => {
  if (context.cmsImport === CMS_IMPORT && !req.user) return data;
  if (!isCmsUser(req.user)) throw new APIError("Sign in to Arnaud’s admin.", 403);
  const db = await transaction(req);
  const id = operation === "create" ? randomUUID() : originalDoc.id;
  const document = validateDocument({ title: "Untitled", excerpt: "", body: EMPTY_BODY, ...originalDoc, ...data, slug: data.slug || originalDoc?.slug || `post-${id}` });
  const result = await db.execute(sql`select * from public.arnaud_blog_posts where id = ${id}::uuid for update`);
  const current = result.rows[0];
  if (context.isRestoringVersion === true && current?.first_published_at) document.slug = String(current.slug);
  if (current?.first_published_at && current.slug !== document.slug) throw new APIError("Published post URLs cannot be changed.", 400);
  const restoring = context.isRestoringVersion === true;
  const expected = operation === "create" ? 0 : restoring ? originalDoc.legacyVersion : data.legacyVersion;
  if ((current?.version ?? 0) !== expected) throw new APIError("This post changed in another editor. Reload before saving; your other saved versions are retained.", 409);
  const saved = await db.execute(sql`select * from public.arnaud_save_blog_post(${id}::uuid, ${expected}::integer, ${JSON.stringify(document)}::jsonb, ${req.user!.id}::uuid)`);
  const legacy = saved.rows[0];
  const draft = context.cmsDraftWrite === true || restoring;
  const status = draft ? "draft" : data._status ?? originalDoc?._status ?? "draft";
  if (!draft && status === "published") {
    assertPublishable(document.body);
    const refs = documentMedia(document.body);
    const ids = [...new Set(refs.map(ref => ref.id))];
    const pgIds = `{${ids.join(",")}}`;
    if (ids.length) {
      if (process.env.ARNAUD_BLOG_UPLOADS_ENABLED !== "true") throw new APIError("Journal media uploads are not enabled.", 503);
      const mediaResult = await db.execute(sql`select * from public.arnaud_blog_media where post_id = ${id}::uuid and id = any(${pgIds}::uuid[]) for update`);
      const media = mediaResult.rows as BlogMedia[];
      if (media.length !== ids.length || refs.some(ref => !media.some(item => item.id === ref.id && item.state !== "uploading" && item.content_type.startsWith(`${ref.type}/`)))) throw new APIError("Finish each upload and use media belonging to this post.", 400);
      const storage = blogStorage();
      for (const item of media) {
        if (item.state === "published") continue;
        const etag = await storage.promote(item);
        await db.execute(sql`update public.arnaud_blog_media set state = 'published', published_etag = ${etag} where id = ${item.id}::uuid`);
      }
    }
    await db.execute(sql`select public.arnaud_publish_blog_post(${id}::uuid, ${legacy.version}::integer, ${pgIds}::uuid[])`);
  } else if (!draft && status === "draft" && current?.first_published_at) {
    await db.execute(sql`select public.arnaud_unpublish_blog_post(${id}::uuid, ${legacy.version}::integer)`);
  }
  const publication = await db.execute(sql`select published_at from public.arnaud_blog_publications where id = ${id}::uuid`);
  return { ...data, ...document, id, _status: status, legacyVersion: legacy.version, firstPublishedAt: legacy.first_published_at ?? publication.rows[0]?.published_at ?? null };
};

const admin = ({ req }: { req: PayloadRequest }) => isCmsUser(req.user);
export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Journal post", plural: "Journal" },
  // The row-locked recovery revision is authoritative, including across the
  // legacy rollback interface. Do not add a second advisory-lock lifecycle.
  lockDocuments: false,
  admin: {
    useAsTitle: "title", defaultColumns: ["title", "_status", "updatedAt"], preview: doc => `/cms/preview?id=${doc.id}`,
    components: { edit: {
      UnpublishButton: "/components/cms/UnpublishButton#UnpublishButton",
    } },
  },
  disableBulkEdit: true,
  access: { create: admin, read: admin, update: admin, delete: () => false, readVersions: admin },
  versions: { drafts: { autosave: { interval: 1500 }, validate: true }, maxPerDoc: 0 },
  hooks: {
    beforeOperation: [({ args, operation, req }) => {
      if (["create", "update", "updateByID", "restoreVersion"].includes(operation)) req.context.cmsDraftWrite = "draft" in args && args.draft === true;
      return args;
    }],
    beforeChange: [saveJournal],
  },
  fields: [
    { name: "browserRecovery", type: "ui", admin: { components: { Field: "/components/cms/DraftRecovery#DraftRecovery" } } },
    { name: "title", type: "text", required: true, maxLength: 200, defaultValue: "Untitled" },
    { name: "slug", type: "text", admin: { description: "The public URL is fixed after first publication. Leave blank for a generated draft URL." } },
    { name: "excerpt", type: "textarea", maxLength: 500, defaultValue: "" },
    { name: "body", type: "json", required: true, defaultValue: EMPTY_BODY, admin: { components: { Field: "/components/cms/BlockNoteField#BlockNoteField" } } },
    { name: "legacyVersion", type: "number", defaultValue: 0, admin: { readOnly: true, position: "sidebar", description: "Recovery revision; used to detect concurrent edits." } },
    { name: "firstPublishedAt", type: "date", admin: { readOnly: true, position: "sidebar" } },
  ],
};

export const LegacyRevisions: CollectionConfig = {
  slug: "legacy-revisions",
  admin: { useAsTitle: "sourceKey", description: "Immutable pre-Payload recovery history. Originals remain in Supabase too." },
  access: { read: admin, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "sourceKey", type: "text", required: true, unique: true },
    { name: "postId", type: "text", required: true, index: true },
    { name: "revision", type: "number", required: true },
    { name: "snapshot", type: "json", required: true },
    { name: "savedBy", type: "text", required: true },
    { name: "savedAt", type: "date", required: true },
    { name: "sourceTimestamp", type: "text", required: true, admin: { description: "Exact original Postgres timestamp, including sub-millisecond precision." } },
    { name: "recover", type: "ui", admin: { components: { Field: "/components/cms/RestoreHistory#RestoreHistory" } } },
  ],
};
