import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProject } from "@/lib/site/public";
import type { ProjectKind } from "@/lib/site/types";

// Metadata and the page share one public-only read within a request.
export const readPublicProject = cache(async (kind: ProjectKind, slug: string) => {
  try {
    return { project: await getPublicProject(kind, slug), unavailable: false };
  } catch {
    return { project: null, unavailable: true };
  }
});

export async function projectMetadata(kind: ProjectKind, slug: string): Promise<Metadata> {
  const { project, unavailable } = await readPublicProject(kind, slug);
  if (!project && !unavailable) notFound();
  if (!project) return { title: "Project unavailable — Arnaud Belec", robots: { index: false, follow: false } };
  const title = `${project.title} — Arnaud Belec`;
  const description = project.excerpt || `${project.title}, a ${kind === "video" ? "film" : "fashion project"} by Arnaud Belec.`;
  const canonical = `/${kind}/${encodeURIComponent(project.slug)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, ...(project.cover?.mimeType.startsWith("image/") ? { images: [{ url: project.cover.url, alt: project.cover.alt }] } : {}) },
  };
}
