import { sql } from "@payloadcms/db-postgres";
import { APIError, ValidationError, type GlobalConfig, type GlobalSlug, type PayloadRequest } from "payload";
import { isCmsUser } from "./auth";
import { editRevision, siteTransaction } from "./projects";
import { mediaId, requireSiteExpansion, siteAdmin, siteExpansionEnabled, siteRead, validateSiteMedia } from "./site-access";
import { defaultSiteSettings } from "../site/types";
import { homepageField, homepageMediaUses, homepagePhotographs, HomepageValidationError, mergeHomepage } from "./homepage";
import { mergeVideoPage, validateVideoPage, videoPageField } from "./video-page";

const WRITE = Symbol("native settings write");
const RESTORE = Symbol("private settings restore");
type Write = { token: typeof WRITE; revision: number; statusOnly: boolean; restoring: boolean };
const state = (req: PayloadRequest) => req.context as { arnaudSettings?: Write; arnaudSettingsRestore?: typeof RESTORE };
const settingsSlug = "site-settings" as GlobalSlug;
export const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const validPhotoId = (value: unknown) => !value || uuid(value) || "Use a photograph UUID.";
export function validContactEmail(value: unknown) {
  return !value || (typeof value === "string" && /^[^\s<>@:]+@[^\s<>@:]+\.[^\s<>@:]+$/.test(value)) || "Enter an email address without a mailto: prefix.";
}
export function validSocialUrl(value: unknown) {
  if (typeof value !== "string" || !value || /[\s\u0000-\u001f\u007f]/.test(value)) return "Use an https:// or mailto: link.";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname && !url.username && !url.password) return true;
    if (url.protocol === "mailto:" && url.pathname && !url.search && !url.hash && validContactEmail(decodeURIComponent(url.pathname)) === true) return true;
  } catch { /* Invalid URL: return the same field error below. */ }
  return "Use an https:// or mailto: link.";
}

// Global native restore bypasses beforeChange and replaces the main document,
// even with draft:true. Use the standard update path instead, keeping Payload's
// own versions and published snapshot. Only this server symbol bypasses stale
// form comparison for a deliberate historical selection.
export async function restoreSiteSettingsVersion(req: PayloadRequest, id: string) {
  requireSiteExpansion();
  if (!isCmsUser(req.user)) throw new APIError("Sign in to Arnaud’s admin.", 403);
  if (!uuid(id)) throw new APIError("Select a settings version.", 400);
  const selected = await req.payload.findGlobalVersionByID({ slug: settingsSlug, id, depth: 0, overrideAccess: false, req });
  const version = selected.version as unknown as Record<string, unknown>;
  const data = Object.fromEntries(SiteSettings.fields.flatMap(field => "name" in field && !["editRevision", "mediaReferences", "_status"].includes(field.name) ? [[field.name, version[field.name]]] : []));
  state(req).arnaudSettingsRestore = RESTORE;
  try {
    return await req.payload.updateGlobal({ slug: settingsSlug, draft: true, overrideAccess: false, data: { ...data, _status: "draft" } as never, req });
  } finally {
    delete state(req).arnaudSettingsRestore;
  }
}

export const SiteSettings: GlobalConfig = {
  slug: "site-settings", label: "Site settings", lockDocuments: siteExpansionEnabled() ? { duration: 300 } : false,
  admin: { hidden: () => !siteExpansionEnabled(), preview: () => "/cms/video-page-preview", components: { elements: { UnpublishButton: "/components/cms/NativeUnpublish#NativeUnpublish" } } },
  access: { read: siteRead, update: siteAdmin, readVersions: siteAdmin },
  versions: { drafts: { autosave: { interval: 1500 } }, max: 0 },
  endpoints: [{ path: "/homepage-photographs", method: "get", handler: homepagePhotographs }, { path: "/versions/:id", method: "post", handler: async req => {
    const doc = await restoreSiteSettingsVersion(req, String(req.routeParams?.id ?? ""));
    return Response.json({ doc, message: "Restored as a private draft." });
  } }],
  hooks: {
    beforeOperation: [async ({ args, operation, req }) => {
      requireSiteExpansion();
      // findOne captures its draft flag before hooks; do not rely on mutating it.
      if (operation === "read" && !isCmsUser(req.user) && args?.draft) throw new APIError("Settings drafts are private.", 403);
      if (operation === "restoreVersion") throw new APIError("Use the private Site Settings restore endpoint.", 400);
      if (operation !== "update") return args;
      if (!isCmsUser(req.user)) throw new APIError("Sign in to Arnaud’s admin.", 403);
      const db = await siteTransaction(req);
      // The first draft may exist only in versions, before a main row exists.
      // Serialize that first-save case too, without creating a public skeleton.
      await db.execute(sql`select pg_advisory_xact_lock(617204, 1)`);
      const main = await db.execute(sql`select edit_revision from arnaud_cms.site_settings for update`);
      const history = await db.execute(sql`select coalesce(max(version_edit_revision), 0) as revision from arnaud_cms._site_settings_v`);
      const revision = Math.max(editRevision(main.rows[0]?.edit_revision ?? 0), editRevision(history.rows[0]?.revision ?? 0));
      const data = (args?.data ?? {}) as Record<string, unknown>;
      const statusOnly = Object.keys(data).length === 1 && data._status === "draft";
      const restoring = state(req).arnaudSettingsRestore === RESTORE;
      if (!restoring && !statusOnly && (data.editRevision ?? 0) !== revision) throw new APIError("Site settings changed in another tab. Reload before saving; saved versions are retained.", 409);
      state(req).arnaudSettings = { token: WRITE, revision, statusOnly, restoring };
      return args;
    }],
    beforeChange: [async ({ data, originalDoc, req }) => {
      requireSiteExpansion();
      const write = state(req).arnaudSettings;
      if (!write || write.token !== WRITE) throw new APIError("The settings write was not initialized.", 503);
      data.editRevision = write.revision + (write.statusOnly ? 0 : 1);
      if (write.restoring) data._status = "draft";
      const merged = { ...originalDoc, ...data };
      merged.homepage = mergeHomepage(originalDoc?.homepage, data.homepage);
      if (data.homepage) data.homepage = merged.homepage;
      merged.videoPage = mergeVideoPage(originalDoc?.videoPage, data.videoPage);
      if (data.videoPage !== undefined) data.videoPage = merged.videoPage;
      const publishing = data._status === "published" && !write.restoring;
      let validationPath = "ambientAudio";
      try {
        const audio = mediaId(merged.ambientAudio);
        if (merged.ambientAudio && !audio) throw new APIError("Select verified audio from the Media library.", 400);
        const homeUses = await homepageMediaUses(merged.homepage, publishing);
        const audioReferences = await validateSiteMedia(req, audio ? [{ id: audio, kind: "audio" }] : [], publishing);
        validationPath = "homepage";
        const imageReferences = await validateSiteMedia(req, homeUses, publishing);
        data.mediaReferences = [...new Set([...audioReferences, ...imageReferences])];
        // Draft field validation is skipped natively, but publication must check
        // every merged field, including values inherited from a prior autosave.
        if (publishing) {
          validationPath = "videoPage";
          await validateVideoPage(merged.videoPage, req);
          validationPath = "contactEmail";
          if (validContactEmail(merged.contactEmail) !== true) throw new APIError("Enter a valid contact email.", 400);
          if (merged.featuredPhotoId && !uuid(merged.featuredPhotoId)) throw new APIError("Use a photograph UUID for the featured image.", 400);
          for (const field of ["colourPhotoIds", "monochromePhotoIds"]) {
            for (const item of merged[field] ?? []) if (!uuid(item.photographId)) throw new APIError("Use photograph UUIDs in curated lists.", 400);
          }
          for (const link of merged.socialLinks ?? []) if (!link.label?.trim() || validSocialUrl(link.url) !== true) throw new APIError("Add a label and safe URL for every social link.", 400);
        }
      } catch (error) {
        if (!(error instanceof APIError) || error.status !== 400) throw error;
        throw new ValidationError({ global: "site-settings", errors: [{ path: error instanceof HomepageValidationError ? error.path : validationPath, message: (error as Error).message }], req });
      }
      return data;
    }],
  },
  fields: [
    homepageField,
    videoPageField,
    { name: "intro", type: "textarea", maxLength: 5000, defaultValue: defaultSiteSettings.intro },
    { name: "contactEmail", type: "text", maxLength: 320, defaultValue: defaultSiteSettings.contactEmail, validate: validContactEmail },
    { name: "socialLinks", type: "array", maxRows: 50, fields: [
      { name: "label", type: "text", required: true, maxLength: 100 },
      { name: "url", type: "text", required: true, maxLength: 2048, validate: validSocialUrl },
    ] },
    { name: "featuredPhotoId", type: "text", validate: validPhotoId },
    { name: "ambientAudio", type: "upload", relationTo: "media", filterOptions: { mimeType: { contains: "audio/" } } },
    ...["colourPhotoIds", "monochromePhotoIds"].map(name => ({ name, type: "array" as const, maxRows: 10000, fields: [{ name: "photographId", type: "text" as const, required: true, validate: validPhotoId }] })),
    { name: "newsletterEnabled", type: "checkbox", defaultValue: false },
    { name: "editRevision", type: "number", defaultValue: 0, required: true, access: { read: siteAdmin }, admin: { readOnly: true, position: "sidebar" } },
    { name: "mediaReferences", type: "relationship", relationTo: "media", hasMany: true, hidden: true, access: { read: siteAdmin } },
  ],
};
