// Adapted from Elliot's mmcq64-vibrant-oklab-v1; Arnaud keeps background exclusion
// and allows up to seven genuine colours. Selection scores are NOT area weights.
import { rgbToOklab } from "./oklab-k-medoids.mjs";
import { BACKGROUND_DISTANCE } from "./config.mjs";
export { MMCQ_VIBRANT_ALGORITHM, MMCQ_SAMPLE_LONGEST_SIDE } from "./config.mjs";

export const MMCQ_CANDIDATE_COUNT = 64;
export const MMCQ_PASSES = 2;
export const MMCQ_MINIMUM_DISTANCE = 0.055;

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const key = rgb => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

function box(bins) {
  const minimum = [31, 31, 31], maximum = [0, 0, 0];
  let count = 0;
  for (const bin of bins) {
    count += bin.count;
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], bin.coordinates[axis]);
      maximum[axis] = Math.max(maximum[axis], bin.coordinates[axis]);
    }
  }
  const ranges = maximum.map((value, axis) => value - minimum[axis] + 1);
  return { bins, count, ranges, volume: ranges[0] * ranges[1] * ranges[2] };
}

function split(source) {
  const axis = source.ranges.indexOf(Math.max(...source.ranges));
  const bins = [...source.bins].sort((a, b) => a.coordinates[axis] - b.coordinates[axis]
    || key(a.coordinates) - key(b.coordinates));
  let population = 0, cut = 1, nearestMedian = Infinity;
  for (let index = 0; index < bins.length - 1; index++) {
    population += bins[index].count;
    const delta = Math.abs(population - source.count / 2);
    if (bins[index].coordinates[axis] !== bins[index + 1].coordinates[axis] && delta < nearestMedian) {
      nearestMedian = delta;
      cut = index + 1;
    }
  }
  return [box(bins.slice(0, cut)), box(bins.slice(cut))];
}

function candidates(observed) {
  const histogram = new Map();
  for (const colour of observed) {
    const coordinates = [colour.rgb[0] >> 3, colour.rgb[1] >> 3, colour.rgb[2] >> 3];
    const index = key(coordinates);
    const bin = histogram.get(index) ?? { coordinates, count: 0, colours: [] };
    bin.count += colour.count;
    bin.colours.push(colour);
    histogram.set(index, bin);
  }
  const boxes = [box([...histogram.values()])];
  for (const [target, byVolume] of [[48, false], [MMCQ_CANDIDATE_COUNT, true]]) {
    while (boxes.length < target) {
      let chosen = -1, best = -1;
      boxes.forEach((item, index) => {
        if (item.bins.length < 2) return;
        const priority = item.count * (byVolume ? item.volume : 1);
        if (priority > best) { chosen = index; best = priority; }
      });
      if (chosen < 0) break;
      boxes.push(...split(boxes.splice(chosen, 1)[0]));
    }
  }
  return boxes.map(item => {
    const colours = item.bins.flatMap(bin => bin.colours);
    const mean = [0, 0, 0];
    for (const colour of colours) {
      for (let axis = 0; axis < 3; axis++) mean[axis] += colour.oklab[axis] * colour.count / item.count;
    }
    colours.sort((a, b) => distance(a.oklab, mean) - distance(b.oklab, mean)
      || b.count - a.count || key(a.rgb) - key(b.rgb));
    return { rgb: colours[0].rgb, oklab: colours[0].oklab, count: item.count };
  }).sort((a, b) => b.count - a.count || key(a.rgb) - key(b.rgb));
}

export function extractMmcqVibrantPalette(pixels, paletteSize = 7, backgroundHex = null) {
  if (!pixels.length) throw new Error("Cannot extract a palette from an empty pixel sample.");
  if (!Number.isInteger(paletteSize) || paletteSize < 1 || paletteSize > 7) {
    throw new Error("Palette size must be an integer between one and seven.");
  }
  for (const pixel of pixels) {
    if (!Array.isArray(pixel) || pixel.length !== 3 || pixel.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
      throw new Error("RGB samples must contain three integer channels from 0 to 255.");
    }
  }
  const fullPopulation = pixels;
  if (backgroundHex !== null) {
    if (!/^#[0-9a-f]{6}$/i.test(backgroundHex)) throw new Error("Invalid background colour.");
    const background = rgbToOklab(backgroundHex.slice(1).match(/../g).map(channel => parseInt(channel, 16)));
    const foreground = pixels.filter(rgb => distance(rgbToOklab(rgb), background) >= BACKGROUND_DISTANCE);
    // Flat images still retain real pixels rather than inventing a foreground.
    if (foreground.length && foreground.length < pixels.length) pixels = foreground;
  }
  const histogram = new Map();
  for (const pixel of pixels) {
    const index = key(pixel);
    const existing = histogram.get(index);
    if (existing) existing.count++;
    else histogram.set(index, { rgb: [...pixel], count: 1, oklab: rgbToOklab(pixel) });
  }
  const observed = [...histogram.values()].sort((a, b) => key(a.rgb) - key(b.rgb));
  const all = candidates(observed);
  const minimumSupport = Math.max(3, Math.ceil(pixels.length * 0.001));
  let available = all.filter(colour => colour.count >= minimumSupport);
  // A large flat background plus isolated hot pixels is not a tiny photograph.
  // If exclusion leaves only unsupported noise, use the real full population
  // rather than promoting that noise through the tiny-image fallback.
  if (!available.length && pixels !== fullPopulation) return extractMmcqVibrantPalette(fullPopulation, paletteSize);
  if (!available.length) available = all.slice(0, 1);
  const maximumPopulation = all[0].count;
  const selected = [];
  const nearest = all.map(() => 0.5);
  while (selected.length < paletteSize && available.length) {
    let chosen = -1, best = -Infinity;
    available.forEach((colour, index) => {
      const separation = selected.length ? Math.min(...selected.map(swatch => distance(colour.oklab, swatch.oklab))) : 0.25;
      if (separation < MMCQ_MINIMUM_DISTANCE) return;
      const [lightness, a, b] = colour.oklab;
      const chroma = Math.min(1, Math.hypot(a, b) / 0.22);
      const exposure = Math.min(1, lightness / 0.15, (1 - lightness) / 0.1);
      const population = Math.sqrt(colour.count / maximumPopulation);
      const base = chroma * exposure * 0.65 + population * 0.25 + (1 - Math.abs(lightness - 0.6)) * 0.1;
      const coverage = selected.length ? all.reduce((sum, candidate, i) =>
        sum + candidate.count / pixels.length * Math.max(0, nearest[i] - distance(colour.oklab, candidate.oklab)), 0) / 0.25 : 0;
      const score = base * (0.35 + 0.65 * Math.min(1, separation / 0.25)) + coverage * 1.2;
      if (score > best) { best = score; chosen = index; }
    });
    if (chosen < 0) break;
    const colour = available.splice(chosen, 1)[0];
    selected.push(colour);
    all.forEach((candidate, index) => { nearest[index] = Math.min(nearest[index], distance(colour.oklab, candidate.oklab)); });
  }
  const populations = selected.map(() => 0);
  for (const colour of observed) {
    let chosen = 0, nearest = Infinity;
    selected.forEach((swatch, index) => {
      const difference = distance(colour.oklab, swatch.oklab);
      if (difference < nearest) { nearest = difference; chosen = index; }
    });
    populations[chosen] += colour.count;
  }
  return selected.map((colour, index) => ({ rgb: colour.rgb, oklab: colour.oklab, weight: populations[index] / pixels.length }));
}
