const nativeVideoPath = /^\/api\/cms\/media\/file\/[^/?#]+$/;

export function renewedVideoSource(source: string, attempt: number): string | null {
  // Never renew currentSrc: it may be an expiring storage capability. Only the
  // original same-origin, access-controlled application URL may mint another.
  if (!nativeVideoPath.test(source) || !Number.isSafeInteger(attempt) || attempt < 1) return null;
  return `${source}?video-retry=${attempt}`;
}

export function restoredVideoPosition(position: number, duration: number) {
  if (!Number.isFinite(position) || position < 0) return 0;
  return Number.isFinite(duration) && duration > 0 ? Math.min(position, Math.max(0, duration - 0.05)) : position;
}

export function canAutomaticallyRenew(code: number | undefined, online: boolean, alreadyUsed: boolean) {
  // Decode/codec failures are not evidence of an expired capability. One network
  // recovery per source is deliberate; later failures require an explicit Retry.
  return online && !alreadyUsed && (code === 1 || code === 2);
}
