import assert from "node:assert/strict";
import test from "node:test";
import { findSimilarPhotographs, paletteDistance } from "./similar-colours";
import type { PaletteColour, PublicPhotograph } from "../supabase-public";

const colour = (labL: number, labA = 0): PaletteColour => ({ hex: "#888888", labL, labA, labB: 0, weight: 1 });
const photo = (id: string, palette: PaletteColour[]): PublicPhotograph => ({
  id, filename: `${id}.jpg`, src: `${id}.jpg`, width: 100, height: 100, title: null, altText: null,
  backgroundHex: "#888888", hasPaletteAnalysis: palette.length > 0, palette,
});

test("unequal whole palettes account for every colour, symmetrically, without convenient subsets", () => {
  const first = [colour(0), colour(100)];
  const second = [colour(0)];
  assert.equal(paletteDistance(first, second), Math.sqrt(5000));
  assert.equal(paletteDistance(second, first), Math.sqrt(5000));
  assert.equal(paletteDistance([colour(0), colour(50), colour(100)], [colour(0), colour(100)]), Math.sqrt(2500 / 3));
  assert.ok(paletteDistance([colour(0), colour(0), colour(100)], [colour(0), colour(50)]) > 0);
});

test("equal-size matching retains optimal one-to-one assignment and ignores rank ordering", () => {
  const palette = Array.from({ length: 7 }, (_, i) => colour(i * 15));
  assert.equal(paletteDistance(palette, [...palette].reverse()), 0);
  assert.equal(paletteDistance([colour(0), colour(10)], [colour(10), colour(20)]), 10);
  assert.equal(paletteDistance([], palette), Infinity);
});

test("short palettes participate in full and single-swatch search; empty and invalid selections do not", () => {
  const source = photo("source", [colour(50)]);
  const candidates = [photo("near", [colour(51)]), photo("far", [colour(90)]), photo("empty", [])];
  assert.deepEqual(findSimilarPhotographs(source, candidates, null).map(p => p.id), ["near", "far"]);
  assert.deepEqual(findSimilarPhotographs(source, candidates, 0).map(p => p.id), ["near", "far"]);
  assert.deepEqual(findSimilarPhotographs(source, candidates, 1), []);
  assert.deepEqual(findSimilarPhotographs(photo("empty", []), candidates, null), []);
});

test("threshold, minimum-five, monochrome separation and stable ties remain unchanged", () => {
  const source = photo("source", [colour(50, 20)]);
  const candidates = Array.from({ length: 8 }, (_, i) => photo(String(i), [colour(i * 30, 20)]));
  assert.equal(findSimilarPhotographs(source, candidates, null).length, 5);
  assert.deepEqual(findSimilarPhotographs(source, [photo("mono", [colour(50)])], null), []);
  assert.deepEqual(findSimilarPhotographs(source, [photo("z", source.palette), photo("a", source.palette)], null).map(p => p.id), ["a", "z"]);
  assert.equal(findSimilarPhotographs(source, candidates.map(p => ({ ...p, palette: source.palette })), null).length, 8);
});
