// Browser-only registrations: mounting a player never starts media or loads an SDK.
const players = new Map<symbol, () => void>();
const active = new Set<symbol>();
const listeners = new Set<() => void>();

export function hasActiveExternalMedia() { return active.size > 0; }
export function subscribeExternalMedia(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notify() { for (const listener of listeners) listener(); }
function stopExternalMedia() {
  for (const stop of [...players.values()]) stop();
}
function nativePlay(event: Event) {
  if (event.target instanceof HTMLMediaElement) stopExternalMedia();
}

export function registerExternalMedia(stop: () => void) {
  const token = Symbol();
  if (!players.size) document.addEventListener("play", nativePlay, true);
  players.set(token, stop);
  return {
    activate() {
      if (!players.has(token)) return;
      active.add(token);
      for (const [other, pause] of [...players]) if (other !== token) pause();
      for (const media of document.querySelectorAll("audio, video")) {
        if (media instanceof HTMLMediaElement && !media.paused) media.pause();
      }
      notify();
    },
    release() { if (active.delete(token)) notify(); },
    dispose() {
      players.delete(token);
      if (active.delete(token)) notify();
      if (!players.size) document.removeEventListener("play", nativePlay, true);
    },
  };
}
