import { extractOklabKMedoidsPalette, rgbToHex, rgbToOklab } from "./oklab-k-medoids.mjs";

const EDGE_FRACTION = 0.08;
const BACKGROUND_CHROMA = 0.45;

function toSrgb(channel) {
  const value = channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * Math.max(0, channel) ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

// Inverse of the D65 OKLab transform used by the palette extractor.
function oklabToRgb([lightness, greenRed, blueYellow]) {
  const l = (lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3;
  const m = (lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3;
  const s = (lightness - 0.0894841775 * greenRed - 1.2914855480 * blueYellow) ** 3;

  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

/**
 * Pick the edge cluster covering the most pixels, then soften it so the photo
 * and its seven saturated gradients remain distinct from the background.
 * @param {(number[] | null)[]} pixels Row-major RGB pixels; null is transparent
 * @param {number} width
 * @param {number} height
 */
export function extractEdgeBackgroundColour(pixels, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
    width < 1 || height < 1 || pixels.length !== width * height) {
    throw new Error("Invalid image sample dimensions for edge colour extraction.");
  }

  const edgeWidth = Math.max(1, Math.ceil(width * EDGE_FRACTION));
  const edgeHeight = Math.max(1, Math.ceil(height * EDGE_FRACTION));
  const edgePixels = pixels.filter((pixel, index) => {
    if (!pixel) return false;
    const x = index % width;
    const y = Math.floor(index / width);
    return x < edgeWidth || x >= width - edgeWidth ||
      y < edgeHeight || y >= height - edgeHeight;
  });
  const candidatePixels = edgePixels.length ? edgePixels : pixels.filter(Boolean);
  if (!candidatePixels.length) throw new Error("Image has no opaque pixels.");

  const medoids = extractOklabKMedoidsPalette(candidatePixels, 3);
  const dominant = medoids.reduce((best, colour) =>
    colour.weight > best.weight ? colour : best);
  const [originalLightness, greenRed, blueYellow] = rgbToOklab(dominant.rgb);

  return rgbToHex(oklabToRgb([
    originalLightness,
    greenRed * BACKGROUND_CHROMA,
    blueYellow * BACKGROUND_CHROMA,
  ]));
}
