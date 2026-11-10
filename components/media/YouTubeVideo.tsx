"use client";

import { useEffect, useRef, useState } from "react";
import { registerExternalMedia } from "@/lib/audio/external-media";
import { youtubeVideoId } from "@/lib/media/youtube";
import styles from "./youtube.module.css";

type Props = { videoId: string; label: string; poster?: string; posterAlt?: string };
type Player = {
  playVideo: () => void; pauseVideo: () => void; mute: () => void; unMute: () => void;
  isMuted: () => boolean; getPlayerState: () => number;
  destroy: () => void; getIframe: () => HTMLIFrameElement;
};
type PlayerEvent = { target: Player; data: number };
type YouTubeAPI = { Player: new (element: HTMLElement, options: {
  videoId: string; host: string; playerVars: Record<string, number | string>;
  events: { onReady: (event: PlayerEvent) => void; onStateChange: (event: PlayerEvent) => void; onError: () => void; onAutoplayBlocked: () => void };
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
  const frame = useRef<HTMLDivElement>(null);
  const session = useRef<{ start: () => void; sound: (enabled: boolean) => void; togglePlayback: () => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "blocked" | "error">("loading");
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    let generation = 0;
    let player: Player | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    let ready = false;
    let inView = false;
    let audible = false;
    let forcedMute = false;
    const visible = () => inView && !document.hidden;
    const release = () => { audible = false; registration.release(); };
    const silence = () => {
      // Commands cross the iframe asynchronously. Ignore stale unmuted state
      // until this mute is acknowledged, rather than reclaiming a new audio owner.
      forcedMute = audible || (ready && Boolean(player && !player.isMuted()));
      if (ready) player?.mute();
      release();
      if (live) setMuted(true);
    };
    const registration = registerExternalMedia(silence);
    const syncSound = () => {
      if (!ready || !player) return;
      const quiet = player.isMuted();
      if (!visible()) { if (!quiet) silence(); else release(); return; }
      // Reassert pending silence if native controls raced its acknowledgement.
      // The explicit Unmute action always overrides this pending intent.
      if (forcedMute && !quiet) { player.mute(); return; }
      if (quiet) forcedMute = false;
      setMuted(quiet);
      const playing = [1, 3].includes(player.getPlayerState());
      if (!quiet && playing && !audible) { audible = true; registration.activate(); }
      else if (quiet || !playing) release();
    };
    const syncVisibility = () => {
      if (!ready || !player) return;
      // Every viewport/tab re-entry is silent, even after an earlier unmute.
      silence();
      if (visible()) player.playVideo();
      else player.pauseVideo();
    };
    const stop = () => {
      generation++;
      clearTimeout(timer);
      ready = false;
      const previous = player;
      player = null;
      previous?.destroy();
      mount.current?.replaceChildren();
      release();
    };
    const start = () => {
      stop();
      const request = ++generation;
      setStatus("loading");
      setMuted(true);
      setPlaying(false);
      const fail = () => { if (live && request === generation) { stop(); setMuted(true); setPlaying(false); setStatus("error"); } };
      // Bound initialization, not playback: an off-screen player should be paused.
      timer = setTimeout(fail, 20_000);
      void loadYouTube().then((api) => {
        if (!live || request !== generation || !mount.current) return;
        const target = document.createElement("div");
        mount.current.replaceChildren(target);
        player = new api.Player(target, {
          videoId, host: "https://www.youtube-nocookie.com",
          playerVars: { autoplay: 0, mute: 1, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
          events: {
            onReady: (event) => {
              if (!live || request !== generation) return;
              const iframe = event.target.getIframe();
              iframe.title = label;
              iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
              iframe.allowFullscreen = true;
              ready = true;
              clearTimeout(timer);
              setStatus("ready");
              syncVisibility();
            },
            onStateChange: (event) => {
              if (!live || request !== generation) return;
              setPlaying([1, 3].includes(event.data));
              if ([1, 3].includes(event.data) && !visible()) { silence(); event.target.pauseVideo(); }
              else { if (event.data === 1) setStatus("ready"); syncSound(); }
            },
            onError: fail,
            onAutoplayBlocked: () => { if (live && request === generation) { silence(); setStatus("blocked"); } },
          },
        });
      }).catch(fail);
    };
    session.current = { start, sound: (enabled) => {
      if (!ready || !player || !visible()) return;
      if (enabled) {
        // Claim sound synchronously in the user gesture, never during autoplay.
        forcedMute = false;
        audible = true;
        registration.activate();
        player.unMute();
        player.playVideo();
        setMuted(false);
      } else silence();
    }, togglePlayback: () => {
      if (!ready || !player || !visible()) return;
      if ([1, 3].includes(player.getPlayerState())) player.pauseVideo();
      else player.playVideo();
    } };
    const observer = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      if (next !== inView) { inView = next; syncVisibility(); }
    }, { threshold: [0, 0.25] });
    if (frame.current) observer.observe(frame.current);
    document.addEventListener("visibilitychange", syncVisibility);
    // YouTube has no volume-change event; also coordinate its native mute control.
    const soundPoll = setInterval(syncSound, 250);
    start();
    return () => {
      live = false; observer.disconnect(); clearInterval(soundPoll);
      document.removeEventListener("visibilitychange", syncVisibility);
      stop(); registration.dispose(); session.current = null;
    };
  }, [videoId, label]);

  return <div className={styles.video}>
    <div ref={frame} className={styles.frame}>
      {status === "error" ? <div className={styles.cover}>
        {/* Preserve the CMS-served original without image transformation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {poster && !posterFailed ? <img src={poster} alt={posterAlt || ""} className={styles.poster}
          loading="lazy" onError={() => setPosterFailed(true)} /> : null}
        <button type="button" className={styles.retry} aria-label={`Retry video: ${label}`} onClick={() => session.current?.start()}>
          Retry video<span className={styles.srOnly}>: {label}</span>
        </button>
      </div> : null}
      <div ref={mount} className={styles.mount} hidden={status === "error"} />
      {muted && (status === "ready" || status === "blocked") ? <button type="button" className={styles.unmute}
        aria-label={`Unmute video: ${label}`} onClick={() => session.current?.sound(true)}>
        <span>Unmute<span className={styles.srOnly}>: {label}</span></span>
      </button> : null}
    </div>
    <div className={styles.actions}>
      {status === "ready" || status === "blocked" ? <button type="button" aria-label={`${playing ? "Pause video" : "Resume video"}: ${label}`}
        onClick={() => session.current?.togglePlayback()}>{playing ? "Pause video" : "Resume video"}<span className={styles.srOnly}>: {label}</span></button> : null}
      {!muted ? <button type="button" aria-label={`Mute video: ${label}`} onClick={() => session.current?.sound(false)}>Mute video<span className={styles.srOnly}>: {label}</span></button> : null}
      <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
        title={`Watch ${label} on YouTube`}>Watch on YouTube<span className={styles.srOnly}>: {label} (opens in a new tab)</span></a>
    </div>
    <div role="status" className={styles.status}>
      {status === "loading" ? "Loading YouTube player…" : status === "error"
        ? "This video could not play here. Retry, or watch on YouTube. The video may be private, unavailable or restricted from embedding."
        : status === "blocked" ? "Autoplay was blocked by your browser. Use the YouTube play control, or select Unmute to play with sound."
        : muted ? "Plays muted while in view. Select the video to unmute." : "Sound on. Use the YouTube controls to play or pause."}
    </div>
  </div>;
}

export function YouTubeVideo(props: Props) {
  const videoId = youtubeVideoId(props.videoId);
  if (!videoId) return <p role="status">Video unavailable: a valid YouTube video is required.</p>;
  // Error covers use only the existing same-origin CMS endpoint.
  const poster = props.poster?.startsWith("/") && !props.poster.startsWith("//") && !props.poster.includes("\\") ? props.poster : undefined;
  return <YouTubeSession key={`${videoId}:${props.label}:${poster || ""}`} {...props} poster={poster} videoId={videoId} />;
}
