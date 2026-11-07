"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicMedia } from "@/lib/site/types";
import { OriginalVideo } from "@/components/media/OriginalVideo";

export function ProjectMedia({ media, eager = false, poster, href, linkLabel }: { media: PublicMedia; eager?: boolean; poster?: string; href?: string; linkLabel?: string }) {
  const [failed, setFailed] = useState(false);
  const isImage = media.mimeType.startsWith("image/");
  const isVideo = media.mimeType.startsWith("video/");
  const isAudio = media.mimeType.startsWith("audio/");
  const label = media.alt || media.caption || media.filename;
  // Native CMS URLs deliberately bypass the public image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img src={media.url} alt={media.alt} width={media.width ?? undefined} height={media.height ?? undefined} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" onError={() => setFailed(true)} />;

  return <figure className="site-project-media">
    {failed || (!isImage && !isVideo && !isAudio) ? <div className="site-media-error" role="status">
      <p>This media could not be displayed.</p><a href={media.url}>Open the original file</a>
    </div> : isImage ? (href ? <Link href={href} aria-label={linkLabel}>{image}</Link> : image) : isVideo ? <OriginalVideo src={media.url} poster={poster} label={label} /> : <audio src={media.url} controls preload="metadata" aria-label={label} onError={() => setFailed(true)}><a href={media.url}>Open the audio</a></audio>}
    {media.caption ? <figcaption>{media.caption}</figcaption> : null}
  </figure>;
}
