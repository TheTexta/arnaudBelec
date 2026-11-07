import type { ProjectKind, PublicProject } from "@/lib/site/types";
import { getPublicProjects } from "@/lib/site/public";
import { ProjectIndex } from "./ProjectIndex";
import { ProjectUnavailable } from "./ProjectState";

export async function ProjectFeed({ kind }: { kind: ProjectKind }) {
  let projects: PublicProject[];
  try {
    projects = await getPublicProjects(kind);
  } catch {
    return <ProjectUnavailable kind={kind} />;
  }
  return <ProjectIndex kind={kind} projects={projects} />;
}
