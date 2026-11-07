import type { PublicPhotograph } from "@/lib/supabase-public";
import { findSimilarPhotographs } from "./similar-colours";

export type PhotoMode = "all" | "colour" | "monochrome";
export type PhotoGroups = { colourPhotoIds: string[]; monochromePhotoIds: string[] };

/** Ambiguous IDs belong only to All; classification never comes from pixels or palettes. */
export function eligiblePhotographs<T extends PublicPhotograph>(
  photographs: T[],
  mode: PhotoMode,
  groups?: PhotoGroups,
): T[] {
  if (mode === "all") return photographs.slice();
  const colour = new Set(groups?.colourPhotoIds ?? []);
  const monochrome = new Set(groups?.monochromePhotoIds ?? []);
  return photographs.filter(({ id }) => mode === "colour"
    ? colour.has(id) && !monochrome.has(id)
    : monochrome.has(id) && !colour.has(id));
}

/** Similarity can fill to five only from the already-eligible presentation group. */
export function selectPresentationPhotographs<T extends PublicPhotograph>(
  eligible: T[],
  source: PublicPhotograph | undefined,
  paletteIndex: number | null,
): T[] {
  if (paletteIndex === null) return eligible.slice();
  if (!source || !eligible.some(({ id }) => id === source.id)) return [];
  return findSimilarPhotographs(source, eligible, paletteIndex, { includeCurrent: true });
}
