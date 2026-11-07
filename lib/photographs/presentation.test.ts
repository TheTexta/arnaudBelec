import assert from "node:assert/strict";
import test from "node:test";
import type { PublicPhotograph } from "../supabase-public";
import { eligiblePhotographs, selectPresentationPhotographs, type PhotoGroups } from "./presentation";

function photograph(id: string, lightness = 50): PublicPhotograph {
  return {
    id, filename: `${id}.jpg`, src: `/uploads/${id}.jpg`, width: 800, height: 1200,
    title: null, altText: null, backgroundHex: "#ffffff", hasPaletteAnalysis: true,
    palette: Array.from({ length: 7 }, () => ({ hex: "#7995ae", labL: lightness, labA: 20, labB: 10, weight: 1 / 7 })),
  };
}

const photographs = [photograph("colour"), photograph("mono"), photograph("overlap"), photograph("unknown")];
const groups: PhotoGroups = { colourPhotoIds: ["colour", "overlap", "missing", "colour"], monochromePhotoIds: ["mono", "overlap"] };
const ids = (photos: PublicPhotograph[]) => photos.map(({ id }) => id);

test("All retains unknown and ambiguous classifications in catalogue order", () => {
  assert.deepEqual(ids(eligiblePhotographs(photographs, "all", groups)), ["colour", "mono", "overlap", "unknown"]);
});

test("curated groups ignore unknown IDs, duplicates and overlap without inferring from identical palettes", () => {
  assert.deepEqual(ids(eligiblePhotographs(photographs, "colour", groups)), ["colour"]);
  assert.deepEqual(ids(eligiblePhotographs(photographs, "monochrome", groups)), ["mono"]);
});

test("missing, empty and wholly invalid classifications leave groups empty but All available", () => {
  for (const classification of [undefined, { colourPhotoIds: [], monochromePhotoIds: [] }, { colourPhotoIds: ["missing", ""], monochromePhotoIds: ["missing"] }]) {
    assert.deepEqual(eligiblePhotographs(photographs, "colour", classification), []);
    assert.deepEqual(eligiblePhotographs(photographs, "monochrome", classification), []);
    assert.equal(eligiblePhotographs(photographs, "all", classification).length, photographs.length);
  }
});

test("eligibility preserves stable identities, original paths and palettes without mutating inputs", () => {
  const before = structuredClone({ photographs, groups });
  const all = eligiblePhotographs(photographs, "all", groups);
  const colour = eligiblePhotographs(photographs, "colour", groups);
  assert.notEqual(all, photographs);
  assert.equal(colour[0], photographs[0]);
  assert.deepEqual({ photographs, groups }, before);
});

test("nearest gallery fills to five only within eligible candidates", () => {
  const catalogue = Array.from({ length: 8 }, (_, index) => photograph(String(index), 10 + index * 10));
  const eligible = eligiblePhotographs(catalogue, "colour", { colourPhotoIds: ["0", "5", "6"], monochromePhotoIds: ["1", "2", "3", "4", "7"] });
  const before = structuredClone(catalogue);
  const selected = selectPresentationPhotographs(eligible, eligible[0], 0);
  assert.deepEqual(ids(selected), ["0", "5", "6"]);
  assert.deepEqual(catalogue, before);
});

test("nearest gallery retains the existing minimum-five rule when eligible", () => {
  const eligible = Array.from({ length: 8 }, (_, index) => photograph(String(index), index * 30));
  assert.equal(selectPresentationPhotographs(eligible, eligible[0], 0).length, 5);
});

test("selection reset returns the whole eligible group; empty or stale sources never escape it", () => {
  const eligible = eligiblePhotographs(photographs, "colour", groups);
  assert.deepEqual(selectPresentationPhotographs(eligible, undefined, null), eligible);
  assert.deepEqual(selectPresentationPhotographs([], undefined, 0), []);
  assert.deepEqual(selectPresentationPhotographs(eligible, photographs[1], 0), []);
  assert.deepEqual(selectPresentationPhotographs(eligible, eligible[0], -1), []);
});
