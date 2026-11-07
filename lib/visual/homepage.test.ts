import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_HOME_PALETTE, homeFallback, homeInk, homePalette, validHexColour } from "../site/homepage";

test("homepage palette accepts only six-digit hex colours and sanitizes public fallback values", () => {
  for (const colour of ["#ff278f", "#FFE52F", "#c8e6ff"]) assert.equal(validHexColour(colour), true);
  for (const colour of ["red", "#fff", "#00000000", "url(https://example.test)", "#123456; color:red", null]) assert.equal(validHexColour(colour), false);
  assert.deepEqual(homePalette({ fluidA: "url(bad)", fluidB: "#FFFFFF", background: "#000000" }), { ...DEFAULT_HOME_PALETTE, fluidB: "#ffffff", background: "#000000" });
  const fallback = homeFallback(DEFAULT_HOME_PALETTE);
  for (const colour of Object.values(DEFAULT_HOME_PALETTE).filter(colour => colour !== DEFAULT_HOME_PALETTE.background)) assert.ok(fallback.includes(colour));
});

test("solid-backed homepage labels choose WCAG-AA black or white ink for arbitrary filler colours", () => {
  for (let grey = 0; grey <= 255; grey++) {
    const hex = `#${grey.toString(16).padStart(2, "0").repeat(3)}`;
    const srgb = grey / 255, luminance = srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
    const contrast = homeInk(hex) === "#000000" ? (luminance + .05) / .05 : 1.05 / (luminance + .05);
    assert.ok(contrast >= 4.5, `${hex}: ${contrast}`);
  }
});
