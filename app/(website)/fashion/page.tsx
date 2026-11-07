import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectFeed } from "@/components/site/ProjectFeed";
import { ProjectLoading } from "@/components/site/ProjectState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fashion — Arnaud Belec",
  description: "Fashion projects and collections by Arnaud Belec.",
  alternates: { canonical: "/fashion" },
};

export default function Page() {
  return <Suspense fallback={<ProjectLoading kind="fashion" />}><ProjectFeed kind="fashion" /></Suspense>;
}
