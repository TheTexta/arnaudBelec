import type { CSSProperties } from "react";
import { colourContrast, paletteInk, type PagePalette } from "./page-palette";
import { atmosphereProfile } from "../visual/atmosphere";

export function paletteStyle(palette: PagePalette | null): CSSProperties | undefined {
  if (!palette) return undefined;
  const ink = paletteInk(palette.background);
  const surfaces = [palette.background, ...atmosphereProfile("fashion", palette).colours];
  const accent = surfaces.every(surface => colourContrast(surface, palette.accent) >= 4.65) ? palette.accent : ink;
  return {
    "--page-background": palette.background, "--page-ink": ink, "--page-accent": accent,
    "--site-ink": ink, "--site-muted": ink, "--site-accent": accent,
    "--journal-paper": palette.background, "--journal-panel": palette.background,
    "--journal-ink": ink, "--journal-muted": ink, "--journal-title": accent,
    "--journal-line": ink, "--journal-accent": accent,
    backgroundColor: palette.background, color: ink, colorScheme: ink === "#000000" ? "light" : "dark",
  } as CSSProperties;
}
