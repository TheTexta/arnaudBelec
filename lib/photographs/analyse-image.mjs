import readExif from "exif-reader";
import sharp from "sharp";

import {
  rgbToHex,
  rgbToLab,
} from "../palette/oklab-k-medoids.mjs";
import { extractEdgeBackgroundColour } from "../palette/edge-background.mjs";
import { MAXIMUM_INPUT_PIXELS, PHOTOGRAPH_PALETTE_SIZE } from "./config.mjs";
import { extractMmcqVibrantPalette, MMCQ_PASSES } from "../palette/mmcq-vibrant.mjs";
import { MMCQ_VIBRANT_ALGORITHM, MMCQ_SAMPLE_LONGEST_SIDE, BACKGROUND_SAMPLE_LONGEST_SIDE } from "../palette/config.mjs";

function capturedDate(exifBuffer) {
  if (!exifBuffer) {
    return null;
  }

  try {
    const exif = readExif(exifBuffer);
    const value = exif.Photo?.DateTimeOriginal
      ?? exif.Photo?.DateTimeDigitized
      ?? exif.Image?.DateTime;

    return value instanceof Date && !Number.isNaN(value.valueOf())
      ? value.toISOString().slice(0, 10)
      : null;
  } catch {
    return null;
  }
}

export async function imageMetadata(buffer) {
  const metadata = await sharp(buffer, { limitInputPixels: MAXIMUM_INPUT_PIXELS }).metadata();
  const orientationSwapsDimensions = metadata.orientation
    ? metadata.orientation >= 5 && metadata.orientation <= 8
    : false;
  const width = orientationSwapsDimensions ? metadata.height : metadata.width;
  const height = orientationSwapsDimensions ? metadata.width : metadata.height;

  if (!width || !height) {
    throw new Error("The selected file does not contain valid image dimensions.");
  }

  return {
    capturedAt: capturedDate(metadata.exif),
    format: metadata.format,
    height,
    width,
  };
}

async function sampleImage(buffer, longestSide) {
  const { data, info } = await sharp(buffer, { limitInputPixels: MAXIMUM_INPUT_PIXELS })
    .rotate()
    .resize({
      width: longestSide,
      height: longestSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sampledPixels = [];

  for (let offset = 0; offset < data.length; offset += info.channels) {
    sampledPixels.push(data[offset + 3] > 200
      ? [data[offset], data[offset + 1], data[offset + 2]]
      : null);
  }

  return { pixels: sampledPixels, width: info.width, height: info.height };
}

/** Backfills can preserve the saved background. Legacy browser samples stay truthful. */
export async function analyseImage(buffer, photographId, { backgroundHex = null, sampleLongestSide = MMCQ_SAMPLE_LONGEST_SIDE } = {}) {
  if (![BACKGROUND_SAMPLE_LONGEST_SIDE, MMCQ_SAMPLE_LONGEST_SIDE].includes(sampleLongestSide)) {
    throw new Error("Invalid palette sample size.");
  }
  const sample = await sampleImage(buffer, sampleLongestSide);
  if (backgroundHex === null) {
    const edgeSample = sampleLongestSide === BACKGROUND_SAMPLE_LONGEST_SIDE
      ? sample : await sampleImage(buffer, BACKGROUND_SAMPLE_LONGEST_SIDE);
    backgroundHex = extractEdgeBackgroundColour(edgeSample.pixels, edgeSample.width, edgeSample.height);
  }
  const colours = extractMmcqVibrantPalette(sample.pixels.filter(Boolean), PHOTOGRAPH_PALETTE_SIZE, backgroundHex).map(
    ({ rgb, weight }, index) => {
      const [labL, labA, labB] = rgbToLab(rgb);

      return {
        rank: index + 1,
        red: rgb[0],
        green: rgb[1],
        blue: rgb[2],
        hex: rgbToHex(rgb),
        lab_l: labL,
        lab_a: labA,
        lab_b: labB,
        weight: Number(weight.toFixed(6)),
      };
    },
  );

  return {
    photograph_id: photographId,
    algorithm: MMCQ_VIBRANT_ALGORITHM,
    algorithm_iterations: MMCQ_PASSES,
    sample_longest_side: sampleLongestSide,
    palette_size: colours.length,
    analyzed_at: new Date().toISOString(),
    background_hex: backgroundHex,
    colours,
  };
}
