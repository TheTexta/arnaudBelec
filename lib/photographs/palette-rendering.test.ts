import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHooks } from "node:module";
import { gradientDiameterVw, orbPulseScale } from "../../app/gradient-orb";
import { chordNotes, COLOUR_CHORDS } from "../audio/colour-chords";
import type { PublicPhotograph } from "../supabase-public";

// Node's ESM/CJS interop for next/image differs from Next's bundler. Only mock
// image/link markup here; the real palette, Motion, CSS fallback and orb code run.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/image" || specifier === "next/link") return {
      url: `data:text/javascript,${encodeURIComponent("export default function NextMarkup(props) { return props.children ?? null; }")}`,
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});
const { default: PhotoPage } = await import("../../app/photo-page");
const { default: PhotoDetail } = await import("../../app/photos/[filename]/photo-detail");
hooks.deregister();

test("one-colour gradient/orb sizing remains finite in CSS and WebGL", () => {
  assert.equal(gradientDiameterVw(1, 1), 100);
  assert.ok(Number.isFinite(orbPulseScale("0", 1, 1, 1000, false)));
  assert.equal(gradientDiameterVw(1 / 7, 7), 100);
  assert.equal(gradientDiameterVw(0, 7), 75);
  assert.equal(gradientDiameterVw(1, 7), 125);
});

test("archive and detail render only genuine swatches, including zero, one, two and seven colours", () => {
  for (const count of [0, 1, 2, 7]) {
    const photograph: PublicPhotograph = {
      id: "photo", src: "/test-image.jpg", filename: "photo.jpg", width: 100, height: 80,
      title: null, altText: null, backgroundHex: "#888888", hasPaletteAnalysis: count > 0,
      palette: Array.from({ length: count }, (_, i) => ({ hex: "#888888", labL: 50 + i, labA: 0, labB: 0, weight: 1 / count })),
    };
    for (const element of [createElement(PhotoPage, { photographs: [photograph] }), createElement(PhotoDetail, { photograph, photographs: [photograph] })]) {
      const html = renderToStaticMarkup(element);
      assert.equal((html.match(/data-colour-orb=/g) ?? []).length, count);
      assert.ok(!html.includes("NaN"));
    }
    assert.deepEqual(Array.from({ length: count }, (_, index) => chordNotes(index)), COLOUR_CHORDS.slice(0, count));
  }
});
