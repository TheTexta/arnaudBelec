import { randomUUID } from "node:crypto";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { hasText } from "@payloadcms/richtext-lexical/shared";
import { APIError, ValidationError, type CollectionConfig, type CollectionBeforeOperationHook, type CollectionBeforeChangeHook, type PayloadRequest } from "payload";
import { isCmsUser } from "./auth";
import { contentMedia } from "./content";
import { mediaId, requireSiteExpansion, siteAdmin, siteExpansionEnabled, siteRead, validateSiteMedia, type MediaUse } from "./site-access";

const WRITE = Symbol("native project write");
type Current = { edit_revision: number; first_published_at: string | null; slug: string };
type Write = { token: typeof WRITE; current?: Current; restoring: boolean; statusOnly?: boolean };
const state = (req: PayloadRequest) => req.context as { arnaudProject?: Write };

export async function siteTransaction(req: PayloadRequest) {
  const id = await req.transactionID;
  const db = id ? req.payload.db.sessions?.[id]?.db : null;
  if (!db) throw new APIError("Site writes require a database transaction.", 503);
  return db as PostgresAdapter["drizzle"];
}
export function editRevision(value: unknown) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new APIError("The content revision is invalid.", 503);
  return revision;
}

export function projectMediaUses(data: Record<string, unknown>): MediaUse[] {
  const uses: MediaUse[] = [];
  for (const [field, kind] of [["cover", "image"], ["film", "video"], ["gallery", "image"], ["turntableFrames", "image"]] as const) {
    const values = Array.isArray(data[field]) ? data[field] as unknown[] : [data[field]];
    for (const value of values) {
      if (value == null || value === "") continue;
      const id = mediaId(value);
      if (!id) throw new APIError(`Select verified media for ${field}.`, 400);
      uses.push({ id, kind });
    }
  }
  if (data.body) uses.push(...contentMedia(data.body).map(id => ({ id })));
  return uses;
}

function projectCollection(slug: "videos" | "fashion-projects"): CollectionConfig {
  // Identifiers are fixed schema constants, never request input.
  const table = sql.raw(`arnaud_cms.${slug === "videos" ? "videos" : "fashion_projects"}`);
  const versions = sql.raw(`arnaud_cms.${slug === "videos" ? "_videos_v" : "_fashion_projects_v"}`);
  const beforeOperation: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
    requireSiteExpansion();
    if (operation === "read" && !isCmsUser(req.user) && "draft" in args) args.draft = false;
    if (!["create", "update", "restoreVersion"].includes(operation)) return args;
    if (!isCmsUser(req.user)) throw new APIError("Sign in to Arnaud’s admin.", 403);
    const restoring = operation === "restoreVersion";
    if (restoring && (!("draft" in args) || args.draft !== true)) throw new APIError("Restore this version as a private draft.", 400);
    state(req).arnaudProject = { token: WRITE, restoring };
    if (operation === "create") return args;
    const db = await siteTransaction(req);
    const id = "id" in args ? args.id : undefined;
    const result = restoring
      ? await db.execute(sql`select p.edit_revision, p.first_published_at, p.slug from ${table} p join ${versions} v on v.parent_id = p.id where v.id = ${id}::uuid for update of p`)
      : await db.execute(sql`select edit_revision, first_published_at, slug from ${table} where id = ${id}::uuid for update`);
    const row = result.rows[0];
    if (!row) throw new APIError("This project no longer exists. Return to the project list.", 404);
    const current: Current = { edit_revision: editRevision(row.edit_revision), first_published_at: row.first_published_at as string | null, slug: String(row.slug) };
    const data = "data" in args ? args.data as Record<string, unknown> : {};
    const statusOnly = Object.keys(data).length === 1 && data._status === "draft";
    if (!restoring && !statusOnly && data.editRevision !== current.edit_revision) throw new APIError("This project changed in another tab. Reload before saving; saved versions are retained.", 409);
    state(req).arnaudProject = { token: WRITE, current, restoring, statusOnly };
    return args;
  };
  const beforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
    requireSiteExpansion();
    const write = state(req).arnaudProject;
    if (!write || write.token !== WRITE) throw new APIError("The project write was not initialized.", 503);
    const current = write.current;
    const firstPublishedAt = current?.first_published_at ?? null;
    const nextSlug = data.slug || originalDoc?.slug || `project-${randomUUID()}`;
    if (firstPublishedAt && current?.slug !== nextSlug && !write.restoring) throw new ValidationError({ collection: slug, errors: [{ path: "slug", message: "A published project’s URL cannot be changed." }], req });
    data.slug = firstPublishedAt && write.restoring ? current!.slug : nextSlug;
    const publishing = data._status === "published" && !write.restoring;
    data.firstPublishedAt = firstPublishedAt || (publishing ? new Date().toISOString() : null);
    data.editRevision = (current?.edit_revision ?? 0) + (write.statusOnly ? 0 : 1);
    try {
      const merged = { ...originalDoc, ...data };
      const uses = projectMediaUses(merged);
      data.mediaReferences = await validateSiteMedia(req, uses, publishing);
      if (publishing && !uses.length && (!merged.body || !hasText(merged.body))) throw new APIError("Add text or verified media before publishing.", 400);
    } catch (error) {
      if (!(error instanceof APIError) || error.status !== 400) throw error;
      throw new ValidationError({ collection: slug, errors: [{ path: "body", message: (error as Error).message }], req });
    }
    if (operation !== "create" && !write.statusOnly) {
      const db = await siteTransaction(req);
      await db.execute(sql`update ${table} set edit_revision = ${data.editRevision} where id = ${originalDoc.id}::uuid`);
    }
    return data;
  };
  return {
    slug, labels: slug === "videos" ? { singular: "Video", plural: "Videos" } : { singular: "Fashion project", plural: "Fashion projects" },
    // Avoid extending Payload's shared lock relationship (and querying its new
    // columns) while the expansion migration has not yet been enabled.
    lockDocuments: siteExpansionEnabled() ? { duration: 300 } : false, disableBulkEdit: true,
    admin: { hidden: () => !siteExpansionEnabled(), useAsTitle: "title", defaultColumns: ["title", "_status", "updatedAt"], preview: doc => `/cms/project-preview?collection=${slug}&id=${encodeURIComponent(String(doc.id))}`,
      components: { edit: { UnpublishButton: "/components/cms/NativeUnpublish#NativeUnpublish" } } },
    access: { create: siteAdmin, update: siteAdmin, delete: () => false, readVersions: siteAdmin, read: siteRead },
    versions: { drafts: { autosave: { interval: 1500 } }, maxPerDoc: 0 },
    hooks: { beforeOperation: [beforeOperation], beforeChange: [beforeChange] },
    fields: [
      { name: "title", type: "text", required: true, defaultValue: "Untitled", maxLength: 200 },
      { name: "slug", type: "text", required: true, unique: true, index: true, maxLength: 100,
        validate: (value: string | null | undefined) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || "Use lowercase letters, numbers and hyphens.",
        admin: { description: "Generated for drafts when blank. Fixed after first publication." } },
      { name: "excerpt", type: "textarea", maxLength: 500 },
      { name: "body", type: "richText" },
      { name: "cover", type: "upload", relationTo: "media", filterOptions: { mimeType: { contains: "image/" } } },
      { name: "film", type: "upload", relationTo: "media", filterOptions: { mimeType: { contains: "video/" } } },
      { name: "gallery", type: "upload", relationTo: "media", hasMany: true, filterOptions: { mimeType: { contains: "image/" } } },
      { name: "turntableFrames", type: "upload", relationTo: "media", hasMany: true, filterOptions: { mimeType: { contains: "image/" } }, admin: { description: "Frames play in this order." } },
      { name: "credits", type: "textarea", maxLength: 5000 },
      { name: "year", type: "text", maxLength: 20 },
      { name: "editRevision", type: "number", defaultValue: 0, required: true, access: { read: siteAdmin }, admin: { readOnly: true, position: "sidebar" } },
      { name: "firstPublishedAt", type: "date", admin: { readOnly: true, position: "sidebar" } },
      { name: "mediaReferences", type: "relationship", relationTo: "media", hasMany: true, hidden: true, access: { read: siteAdmin } },
    ],
  };
}

export const Videos = projectCollection("videos");
export const FashionProjects = projectCollection("fashion-projects");
