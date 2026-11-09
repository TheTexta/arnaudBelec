import type { Post } from "@/payload-types";
import { defaultHomepage, type HomepageSettings } from "./homepage";
import type { PagePalette } from "./page-palette";
import type { VideoSource } from "../media/youtube";

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
  videoSource: VideoSource;
  youtubeId: string | null;
  palette: PagePalette | null;
  gallery: PublicMedia[];
  turntableFrames: PublicMedia[];
  credits: string;
  year: string;
  firstPublishedAt: string | null;
};

export type SiteSettings = {
  homepage: HomepageSettings;
  videoPage: VideoPageSettings;
  intro: string;
  contactEmail: string;
  socialLinks: { label: string; url: string }[];
  featuredPhotoId: string | null;
  ambientAudio: PublicMedia | null;
  colourPhotoIds: string[];
  monochromePhotoIds: string[];
  newsletterEnabled: boolean;
};

export type VideoPageSettings = {
  heading: string;
  intro: string;
  featuredVideoId: string | null;
  orderedVideoIds: string[];
};

export const defaultSiteSettings: SiteSettings = {
  homepage: defaultHomepage(),
  videoPage: { heading: "Video", intro: "", featuredVideoId: null, orderedVideoIds: [] },
  intro: "A place for photographs, films and things in progress.",
  contactEmail: "arnaudnaudbel@protonmail.com",
  socialLinks: [],
  featuredPhotoId: null,
  ambientAudio: null,
  colourPhotoIds: [],
  monochromePhotoIds: [],
  newsletterEnabled: false,
};
