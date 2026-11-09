import type { PublicProject } from "@/lib/site/types";
import { YouTubeVideo } from "@/components/media/YouTubeVideo";
import { ProjectMedia } from "./ProjectMedia";

export function ProjectPlayback({ project, eager = false, coverHref }: { project: PublicProject; eager?: boolean; coverHref?: string }) {
  const poster = project.cover?.mimeType.startsWith("image/") ? project.cover : null;
  if (project.kind === "video" && project.videoSource === "youtube" && project.youtubeId) {
    return <YouTubeVideo key={project.youtubeId} videoId={project.youtubeId} label={project.title} poster={poster?.url} posterAlt={poster?.alt} />;
  }
  if (project.film && (project.kind !== "video" || project.videoSource === "upload")) return <ProjectMedia key={project.film.id} media={project.film} eager={eager} poster={poster?.url} />;
  return project.cover ? <ProjectMedia key={project.cover.id} media={project.cover} eager={eager} href={coverHref} linkLabel={`View ${project.title}`} /> : null;
}
