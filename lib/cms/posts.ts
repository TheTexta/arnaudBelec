import { randomUUID } from "node:crypto";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, ValidationError, type CollectionBeforeOperationHook, type CollectionBeforeChangeHook, type CollectionConfig, type PayloadRequest } from "payload";
import { isCmsUser } from "./auth";
import { contentMedia } from "./content";
import { hasText } from "@payloadcms/richtext-lexical/shared";
import { siteExpansionEnabled } from "./site-access";
import { mergePagePalette, pagePaletteField, validatePagePalette } from "./page-palette";

const WRITE = Symbol("native journal write");
type Current = { edit_revision: number; first_published_at: string | null; slug: string };
type WriteContext = { token: typeof WRITE; current?: Current; restoring: boolean; statusOnly?: boolean };
// Native createLocalReq drops contexts with no enumerable string keys. Keep a
// named server-only entry, with an unforgeable marker inside, across nested calls.
const state = (req: PayloadRequest) => req.context as { arnaudNativeJournal?: WriteContext };
const admin = ({ req }: { req: PayloadRequest }) => isCmsUser(req.user);

async function transaction(req: PayloadRequest) {
  const id = await req.transactionID;
  const db = id ? req.payload.db.sessions?.[id]?.db : null;
  if (!db) throw new APIError("Journal writes require a database transaction.", 503);
  return db as PostgresAdapter["drizzle"];
}

const beforeOperation: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation === "read" && !isCmsUser(req.user) && "draft" in args) args.draft = false;
  if (!["create", "update", "restoreVersion"].includes(operation)) return args;
  if (!isCmsUser(req.user)) throw new APIError("Sign in to Arnaud’s admin.", 403);
  const restoring = operation === "restoreVersion";
  // 3.92.1 captures restore's draft argument before hooks. The REST adapter sets
  // it first; fail closed for Local API callers whose wrapper drops that flag.
  if (restoring && (!("draft" in args) || args.draft !== true)) throw new APIError("Restore this version as a private draft.", 400);
  state(req).arnaudNativeJournal = { token: WRITE, restoring };
  if (operation === "create") return args;
  const db = await transaction(req);
  const id = "id" in args ? args.id : undefined;
  const result = restoring
    ? await db.execute(sql`select p.edit_revision, p.first_published_at, p.slug from arnaud_cms.posts p join arnaud_cms._posts_v v on v.parent_id = p.id where v.id = ${id}::uuid for update of p`)
    : await db.execute(sql`select edit_revision, first_published_at, slug from arnaud_cms.posts where id = ${id}::uuid for update`);
  const row = result.rows[0];
  if (!row) throw new APIError("This journal post no longer exists. Return to the post list.", 404);
  // Payload number columns are numeric, which raw node-pg decodes as strings.
  // Decode at this adapter seam; never globally change PostgreSQL parsers.
  const revision = Number(row.edit_revision);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new APIError("The journal revision is invalid.", 503);
  const current: Current = { edit_revision: revision, first_published_at: row.first_published_at as string | null, slug: String(row.slug) };
  const data = "data" in args ? args.data as Record<string, unknown> : {};
  // Native Unpublish is a status-only command against the latest document, not
  // a stale form replacement. Restore explicitly selects a historical version.
  const statusOnly = Object.keys(data).length === 1 && data._status === "draft";
  if (!restoring && !statusOnly && data.editRevision !== current.edit_revision) throw new APIError("This post changed in another tab. Reload before saving; saved versions are retained.", 409);
  state(req).arnaudNativeJournal = { token: WRITE, current, restoring, statusOnly };
  return args;
};

const beforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  const write = state(req).arnaudNativeJournal;
  if (!write || write.token !== WRITE) throw new APIError("The journal write was not initialized.", 503);
  const current = write.current;
  const firstPublishedAt = current?.first_published_at ?? null;
  const slug = data.slug || originalDoc?.slug || `post-${randomUUID()}`;
  if (firstPublishedAt && current?.slug !== slug && !write.restoring) throw new ValidationError({ collection: "posts", errors: [{ path: "slug", message: "A published post’s URL cannot be changed." }], req });
  data.slug = firstPublishedAt && write.restoring ? current!.slug : slug;
  data.firstPublishedAt = firstPublishedAt || (data._status === "published" && !write.restoring ? new Date().toISOString() : null);
  // Unpublish applies status to latest saved content, not a form replacement.
  // It must not advance the content token: stock Payload resets from its last
  // saved props. Actual autosaves, Publish and Restore do advance the token.
  data.editRevision = (current?.edit_revision ?? 0) + (write.statusOnly ? 0 : 1);
  const body = data.body ?? originalDoc?.body;
  if (siteExpansionEnabled()) {
    const palette = mergePagePalette(originalDoc?.palette, data.palette);
    if (data.palette !== undefined) data.palette = palette;
    const validation = validatePagePalette(palette);
    if (data._status === "published" && !write.restoring && validation !== true) throw new ValidationError({ collection: "posts", errors: [{ path: "palette", message: validation }], req });
  }
  try {
    data.mediaReferences = body ? contentMedia(body) : [];
    if (data._status === "published" && !write.restoring) {
      if (!body) throw new Error("Write a journal entry before publishing.");
      const ids = data.mediaReferences as string[];
      if (!ids.length && !hasText(body)) throw new Error("Write something or insert verified media before publishing.");
      if (ids.length) {
        const media = await req.payload.find({ collection: "media", where: { id: { in: ids } }, pagination: false, depth: 0, overrideAccess: true, req });
        if (media.docs.length !== ids.length || media.docs.some(item => !item.verified || !item.sha256)) throw new Error("Finish verifying every media upload before publishing.");
        if (media.docs.some(item => item.mimeType?.startsWith("image/") && !item.alt?.trim())) throw new Error("Add an image description in the Media library before publishing.");
      }
    }
  } catch (error) {
    throw new ValidationError({ collection: "posts", errors: [{ path: "body", message: (error as Error).message }], req });
  }
  if (operation !== "create" && !write.statusOnly) {
    const db = await transaction(req);
    // Only concurrency metadata changes on the main row during a private save.
    // Native Payload alone owns body/status/version persistence.
    await db.execute(sql`update arnaud_cms.posts set edit_revision = ${data.editRevision} where id = ${originalDoc.id}::uuid`);
  }
  return data;
};

export const Posts: CollectionConfig = {
  slug: "posts", labels: { singular: "Journal post", plural: "Journal" },
  lockDocuments: { duration: 300 }, disableBulkEdit: true,
  admin: { useAsTitle: "title", defaultColumns: ["title", "_status", "updatedAt"], preview: doc => `/cms/preview?id=${doc.id}`,
    components: { edit: { UnpublishButton: "/components/cms/NativeUnpublish#NativeUnpublish" } } },
  access: { create: admin, update: admin, delete: () => false, readVersions: admin, read: ({ req }) => isCmsUser(req.user) ? true : { _status: { equals: "published" } } },
  versions: { drafts: { autosave: { interval: 1500 } }, maxPerDoc: 0 },
  hooks: { beforeOperation: [beforeOperation], beforeChange: [beforeChange] },
  fields: [
    ...(siteExpansionEnabled() ? [pagePaletteField()] : []),
    { name: "title", type: "text", required: true, maxLength: 200, defaultValue: "Untitled" },
    { name: "slug", type: "text", required: true, unique: true, index: true, maxLength: 100,
      validate: (value: string | null | undefined) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || "Use lowercase letters, numbers and hyphens.",
      admin: { description: "Generated for drafts when blank. Fixed after first publication." } },
    { name: "excerpt", type: "textarea", maxLength: 500 },
    { name: "body", type: "richText", required: true },
    { name: "editRevision", type: "number", defaultValue: 0, required: true, access: { read: admin }, admin: { readOnly: true, position: "sidebar", description: "Native journal revision; prevents stale editor saves." } },
    { name: "firstPublishedAt", type: "date", admin: { readOnly: true, position: "sidebar" } },
    { name: "mediaReferences", type: "relationship", relationTo: "media", hasMany: true, hidden: true, access: { read: admin } },
  ],
};
