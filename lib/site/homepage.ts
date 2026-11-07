import type { PublicPhotograph } from "../supabase-public";
import type { PublicMedia } from "./types";

export const HOME_SECTIONS = [
  { key: "photography", label: "Photography", href: "/photos" },
  { key: "journal", label: "Journal", href: "/blog" },
  { key: "video", label: "Video", href: "/video" },
  { key: "fashion", label: "Fashion", href: "/fashion" },
] as const;
export type HomeSection = typeof HOME_SECTIONS[number]["key"];
export type HomePalette = { fluidA: string; fluidB: string; background: string };
export type HomeImage = { source: "none" | "photograph" | "media"; photographId: string | null; image: PublicMedia | null };
export type HomepageSettings = { palette: HomePalette } & Record<HomeSection, HomeImage>;
export const DEFAULT_HOME_PALETTE: HomePalette = { fluidA: "#ff278f", fluidB: "#ffe52f", background: "#c8e6ff" };
export const validHexColour = (value: unknown): value is string => typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
export const emptyHomeImage = (): HomeImage => ({ source: "none", photographId: null, image: null });
export const defaultHomepage = (): HomepageSettings => ({
  palette: { ...DEFAULT_HOME_PALETTE }, photography: emptyHomeImage(), journal: emptyHomeImage(), video: emptyHomeImage(), fashion: emptyHomeImage(),
});

export function homePalette(value: unknown): HomePalette {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(DEFAULT_HOME_PALETTE).map(([key, fallback]) => [key, validHexColour(raw[key]) ? raw[key].toLowerCase() : fallback])) as HomePalette;
}

// Labels sit on the chosen solid filler, not an unpredictable moving pigment.
export function homeInk(background: string) {
  const channels = [1, 3, 5].map(offset => parseInt(background.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function homeFallback(palette: HomePalette) {
  return `radial-gradient(ellipse at 12% 28%, ${palette.fluidA} 0%, ${palette.fluidA} 14%, transparent 49%), radial-gradient(ellipse at 83% 72%, ${palette.fluidB} 0%, ${palette.fluidB} 19%, transparent 56%), radial-gradient(ellipse at 74% 5%, ${palette.fluidA} 0%, transparent 47%)`;
}

export function homePreview(choice: HomeImage, photographs: PublicPhotograph[]) {
  if (choice.source === "photograph") {
    const photo = photographs.find(item => item.id === choice.photographId);
    return photo ? { src: photo.src, alt: photo.altText || photo.title || "Photograph by Arnaud Belec", width: photo.width, height: photo.height, native: false } : null;
  }
  const media = choice.source === "media" ? choice.image : null;
  return media?.mimeType.startsWith("image/") ? { src: media.url, alt: media.alt, width: media.width || 1200, height: media.height || 800, native: true } : null;
}
