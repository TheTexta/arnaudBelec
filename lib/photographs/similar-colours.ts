import type { PaletteColour, PublicPhotograph } from "@/lib/supabase-public";

const SIMILARITY_THRESHOLD = 20;
const MINIMUM_MATCHES = 5;
const MAXIMUM_PALETTE_SIZE = 7;
const MONOCHROME_CHROMA_THRESHOLD = 1;

function validColours(palette: PaletteColour[] | null | undefined): PaletteColour[] {
  if (!Array.isArray(palette)) return [];

  return palette.filter((colour) =>
    colour !== null &&
    typeof colour === "object" &&
    Number.isFinite(colour.labL) &&
    Number.isFinite(colour.labA) &&
    Number.isFinite(colour.labB),
  );
}

function isMonochrome(colours: PaletteColour[]): boolean {
  const meanSquaredChroma = colours.reduce(
    (sum, colour) => sum + colour.labA ** 2 + colour.labB ** 2,
    0,
  ) / colours.length;

  return Math.sqrt(meanSquaredChroma) <= MONOCHROME_CHROMA_THRESHOLD;
}

function squaredLabDistance(first: PaletteColour, second: PaletteColour): number {
  return (first.labL - second.labL) ** 2 +
    (first.labA - second.labA) ** 2 +
    (first.labB - second.labB) ** 2;
}

function singleColourDistance(selected: PaletteColour, candidates: PaletteColour[]): number {
  return Math.sqrt(Math.min(
    ...candidates.map((candidate) => squaredLabDistance(selected, candidate)),
  ));
}

export function paletteDistance(first: PaletteColour[], second: PaletteColour[]): number {
  if (!first.length || !second.length || Math.max(first.length, second.length) > MAXIMUM_PALETTE_SIZE) return Infinity;
  // Match every colour in the larger palette, reusing smaller-palette swatches
  // only when necessary. Requiring the full mask prevents convenient subsets.
  const [selected, candidates] = first.length >= second.length ? [first, second] : [second, first];
  const completeMask = (1 << candidates.length) - 1;
  const allowReuse = selected.length > candidates.length;
  const bestByUsedMask = new Map<number, number>();

  function smallestRemainingDistance(index: number, usedMask: number): number {
    if (index === selected.length) return usedMask === completeMask ? 0 : Infinity;

    const key = index * (completeMask + 1) + usedMask;
    const cached = bestByUsedMask.get(key);
    if (cached !== undefined) return cached;

    let best = Number.POSITIVE_INFINITY;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidateBit = 1 << candidateIndex;
      if (!allowReuse && (usedMask & candidateBit)) continue;

      best = Math.min(
        best,
        squaredLabDistance(selected[index], candidates[candidateIndex]) +
          smallestRemainingDistance(index + 1, usedMask | candidateBit),
      );
    }

    bestByUsedMask.set(key, best);
    return best;
  }

  return Math.sqrt(smallestRemainingDistance(0, 0) / selected.length);
}

/**
 * Finds photographs with similar palettes. Pass `null` to compare all stored
 * swatches, or a zero-based palette index to compare one selected swatch.
 * Empty or oversized palettes are omitted; no match returns an empty array.
 * Detail pages exclude the current photo by default; the homepage includes it.
 */
export function findSimilarPhotographs<T extends PublicPhotograph>(
  current: PublicPhotograph,
  candidates: T[],
  selectedPaletteIndex: number | null,
  { includeCurrent = false }: { includeCurrent?: boolean } = {},
): T[] {
  if (!Array.isArray(current.palette)) return [];

  const sourceColours = validColours(current.palette);
  const comparingPalette = selectedPaletteIndex === null;

  if (!sourceColours.length || sourceColours.length > MAXIMUM_PALETTE_SIZE) return [];
  if (
    !comparingPalette &&
    (!Number.isInteger(selectedPaletteIndex) ||
      selectedPaletteIndex < 0 ||
      selectedPaletteIndex >= current.palette.length ||
      !validColours([current.palette[selectedPaletteIndex]]).length)
  ) return [];

  const selectedColour = comparingPalette ? null : current.palette[selectedPaletteIndex];
  const sourceIsMonochrome = isMonochrome(sourceColours);

  const ranked = candidates.flatMap((candidate) => {
    if (!includeCurrent && candidate.id === current.id) return [];

    const candidateColours = validColours(candidate.palette);
    if (
      !candidateColours.length || candidateColours.length > MAXIMUM_PALETTE_SIZE ||
      isMonochrome(candidateColours) !== sourceIsMonochrome
    ) return [];

    const score = comparingPalette
      ? paletteDistance(sourceColours, candidateColours)
      : singleColourDistance(selectedColour!, candidateColours);

    return [{ photograph: candidate, score }];
  });

  ranked.sort((first, second) =>
    first.score - second.score ||
    (first.photograph.filename < second.photograph.filename ? -1 :
      first.photograph.filename > second.photograph.filename ? 1 : 0),
  );

  const withinThreshold = ranked.filter(({ score }) => score <= SIMILARITY_THRESHOLD);
  const matches = withinThreshold.length >= MINIMUM_MATCHES
    ? withinThreshold
    : ranked.slice(0, MINIMUM_MATCHES);

  return matches.map(({ photograph }) => photograph);
}
