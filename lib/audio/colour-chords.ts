// Palette rank order (zero-based), voiced in a shared C-major / A-minor family.
export const COLOUR_CHORDS = [
  [48, 55, 64, 71], [50, 57, 65, 72], [52, 59, 67, 74],
  [53, 60, 69, 76], [55, 62, 69, 77], [45, 52, 60, 67],
  [47, 53, 62, 69],
] as const;
export const MAX_CHORD_VOICES = 4;
export const CHORD_SECONDS = 0.9;
export const CHORD_PEAK = 0.055;
export const COLOUR_CHORD_EVENT = "arnaud:colour-chord";

export function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function chordNotes(index: number): readonly number[] {
  return Number.isInteger(index) && index >= 0 && index < COLOUR_CHORDS.length
    ? COLOUR_CHORDS[index] : [];
}

export function safeVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function canPlayChord(enabled: boolean, muted: boolean, volume: number, busy: boolean): boolean {
  return enabled && !muted && safeVolume(volume) > 0 && !busy;
}

/** Call synchronously from an explicit colour-orb click, never hover/animation.
 * The public provider ignores this unless Colour sound was explicitly enabled.
 */
export function playColourChord(index: number): void {
  if (typeof window !== "undefined" && chordNotes(index).length) {
    window.dispatchEvent(new CustomEvent(COLOUR_CHORD_EVENT, { detail: index }));
  }
}
