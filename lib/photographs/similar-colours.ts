import type { PaletteColour, PublicPhotograph } from "@/lib/supabase-public";

const SIMILARITY_THRESHOLD = 20;
const MINIMUM_MATCHES = 5;
const PALETTE_SIZE = 7;
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

function paletteDistance(selected: PaletteColour[], candidates: PaletteColour[]): number {
  const bestByUsedMask = new Map<number, number>();

  // Each selected colour gets a distinct candidate colour. Memoizing each set
  // of used colours keeps the seven-colour assignment inexpensive.
  function smallestRemainingDistance(index: number, usedMask: number): number {
    if (index === PALETTE_SIZE) return 0;

    const cached = bestByUsedMask.get(usedMask);
    if (cached !== undefined) return cached;

    let best = Number.POSITIVE_INFINITY;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidateBit = 1 << candidateIndex;
      if (usedMask & candidateBit) continue;

      best = Math.min(
        best,
        squaredLabDistance(selected[index], candidates[candidateIndex]) +
          smallestRemainingDistance(index + 1, usedMask | candidateBit),
      );
    }

    bestByUsedMask.set(usedMask, best);
    return best;
  }

  return Math.sqrt(smallestRemainingDistance(0, 0) / PALETTE_SIZE);
}

/**
 * Finds photographs with similar palettes. Pass `null` to compare all seven
 * swatches, or a zero-based palette index to compare one selected swatch.
 * Invalid or incomplete palettes are omitted; no match returns an empty array.
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

  if (comparingPalette && sourceColours.length < PALETTE_SIZE) return [];
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
      candidateColours.length < (comparingPalette ? PALETTE_SIZE : 1) ||
      isMonochrome(candidateColours) !== sourceIsMonochrome
    ) return [];

    const score = comparingPalette
      ? paletteDistance(sourceColours.slice(0, PALETTE_SIZE), candidateColours)
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
