"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { homePreview, HomeSection } from "@/lib/site/homepage";

export function HomePreview({ section, label, href, preview }: { section: HomeSection; label: string; href: string; preview: ReturnType<typeof homePreview> }) {
  const [failed, setFailed] = useState(false);
  return <Link className={`home-preview home-preview--${section}${!preview || failed ? " home-preview--text" : ""}`} href={href}>
    {preview && !failed ? <Image src={preview.src} alt={preview.alt} width={preview.width} height={preview.height} unoptimized={preview.native} loading="eager" fetchPriority={section === "photography" ? "high" : "auto"} sizes="(max-width: 700px) 82vw, 38vw" onError={() => setFailed(true)} /> : null}
    <span className="home-preview-label">{label}</span>
    {failed ? <span className="home-preview-status">Image unavailable. Explore {label.toLowerCase()}.</span> : null}
  </Link>;
}
