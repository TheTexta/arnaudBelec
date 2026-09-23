/** @typedef {[number, number, number]} Rgb */
/** @typedef {[number, number, number]} Lab */

export const OKLAB_K_MEDOIDS_ALGORITHM = "oklab-kmedoids-chroma-v1";
export const OKLAB_K_MEDOIDS_ITERATIONS = 10;

const MIN_CHROMA_REFERENCE = 0.08;
const NEUTRAL_IMPORTANCE = 0.05;
const CANDIDATES_NEAR_CENTER = 32;
const CANDIDATES_BY_MASS = 16;

function linearize(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * Converts an sRGB image pixel to OKLab using Björn Ottosson's D65 matrices.
 * https://bottosson.github.io/posts/oklab/
 * @param {Rgb} rgb
 * @returns {Lab}
 */
export function rgbToOklab(rgb) {
  const red = linearize(rgb[0]);
  const green = linearize(rgb[1]);
  const blue = linearize(rgb[2]);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function squaredDistance(first, second) {
  return (first[0] - second[0]) ** 2 +
    (first[1] - second[1]) ** 2 +
    (first[2] - second[2]) ** 2;
}

function chromaReference(points, totalPixels) {
  let count = 0;
  for (const point of [...points].sort((first, second) => first.chroma - second.chroma)) {
    count += point.count;
    if (count >= totalPixels * 0.9) return Math.max(MIN_CHROMA_REFERENCE, point.chroma);
  }
  return MIN_CHROMA_REFERENCE;
}

function buildPoints(pixels) {
  const byRgb = new Map();

  for (const rgb of pixels) {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    const existing = byRgb.get(key);
    if (existing) existing.count += 1;
    else byRgb.set(key, { rgb, count: 1 });
  }

  const points = [...byRgb.values()].map((point) => {
    const lab = rgbToOklab(point.rgb);
    return { ...point, lab, chroma: Math.hypot(lab[1], lab[2]) };
  });
  const reference = chromaReference(points, pixels.length);

  for (const point of points) {
    const relativeChroma = Math.min(1, point.chroma / reference);
    const visibleLightness = Math.max(0, Math.min(1, (point.lab[0] - 0.04) / 0.12));
    const importance = NEUTRAL_IMPORTANCE +
      (1 - NEUTRAL_IMPORTANCE) * relativeChroma ** 1.5 * visibleLightness;
    point.mass = point.count * importance;
  }

  return points;
}

function seedMedoids(points, paletteSize) {
  const bins = new Map();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const key = (point.rgb[0] >> 4) << 8 |
      (point.rgb[1] >> 4) << 4 |
      (point.rgb[2] >> 4);
    const bin = bins.get(key);
    if (bin) {
      bin.mass += point.mass;
      if (point.mass > points[bin.representative].mass) bin.representative = index;
    } else {
      bins.set(key, { mass: point.mass, representative: index });
    }
  }

  const choices = [...bins.values()].map(({ mass, representative }) => ({ mass, index: representative }));
  const medoids = [];
  const selected = new Set();

  function selectNext(candidates) {
    let bestIndex = -1;
    let bestScore = -1;

    for (const candidate of candidates) {
      if (selected.has(candidate.index)) continue;
      const distance = medoids.length === 0 ? 1 : Math.min(
        ...medoids.map((medoid) => squaredDistance(
          points[candidate.index].lab,
          points[medoid].lab,
        )),
      );
      const score = candidate.mass * distance;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidate.index;
      }
    }

    if (bestIndex >= 0) {
      medoids.push(bestIndex);
      selected.add(bestIndex);
    }
  }

  while (medoids.length < Math.min(paletteSize, choices.length)) selectNext(choices);
  if (medoids.length < paletteSize) {
    const remaining = points.map((point, index) => ({ mass: point.mass, index }));
    while (medoids.length < Math.min(paletteSize, points.length)) selectNext(remaining);
  }

  return medoids;
}

function assignPoints(points, medoids) {
  const clusters = medoids.map(() => ({ indices: [], count: 0, mass: 0 }));

  for (let index = 0; index < points.length; index += 1) {
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let medoidIndex = 0; medoidIndex < medoids.length; medoidIndex += 1) {
      const distance = squaredDistance(points[index].lab, points[medoids[medoidIndex]].lab);
      if (distance < nearestDistance) {
        nearest = medoidIndex;
        nearestDistance = distance;
      }
    }

    const cluster = clusters[nearest];
    cluster.indices.push(index);
    cluster.count += points[index].count;
    cluster.mass += points[index].mass;
  }

  return clusters;
}

function closestMedoid(points, cluster, currentMedoid) {
  if (cluster.indices.length <= 1) return cluster.indices[0] ?? currentMedoid;

  const center = [0, 0, 0];
  for (const index of cluster.indices) {
    const { lab, mass } = points[index];
    for (let channel = 0; channel < 3; channel += 1) center[channel] += lab[channel] * mass;
  }
  for (let channel = 0; channel < 3; channel += 1) center[channel] /= cluster.mass;

  // Evaluate likely medoids against the entire cluster. Every candidate is an
  // observed image colour; limiting candidates keeps large imports practical.
  const nearCenter = [...cluster.indices]
    .sort((first, second) => squaredDistance(points[first].lab, center) -
      squaredDistance(points[second].lab, center))
    .slice(0, CANDIDATES_NEAR_CENTER);
  const highMass = [...cluster.indices]
    .sort((first, second) => points[second].mass - points[first].mass)
    .slice(0, CANDIDATES_BY_MASS);
  const candidates = new Set([currentMedoid, ...nearCenter, ...highMass]);
  let best = currentMedoid;
  let lowestCost = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    let cost = 0;
    for (const index of cluster.indices) {
      cost += points[index].mass * Math.sqrt(squaredDistance(points[index].lab, points[candidate].lab));
    }
    if (cost < lowestCost - 1e-12 ||
      (Math.abs(cost - lowestCost) <= 1e-12 && points[candidate].chroma > points[best].chroma)) {
      lowestCost = cost;
      best = candidate;
    }
  }

  return best;
}

/**
 * Deterministic, saturation-weighted OKLab k-medoids. Medoids are observed
 * image pixels; returned weights remain unweighted image-area shares.
 * @param {Rgb[]} pixels
 * @param {number} [paletteSize]
 */
export function extractOklabKMedoidsPalette(pixels, paletteSize = 7) {
  if (!pixels.length) throw new Error("Cannot extract a palette from an empty pixel sample.");
  if (!Number.isInteger(paletteSize) || paletteSize < 1) throw new Error("Invalid palette size.");

  const points = buildPoints(pixels);
  let medoids = seedMedoids(points, Math.min(paletteSize, points.length));

  for (let iteration = 0; iteration < OKLAB_K_MEDOIDS_ITERATIONS; iteration += 1) {
    const clusters = assignPoints(points, medoids);
    const updated = medoids.map((medoid, index) => closestMedoid(points, clusters[index], medoid));
    if (updated.every((medoid, index) => medoid === medoids[index])) break;
    medoids = updated;
  }

  const clusters = assignPoints(points, medoids);
  const palette = medoids.map((index, position) => ({
    rgb: points[index].rgb,
    weight: clusters[position].count / pixels.length,
    prominence: clusters[position].mass,
    chroma: points[index].chroma,
  }));
  palette.sort((first, second) => second.prominence - first.prominence ||
    second.weight - first.weight || second.chroma - first.chroma);

  while (palette.length < paletteSize) {
    palette.push({ ...palette[palette.length % medoids.length], weight: 0, prominence: 0 });
  }

  return palette.map(({ rgb, weight }) => ({ rgb, weight }));
}

/** @param {Rgb} rgb */
export function rgbToHex(rgb) {
  return "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

/**
 * Existing CIE Lab metadata is retained for the gallery's similarity search.
 * @param {Rgb} rgb
 */
export function rgbToLab([red, green, blue]) {
  const linear = [red, green, blue].map(linearize);
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const pivot = (value) =>
    value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116;
  const pivotX = pivot(x);
  const pivotY = pivot(y);
  const pivotZ = pivot(z);

  return [
    Number((116 * pivotY - 16).toFixed(4)),
    Number((500 * (pivotX - pivotY)).toFixed(4)),
    Number((200 * (pivotY - pivotZ)).toFixed(4)),
  ];
}
