// One filter for native photograph palettes and public atmospheric fields.
// All spatial units are CSS pixels, not drawing-buffer pixels.
export const BLOOM_DEFAULTS = Object.freeze({
  grainStrength: 0.035,
  grainSize: 1,
  grainSpeed: 1,
  maxColours: 7,
  maxPixelRatio: 1.5,
  maxPixels: 2_500_000,
  orbFrameMs: 60,
});

export function bloomPixelRatio(width: number, height: number, deviceRatio: number): number {
  return Math.min(deviceRatio || 1, BLOOM_DEFAULTS.maxPixelRatio,
    Math.sqrt(BLOOM_DEFAULTS.maxPixels / (Math.max(1, width) * Math.max(1, height))));
}

export const BLOOM_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function bloomFragmentShader({ wave = false }: { wave?: boolean } = {}) {
  return `
    #include <common>
    #include <dithering_pars_fragment>
    uniform vec2 uResolution;
    uniform vec3 uBackground;
    uniform vec3 uColours[7];
    uniform vec4 uOrbs[7];
    uniform float uOrbActive[7];
    uniform float uOrbScale[7];
    uniform float uOrbFrame;
    uniform float uTime;
    uniform float uGrainStrength;
    uniform float uGrainSize;
    ${wave ? "uniform vec2 uPointer; uniform float uWaveStrength; uniform float uDrift;" : ""}
    varying vec2 vUv;

    void main() {
      vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
      ${wave ? `
        vec2 fieldPixel = pixel;
        vec2 fromPointer = pixel - uPointer;
        float waveDistance = length(fromPointer);
        float envelope = exp(-waveDistance / max(uResolution.x * 0.45, 1.0));
        fieldPixel += fromPointer / max(waveDistance, 1.0)
          * sin(waveDistance / 85.0 - uDrift * 1.4) * envelope * uWaveStrength;
      ` : ""}
      // Compose in sRGB to retain the CSS gradients' palette and overlap colours.
      vec3 colour = uBackground;
      for (int i = 0; i < 7; i++) {
        vec4 orb = uOrbs[i];
        float radius = max(orb.z, 1.0);
        float distanceFromCentre = length(${wave ? "fieldPixel" : "pixel"} - orb.xy) / radius;
        float falloff = 1.0 - smoothstep(0.0, 1.0, distanceFromCentre);
        colour = mix(colour, uColours[i], falloff * orb.w);
      }

      colour = sRGBTransferEOTF(vec4(colour, 1.0)).rgb;
      vec2 cell = floor(pixel / uGrainSize);
      float seed = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float noise = fract(seed + uTime) - 0.5;
      // Fade at black to avoid lifting shadows when negative noise would clip.
      float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
      float shadowMask = smoothstep(0.0, 0.06, luminance);
      colour = clamp(colour + noise * uGrainStrength * shadowMask, 0.0, 1.0);

      // Screen four-CSS-pixel samples against the finished background colour.
      vec3 screened = sRGBTransferOETF(vec4(colour, 1.0)).rgb;
      vec2 orbNoiseCell = floor(pixel / 4.0);
      vec2 orbSample = orbNoiseCell * 4.0 + 2.0;
      float orbSeed = fract(sin(dot(orbNoiseCell, vec2(12.9898, 78.233)) + uOrbFrame * 37.719) * 43758.5453);
      float orbNoise = orbSeed - 0.5;
      for (int i = 0; i < 7; i++) {
        vec4 orb = uOrbs[i];
        if (orb.w == 0.0${wave ? " || uOrbScale[i] <= 0.0" : ""}) continue;

        vec2 local = pixel - orb.xy;
        float orbScale = uOrbScale[i];
        float distancePx = length(local) / orbScale;
        if (distancePx > 56.0) continue;

        float orbActivity = uOrbActive[i];
        float softGlow = (1.0 - smoothstep(16.0, 48.0, distancePx)) * (0.2 + orbActivity * 0.12);
        screened = 1.0 - (1.0 - screened) * (1.0 - uColours[i] * softGlow);

        float cellDistance = length(orbSample - orb.xy) / (4.0 * orbScale);
        float colourRadius = (0.70710678 + 7.5) / 2.0;
        float edgeRadius = colourRadius + (7.5 - colourRadius) * 2.5;
        if (cellDistance > edgeRadius) continue;

        float innerFade = clamp((cellDistance - 0.70710678) / (colourRadius - 0.70710678), 0.0, 1.0);
        float outerFade = clamp((cellDistance - colourRadius) / (edgeRadius - colourRadius), 0.0, 1.0);
        float outerAlpha = (exp(-3.0 * outerFade) - exp(-3.0)) / (1.0 - exp(-3.0));
        float whiteMix = 1.0 - innerFade;
        float grainFade = cellDistance <= colourRadius
          ? min(innerFade, 1.0 - innerFade) * 2.0
          : min(outerFade, 1.0 - outerFade) * 2.0;
        vec3 orbColour = clamp(mix(uColours[i], vec3(1.0), whiteMix) * (1.0 + orbNoise * 0.2 * grainFade), 0.0, 1.0);
        screened = 1.0 - (1.0 - screened) * (1.0 - orbColour * outerAlpha);
      }
      colour = sRGBTransferEOTF(vec4(screened, 1.0)).rgb;
      gl_FragColor = vec4(colour, 1.0);
      #include <colorspace_fragment>
      #include <dithering_fragment>
    }
  `;
}
