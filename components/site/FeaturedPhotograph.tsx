"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { imagePlaceholder } from "@/lib/photographs/image-placeholder";
import type { PublicPhotograph } from "@/lib/supabase-public";

export function FeaturedPhotograph({ photograph }: { photograph: PublicPhotograph }) {
  const [failed, setFailed] = useState(false);
  return <figure>
    {failed ? <div className="site-media-error" role="status"><p>The featured photograph could not be loaded.</p><Link href="/photos">Explore the photographs</Link></div> : <Link href={`/photos/${encodeURIComponent(photograph.filename)}`} aria-label={`View ${photograph.title || "photograph"}`}>
      <Image src={photograph.src} alt={photograph.altText || photograph.title || "Photograph by Arnaud Belec"} width={photograph.width} height={photograph.height} loading="eager" fetchPriority="high" sizes="(max-width: 700px) calc(100vw - 40px), 68vw" placeholder="blur" blurDataURL={imagePlaceholder(photograph.backgroundHex)} onError={() => setFailed(true)} />
    </Link>}
    {photograph.title ? <figcaption>{photograph.title}</figcaption> : null}
  </figure>;
}
