import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { ATMOSPHERE_PROFILES, atmosphereFallback, atmosphereField, type AtmospherePreset } from "./atmosphere";
import { BLOOM_DEFAULTS, bloomFragmentShader, bloomPixelRatio } from "./bloom-shader";

test("extracted native shader preserves the original photograph math exactly", () => {
  // SHA-256 of the pre-extraction photo fragment shader, with MAX_COLOURS=7,
  // excluding only comments and whitespace. This protects all existing equations,
  // linear-light ordering, four-pixel sampling and final output dithering.
  const normalized = bloomFragmentShader().replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
  assert.equal(createHash("sha256").update(normalized).digest("hex"),
    "650f464850468445c1339f890da790c57de24fcf6a3589e3aba51bb8d5d870dc");
});

test("public field uses the same grain and glow filter, with optional displacement only", () => {
  const photo = bloomFragmentShader();
  const publicField = bloomFragmentShader({ wave: true });
  const grainStart = "colour = sRGBTransferEOTF(vec4(colour, 1.0)).rgb;";
  const glowStart = "vec2 local = pixel - orb.xy;";
  assert.equal(publicField.slice(publicField.indexOf(grainStart), publicField.indexOf("// Screen")),
    photo.slice(photo.indexOf(grainStart), photo.indexOf("// Screen")));
  assert.equal(publicField.slice(publicField.indexOf(glowStart)), photo.slice(photo.indexOf(glowStart)));
  assert.ok(publicField.includes("uWaveStrength"));
  assert.ok(!photo.includes("uWaveStrength"));
});

test("render defaults and budgets are shared and unchanged", () => {
  assert.equal(BLOOM_DEFAULTS.grainStrength, 0.035);
  assert.equal(BLOOM_DEFAULTS.grainSize, 1);
  assert.equal(BLOOM_DEFAULTS.grainSpeed, 1);
  assert.equal(BLOOM_DEFAULTS.orbFrameMs, 60);
  assert.equal(bloomPixelRatio(390, 844, 3), 1.5);
  assert.equal(bloomPixelRatio(100, 100, 1), 1);
  for (const [width, height] of [[1440, 900], [3840, 2160], [7680, 4320]]) {
    const ratio = bloomPixelRatio(width, height, 3);
    assert.ok(ratio <= 1.5);
    assert.ok(width * height * ratio ** 2 <= 2_500_000 + 0.000001);
  }
});

test("every preset supplies seven valid colours and usable CSS without WebGL", () => {
  for (const preset of Object.keys(ATMOSPHERE_PROFILES) as AtmospherePreset[]) {
    const profile = ATMOSPHERE_PROFILES[preset];
    assert.equal(profile.colours.length, BLOOM_DEFAULTS.maxColours);
    for (const hex of [profile.background, ...profile.colours]) assert.match(hex, /^#[a-f0-9]{6}$/);
    assert.equal((atmosphereFallback(preset).match(/radial-gradient/g) ?? []).length, 5);
    assert.ok(profile.washOpacity > 0 && profile.washOpacity < 1);
  }
  assert.equal(ATMOSPHERE_PROFILES.journal.background, "#090807");
  assert.ok(ATMOSPHERE_PROFILES.journal.washOpacity < 0.05);
});

test("motion is deterministic, bounded, reduced-motion static and accents intermittent", () => {
  for (let i = 0; i < 7; i++) {
    const initial = atmosphereField(i, 0, true);
    assert.deepEqual(initial, atmosphereField(i, 1000, true));
    for (let seconds = 0; seconds < 200; seconds++) {
      const field = atmosphereField(i, seconds, false);
      assert.deepEqual(field, atmosphereField(i, seconds, false));
      assert.ok(field.x >= -0.1 && field.x <= 1.1);
      assert.ok(field.y >= -0.1 && field.y <= 1.1);
      assert.ok(field.opacity >= 0 && field.opacity <= 1);
      if (i < 5) assert.equal(field.lightScale, 0);
      else assert.ok(field.radius < 0.07);
    }
  }
  const activeSeconds = Array.from({ length: 200 }, (_, time) => atmosphereField(5, time, false).opacity)
    .filter((opacity) => opacity > 0).length;
  assert.ok(activeSeconds > 0 && activeSeconds < 45);
});
