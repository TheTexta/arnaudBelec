"use client";

import { useEffect, useRef, useState } from "react";
import { registerExternalMedia } from "@/lib/audio/external-media";
import { youtubeVideoId } from "@/lib/media/youtube";
import styles from "./youtube.module.css";

type Props = { videoId: string; label: string; poster?: string; posterAlt?: string };
type Player = { playVideo: () => void; destroy: () => void; getIframe: () => HTMLIFrameElement };
type PlayerEvent = { target: Player; data: number };
type YouTubeAPI = { Player: new (element: HTMLElement, options: {
  videoId: string; host: string; playerVars: Record<string, number | string>;
  events: { onReady: (event: PlayerEvent) => void; onStateChange: (event: PlayerEvent) => void; onError: () => void };
}) => Player };
type YouTubeWindow = Window & { YT?: YouTubeAPI };

let sdkRequest: Promise<YouTubeAPI> | null = null;
function loadYouTube(): Promise<YouTubeAPI> {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (sdkRequest) return sdkRequest;
  // Do not replace onYouTubeIframeAPIReady: another embed may own that callback.
  sdkRequest = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    const finish = (api?: YouTubeAPI) => {
      clearInterval(poll);
      clearTimeout(timeout);
      script.onerror = null;
      if (api) resolve(api);
      else { script.remove(); reject(new Error("YouTube player unavailable")); }
    };
    const poll = setInterval(() => { if (host.YT?.Player) finish(host.YT); }, 50);
    const timeout = setTimeout(() => finish(), 12_000);
    script.onerror = () => finish();
    document.head.append(script);
  }).catch((error: unknown) => { sdkRequest = null; throw error; });
  return sdkRequest;
}

function YouTubeSession({ videoId, label, poster, posterAlt }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const session = useRef<{ stop: (failed?: boolean) => void; start: () => void } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    let generation = 0;
    let player: Player | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    let opened = false;
    const stop = (failed = false) => {
      opened = false;
      generation++;
      clearTimeout(timer);
      const previous = player;
      player = null;
      previous?.destroy();
      mount.current?.replaceChildren();
      registration.release();
      if (live) setStatus(failed ? "error" : "idle");
    };
    const registration = registerExternalMedia(() => { if (opened) stop(); });
    const start = () => {
      stop();
      opened = true;
      const request = ++generation;
      registration.activate();
      setStatus("loading");
      const fail = () => { if (live && request === generation) stop(true); };
      // A loaded iframe is not evidence of playback. Bound SDK, ready and play waits.
      timer = setTimeout(fail, 20_000);
      void loadYouTube().then((api) => {
        if (!live || request !== generation || !mount.current) return;
        const target = document.createElement("div");
        mount.current.replaceChildren(target);
        player = new api.Player(target, {
          videoId, host: "https://www.youtube-nocookie.com",
          playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
          events: {
            onReady: (event) => {
              if (!live || request !== generation) return;
              const iframe = event.target.getIframe();
              iframe.title = label;
              iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
              iframe.allowFullscreen = true;
              setStatus("ready");
              // This request follows the visitor's Play action; browser policy may
              // still require a second gesture inside YouTube's native controls.
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (!live || request !== generation) return;
              if (event.data === 1 || event.data === 3) {
                registration.activate();
                if (event.data === 1) clearTimeout(timer);
              } else if (event.data === 0 || event.data === 2) {
                clearTimeout(timer);
                registration.release();
              }
            },
            onError: fail,
          },
        });
      }).catch(fail);
    };
    session.current = { stop, start };
    return () => { live = false; stop(); registration.dispose(); session.current = null; };
  }, [videoId, label]);

  const open = status === "loading" || status === "ready";
  return <div className={styles.video}>
    <div className={styles.frame}>
      {!open ? <div className={styles.cover}>
        {/* Preserve the CMS-served original without image transformation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {poster && !posterFailed ? <img src={poster} alt={posterAlt || ""} className={styles.poster}
          loading="lazy" onError={() => setPosterFailed(true)} /> : null}
        <button type="button" className={styles.play} aria-label={`${status === "error" ? "Retry video" : "Play video"}: ${label}`} onClick={() => session.current?.start()}>
          {status === "error" ? "Retry video" : "Play video"}<span className={styles.srOnly}>: {label}</span>
        </button>
      </div> : null}
      <div ref={mount} className={styles.mount} hidden={!open} />
    </div>
    <div className={styles.actions}>
      {open ? <button type="button" aria-label={`Close player: ${label}`} onClick={() => session.current?.stop()}>Close player<span className={styles.srOnly}>: {label}</span></button> : null}
      <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
        title={`Watch ${label} on YouTube`}>Watch on YouTube<span className={styles.srOnly}>: {label} (opens in a new tab)</span></a>
    </div>
    <div role="status" className={styles.status}>
      {status === "loading" ? "Loading YouTube player…" : status === "error"
        ? "This video could not play here. Retry, or watch on YouTube. The video may be private, unavailable or restricted from embedding."
        : status === "ready" ? "Use the YouTube controls to play or pause." : "YouTube loads only when you select Play video."}
    </div>
  </div>;
}

export function YouTubeVideo(props: Props) {
  const videoId = youtubeVideoId(props.videoId);
  if (!videoId) return <p role="status">Video unavailable: a valid YouTube video is required.</p>;
  // Native public/preview covers use the same-origin CMS endpoint. Do not let a
  // supplied remote thumbnail undermine the click-to-load privacy boundary.
  const poster = props.poster?.startsWith("/") && !props.poster.startsWith("//") && !props.poster.includes("\\") ? props.poster : undefined;
  return <YouTubeSession key={`${videoId}:${props.label}:${poster || ""}`} {...props} poster={poster} videoId={videoId} />;
}
