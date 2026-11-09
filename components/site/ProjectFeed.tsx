import type { ProjectKind, PublicProject, VideoPageSettings } from "@/lib/site/types";
import { getPublicProjects } from "@/lib/site/public";
import { ProjectIndex } from "./ProjectIndex";
import { ProjectUnavailable } from "./ProjectState";

export async function ProjectFeed({ kind, videoPage }: { kind: ProjectKind; videoPage?: VideoPageSettings }) {
  let projects: PublicProject[];
  try {
    projects = await getPublicProjects(kind, videoPage ? [videoPage.featuredVideoId, ...videoPage.orderedVideoIds].filter((id): id is string => Boolean(id)) : []);
  } catch {
    return <ProjectUnavailable kind={kind} />;
  }
  return <ProjectIndex kind={kind} projects={projects} videoPage={videoPage} />;
}
