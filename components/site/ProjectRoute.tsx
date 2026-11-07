import { notFound } from "next/navigation";
import type { ProjectKind } from "@/lib/site/types";
import { ProjectDetail } from "./ProjectDetail";
import { ProjectUnavailable } from "./ProjectState";
import { readPublicProject } from "./project-data";

export async function ProjectRoute({ kind, slug }: { kind: ProjectKind; slug: string }) {
  const { project, unavailable } = await readPublicProject(kind, slug);
  if (unavailable) return <ProjectUnavailable kind={kind} slug={slug} />;
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
