import { notFound } from "next/navigation";
import type { ProjectKind } from "@/lib/site/types";
import { ProjectDetail } from "./ProjectDetail";
import { ProjectUnavailable } from "./ProjectState";
import { readPublicProject } from "./project-data";
import { PublicSiteFrame } from "./PublicSiteFrame";

export async function ProjectRoute({ kind, slug }: { kind: ProjectKind; slug: string }) {
  const { project, unavailable } = await readPublicProject(kind, slug);
  if (unavailable) return <PublicSiteFrame><ProjectUnavailable kind={kind} slug={slug} /></PublicSiteFrame>;
  if (!project) notFound();
  return <PublicSiteFrame palette={project.palette}><ProjectDetail project={project} /></PublicSiteFrame>;
}
