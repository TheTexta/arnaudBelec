import type { Post } from "@/payload-types";
import { defaultHomepage, type HomepageSettings } from "./homepage";

export type ProjectKind = "video" | "fashion";

export type PublicMedia = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
};

export type PublicProject = {
  id: string;
  kind: ProjectKind;
  title: string;
  slug: string;
  excerpt: string;
  body: Post["body"];
  cover: PublicMedia | null;
  film: PublicMedia | null;
  gallery: PublicMedia[];
  turntableFrames: PublicMedia[];
  credits: string;
  year: string;
  firstPublishedAt: string | null;
};

export type SiteSettings = {
  homepage: HomepageSettings;
  intro: string;
  contactEmail: string;
  socialLinks: { label: string; url: string }[];
  featuredPhotoId: string | null;
  ambientAudio: PublicMedia | null;
  colourPhotoIds: string[];
  monochromePhotoIds: string[];
  newsletterEnabled: boolean;
};

export const defaultSiteSettings: SiteSettings = {
  homepage: defaultHomepage(),
  intro: "A place for photographs, films and things in progress.",
  contactEmail: "arnaudnaudbel@protonmail.com",
  socialLinks: [],
  featuredPhotoId: null,
  ambientAudio: null,
  colourPhotoIds: [],
  monochromePhotoIds: [],
  newsletterEnabled: false,
};
