// One screen-space noise field is shared by every fallback orb canvas.
let cachedFrame = -1;
const cachedCells = new Map<string, number>();

export function orbNoiseAt(cellX: number, cellY: number, frame: number): number {
  if (frame !== cachedFrame) {
    cachedFrame = frame;
    cachedCells.clear();
  }

  const key = `${cellX},${cellY}`;
  const cached = cachedCells.get(key);
  if (cached !== undefined) return cached;

  const seed = Math.sin(cellX * 12.9898 + cellY * 78.233 + frame * 37.719) * 43758.5453;
  const noise = seed - Math.floor(seed) - 0.5;
  cachedCells.set(key, noise);
  return noise;
}
