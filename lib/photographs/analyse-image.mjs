import readExif from "exif-reader";
import sharp from "sharp";

import {
  extractOklabKMedoidsPalette,
  OKLAB_K_MEDOIDS_ALGORITHM,
  OKLAB_K_MEDOIDS_ITERATIONS,
  rgbToHex,
  rgbToLab,
} from "../palette/oklab-k-medoids.mjs";
import { extractEdgeBackgroundColour } from "../palette/edge-background.mjs";
import { MAXIMUM_INPUT_PIXELS, PHOTOGRAPH_PALETTE_SIZE } from "./config.mjs";

const sampleLongestSide = 96;

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

export async function analyseImage(buffer, photographId) {
  const { data, info } = await sharp(buffer, { limitInputPixels: MAXIMUM_INPUT_PIXELS })
    .rotate()
    .resize({
      width: sampleLongestSide,
      height: sampleLongestSide,
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

  const pixels = sampledPixels.filter(Boolean);
  const backgroundHex = extractEdgeBackgroundColour(sampledPixels, info.width, info.height);
  const colours = extractOklabKMedoidsPalette(pixels, PHOTOGRAPH_PALETTE_SIZE).map(
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
    algorithm: OKLAB_K_MEDOIDS_ALGORITHM,
    algorithm_iterations: OKLAB_K_MEDOIDS_ITERATIONS,
    sample_longest_side: sampleLongestSide,
    palette_size: PHOTOGRAPH_PALETTE_SIZE,
    analyzed_at: new Date().toISOString(),
    background_hex: backgroundHex,
    colours,
  };
}
