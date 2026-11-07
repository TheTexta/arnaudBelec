import type { CollectionSlug, GlobalSlug } from "payload";
import { cache } from "react";
import { getCms } from "../cms/client";
import { projectCollections, siteExpansionEnabled } from "../cms/site-access";
import { defaultSiteSettings, type ProjectKind, type PublicMedia, type PublicProject, type SiteSettings } from "./types";
import { HOME_SECTIONS, defaultHomepage, homePalette } from "./homepage";

type Raw = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : "";
const object = (value: unknown): Raw => value && typeof value === "object" ? value as Raw : {};

export function toPublicMedia(value: unknown): PublicMedia | null {
  const media = object(value);
  if (media.verified !== true || !text(media.id) || !text(media.filename) || !text(media.mimeType)) return null;
  // Never serialize storage keys, signed URLs, hashes or arbitrary file URLs.
  return {
    id: text(media.id), url: `/api/cms/media/file/${encodeURIComponent(text(media.filename))}`,
    filename: text(media.filename), mimeType: text(media.mimeType), alt: text(media.alt), caption: text(media.caption),
    width: typeof media.width === "number" ? media.width : null, height: typeof media.height === "number" ? media.height : null,
  };
}
const mediaList = (value: unknown) => Array.isArray(value) ? value.flatMap(item => { const media = toPublicMedia(item); return media ? [media] : []; }) : [];

function publicBody(value: unknown): PublicProject["body"] {
  const body = structuredClone(value ?? { root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [] } });
  function visit(value: unknown) {
    const node = object(value);
    if (node.type === "upload") node.value = node.relationTo === "media" ? toPublicMedia(node.value) : null;
    if (Array.isArray(node.children)) node.children.forEach(visit);
  }
  visit(object(body).root);
  return body as PublicProject["body"];
}

export function toPublicProject(value: unknown, kind: ProjectKind): PublicProject {
  const raw = object(value);
  return {
    id: text(raw.id), kind, title: text(raw.title), slug: text(raw.slug), excerpt: text(raw.excerpt),
    body: publicBody(raw.body),
    cover: toPublicMedia(raw.cover), film: toPublicMedia(raw.film), gallery: mediaList(raw.gallery), turntableFrames: mediaList(raw.turntableFrames),
    credits: text(raw.credits), year: text(raw.year), firstPublishedAt: text(raw.firstPublishedAt) || null,
  };
}

export async function getPublicProjects(kind: ProjectKind): Promise<PublicProject[]> {
  if (!siteExpansionEnabled()) return [];
  const cms = await getCms();
  const result = await cms.find({
    collection: projectCollections[kind] as CollectionSlug, draft: false, overrideAccess: false, user: null,
    where: { _status: { equals: "published" } }, sort: "-firstPublishedAt,-id", limit: 100, depth: 1,
    select: { title: true, slug: true, excerpt: true, cover: true, year: true, firstPublishedAt: true },
  });
  return result.docs.map(doc => toPublicProject(doc, kind));
}

export async function getPublicProject(kind: ProjectKind, slug: string): Promise<PublicProject | null> {
  if (!siteExpansionEnabled() || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const cms = await getCms();
  const result = await cms.find({
    collection: projectCollections[kind] as CollectionSlug, draft: false, overrideAccess: false, user: null,
    where: { and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }] }, limit: 1, depth: 1,
  });
  return result.docs[0] ? toPublicProject(result.docs[0], kind) : null;
}

export function toPublicSiteSettings(value: unknown): SiteSettings {
  const raw = object(value);
  const home = object(raw.homepage);
  const homepage = defaultHomepage();
  homepage.palette = homePalette(home.palette);
  for (const { key } of HOME_SECTIONS) {
    const choice = object(home[key]);
    const source = choice.source === "photograph" || choice.source === "media" ? choice.source : "none";
    const image = source === "media" ? toPublicMedia(choice.image) : null;
    homepage[key] = { source, photographId: source === "photograph" ? text(choice.photographId) || null : null, image: image?.mimeType.startsWith("image/") ? image : null };
  }
  const photoIds = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(item => text(object(item).photographId)).filter(Boolean))] : [];
  return {
    homepage,
    intro: typeof raw.intro === "string" ? raw.intro : defaultSiteSettings.intro,
    contactEmail: typeof raw.contactEmail === "string" ? raw.contactEmail : defaultSiteSettings.contactEmail,
    socialLinks: Array.isArray(raw.socialLinks) ? raw.socialLinks.map(item => ({ label: text(object(item).label), url: text(object(item).url) })) : [],
    featuredPhotoId: text(raw.featuredPhotoId) || null, ambientAudio: toPublicMedia(raw.ambientAudio),
    colourPhotoIds: photoIds(raw.colourPhotoIds), monochromePhotoIds: photoIds(raw.monochromePhotoIds), newsletterEnabled: raw.newsletterEnabled === true,
  };
}

export const getPublicSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!siteExpansionEnabled()) return structuredClone(defaultSiteSettings);
  const cms = await getCms();
  const result = await cms.findGlobal({ slug: "site-settings" as GlobalSlug, draft: false, overrideAccess: false, user: null, depth: 1 }) as unknown as Raw;
  // A never-published/unpublished global is an empty result, not a draft fallback.
  return result._status === "published" ? toPublicSiteSettings(result) : structuredClone(defaultSiteSettings);
});
