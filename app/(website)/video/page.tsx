import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFeed } from "@/components/site/ProjectFeed";
import { ProjectLoading } from "@/components/site/ProjectState";
import { PublicSiteFrame } from "@/components/site/PublicSiteFrame";
import { getPublicSiteSettings } from "@/lib/site/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Video — Arnaud Belec",
  description: "Films and moving-image projects by Arnaud Belec.",
  alternates: { canonical: "/video" },
};

export default async function Page() {
  const settings = await getPublicSiteSettings();
  return <PublicSiteFrame><Suspense fallback={<ProjectLoading kind="video" />}><ProjectFeed kind="video" videoPage={settings.videoPage} /></Suspense></PublicSiteFrame>;
}
