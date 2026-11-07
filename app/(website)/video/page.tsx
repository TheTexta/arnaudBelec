import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFeed } from "@/components/site/ProjectFeed";
import { ProjectLoading } from "@/components/site/ProjectState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Video — Arnaud Belec",
  description: "Films and moving-image projects by Arnaud Belec.",
  alternates: { canonical: "/video" },
};

export default function Page() {
  return <Suspense fallback={<ProjectLoading kind="video" />}><ProjectFeed kind="video" /></Suspense>;
}
