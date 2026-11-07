export function frameIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || !Number.isInteger(count) || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}

export function draggedFrame(startIndex: number, deltaX: number, count: number): number {
  return frameIndex(startIndex + (Number.isFinite(deltaX) ? Math.trunc(deltaX / 28) : 0), count);
}
