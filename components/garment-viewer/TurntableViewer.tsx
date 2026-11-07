"use client";

import { useCallback, useId, useRef, useState, type PointerEvent } from "react";
import type { PublicMedia } from "@/lib/site/types";
import { draggedFrame, frameIndex } from "./frames";
import styles from "./turntable.module.css";

/** An ordered photographic image sequence, not generated geometry or reconstruction. */
export function TurntableViewer({ frames, label }: { frames: PublicMedia[]; label: string }) {
  // A changed project/sequence starts on its first supplied frame.
  return <Sequence key={JSON.stringify(frames.map((frame) => [frame.id, frame.url]))} frames={frames} label={label} />;
}

function Sequence({ frames, label }: { frames: PublicMedia[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const drag = useRef<{ id: number; x: number; index: number; last: number } | null>(null);
  const hintId = useId();
  const frame = frames[frameIndex(index, frames.length)];
  const frameUrl = frame?.url;
  // A cached SSR image can decode before React attaches its load listener.
  const attachImage = useCallback((image: HTMLImageElement | null) => {
    if (!image?.complete || !frameUrl) return;
    if (image.naturalWidth > 0) { setLoadedUrl(frameUrl); setFailedUrl(null); }
    else setFailedUrl(frameUrl);
  }, [frameUrl]);
  if (!frame) return null;
  const interactive = frames.length > 1;
  const failed = failedUrl === frame.url;
  const loading = loadedUrl !== frame.url && !failed;
  function move(event: PointerEvent<HTMLDivElement>, final = false) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    // No speculative preloads; cap drag-driven image requests, and settle on release.
    if (final || event.timeStamp - start.last >= 120) {
      setIndex(draggedFrame(start.index, event.clientX - start.x, frames.length));
      start.last = event.timeStamp;
    }
  }
  return <figure className={styles.viewer} aria-label={label}>
    <div className={interactive ? styles.sequence : styles.still}
      role={interactive ? "group" : undefined} tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${label}, image sequence` : undefined} aria-describedby={interactive ? hintId : undefined}
      onKeyDown={interactive ? (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        setIndex((value) => event.key === "Home" ? 0 : event.key === "End" ? frames.length - 1 :
          frameIndex(value + (event.key === "ArrowRight" ? 1 : -1), frames.length));
      } : undefined}
      onPointerDown={interactive ? (event) => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, index, last: event.timeStamp - 120 };
      } : undefined}
      onPointerMove={interactive ? (event) => move(event) : undefined}
      onPointerUp={interactive ? (event) => { move(event, true); drag.current = null; } : undefined}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      {/* Original URLs preserve CMS authorization redirects; only the selected frame is requested. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={frame.url} ref={attachImage} src={frame.url} alt={frame.alt || label}
        width={frame.width || undefined} height={frame.height || undefined} draggable={false}
        style={{ aspectRatio: frame.width && frame.height ? `${frame.width} / ${frame.height}` : undefined }}
        onLoad={() => { setLoadedUrl(frame.url); setFailedUrl(null); }} onError={() => setFailedUrl(frame.url)} hidden={failed} />
      {failed ? <p role="status">This image could not load. {interactive ? "Try another view or " : ""}<a href={frame.url}>open the original image</a>.</p> : null}
    </div>
    <figcaption>
      {frame.caption ? <p>{frame.caption}</p> : null}
      {interactive ? <>
        <p id={hintId}>Drag sideways or use the arrow keys to change view.</p>
        <div className={styles.controls}>
          <button type="button" disabled={index === 0} onClick={() => setIndex((value) => frameIndex(value - 1, frames.length))}>Previous view</button>
          <span role="status" aria-live="polite" aria-atomic="true">View {index + 1} of {frames.length}{loading ? " · Loading image…" : ""}</span>
          <button type="button" disabled={index === frames.length - 1} onClick={() => setIndex((value) => frameIndex(value + 1, frames.length))}>Next view</button>
          <button type="button" disabled={index === 0} onClick={() => setIndex(0)}>Reset view</button>
        </div>
      </> : null}
    </figcaption>
  </figure>;
}
