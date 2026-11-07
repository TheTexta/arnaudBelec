import assert from "node:assert/strict";
import test from "node:test";
import { canPlayChord, CHORD_PEAK, CHORD_SECONDS, chordNotes, COLOUR_CHORDS, MAX_CHORD_VOICES, midiFrequency, safeVolume } from "./colour-chords";

test("seven curated bounded chords have finite musical frequencies", () => {
  assert.equal(COLOUR_CHORDS.length, 7);
  for (let index = 0; index < 7; index++) {
    const notes = chordNotes(index);
    assert.equal(notes.length, MAX_CHORD_VOICES);
    assert.equal(new Set(notes).size, notes.length);
    assert.ok(notes.every((note) => midiFrequency(note) > 100 && midiFrequency(note) < 1000));
  }
  assert.ok(CHORD_PEAK * MAX_CHORD_VOICES < 0.25);
  assert.ok(CHORD_SECONDS > 0.05 && CHORD_SECONDS <= 1);
  assert.equal(midiFrequency(69), 440);
  assert.equal(midiFrequency(81), 880);
});

test("invalid ranks never produce notes", () => {
  for (const rank of [-1, 7, 0.5, Infinity, NaN]) assert.deepEqual(chordNotes(rank), []);
});

test("volume is finite and bounded; sound requires explicit opt-in and no competing media", () => {
  assert.equal(safeVolume(NaN), 0);
  assert.equal(safeVolume(Infinity), 0);
  assert.equal(safeVolume(-1), 0);
  assert.equal(safeVolume(3), 1);
  assert.equal(canPlayChord(true, false, 0.35, false), true);
  for (const args of [[false, false, 1, false], [true, true, 1, false], [true, false, 0, false], [true, false, 1, true]] as const) {
    assert.equal(canPlayChord(args[0], args[1], args[2], args[3]), false);
  }
});
