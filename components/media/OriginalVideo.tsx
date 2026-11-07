"use client";

import { useRef, useState } from "react";
import { canAutomaticallyRenew, renewedVideoSource, restoredVideoPosition } from "@/lib/media/video-recovery";

type Props = { src: string; label: string; poster?: string };

function VideoSession({ src, label, poster }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const recovery = useRef({ position: 0, wantsToPlay: false, automaticUsed: false, loading: false, ignoreLoadPause: false, attempt: 0, generation: 0, expectedSource: src });
  const [failed, setFailed] = useState(false);

  function rememberPosition() {
    const element = video.current;
    if (element && !element.error && !recovery.current.loading && Number.isFinite(element.currentTime)) recovery.current.position = element.currentTime;
  }

  function renew(automatic: boolean) {
    const element = video.current;
    if (!element) return;
    const state = recovery.current;
    state.generation++;
    if (automatic && !canAutomaticallyRenew(element.error?.code, navigator.onLine, state.automaticUsed)) {
      state.loading = false;
      setFailed(true);
      return;
    }
    const next = renewedVideoSource(src, state.attempt + 1);
    if (!next) { setFailed(true); return; }
    state.automaticUsed ||= automatic;
    state.attempt++;
    state.loading = true;
    state.ignoreLoadPause = !element.paused;
    state.expectedSource = next;
    setFailed(false);
    element.src = next;
    element.load();
  }

  function loadedMetadata() {
    const element = video.current;
    const state = recovery.current;
    if (!element || !state.loading || element.getAttribute("src") !== state.expectedSource || element.readyState < 1) return;
    const position = restoredVideoPosition(state.position, element.duration);
    element.currentTime = position;
    state.loading = false;
    if (state.wantsToPlay) {
      const generation = state.generation;
      // User intent survives an interrupted request, but a rejected play() is
      // never another automatic network retry or permission to force autoplay.
      void element.play().catch(() => {
        if (video.current === element && recovery.current.generation === generation && !recovery.current.loading) setFailed(true);
      });
    }
  }

  return <div>
    <video ref={video} src={src} poster={poster} controls playsInline preload="metadata" aria-label={label}
      onTimeUpdate={rememberPosition} onSeeking={rememberPosition}
      onPlay={() => { recovery.current.ignoreLoadPause = false; recovery.current.wantsToPlay = true; }}
      onPause={() => {
        if (recovery.current.ignoreLoadPause) { recovery.current.ignoreLoadPause = false; return; }
        if (!video.current?.error) recovery.current.wantsToPlay = false;
      }}
      onLoadedMetadata={loadedMetadata} onError={() => renew(true)}>
      <a href={src}>Open the original video</a>
    </video>
    {failed ? <div role="status">
      <p>Video unavailable. Check your connection or sign in again, then retry.</p>
      <button type="button" className="blog-button" style={{ minHeight: 44 }} onClick={() => renew(false)}>Retry video</button>
      {" "}<a href={src}>Open the original video</a>
    </div> : null}
  </div>;
}

export function OriginalVideo(props: Props) {
  // A new media identity gets a fresh recovery budget and no stale position.
  return <VideoSession key={props.src} {...props} />;
}
