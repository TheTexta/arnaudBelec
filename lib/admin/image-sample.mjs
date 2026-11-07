import { BACKGROUND_SAMPLE_LONGEST_SIDE, MMCQ_SAMPLE_LONGEST_SIDE } from "../palette/config.mjs";

/** Accept the new sample and already-open 96px clients without losing uploads. */
export function validateImageSample(metadata, dimensions) {
  const longestSide = Math.max(dimensions.width, dimensions.height);
  for (const size of [MMCQ_SAMPLE_LONGEST_SIDE, BACKGROUND_SAMPLE_LONGEST_SIDE]) {
    const scale = Math.min(1, size / longestSide);
    if (metadata.format === "png" &&
      metadata.width === Math.max(1, Math.round(dimensions.width * scale)) &&
      metadata.height === Math.max(1, Math.round(dimensions.height * scale))) return size;
  }
  throw new Error("The image sample does not match the selected image dimensions.");
}
