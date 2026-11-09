"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { PublicMedia } from "@/lib/site/types";
import { PublicAudioProvider } from "@/components/site-audio/PublicAudioProvider";

export function SiteAudioRoot({ track, children }: { track: PublicMedia | null; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return children;
  return <PublicAudioProvider track={track}>{children}</PublicAudioProvider>;
}
