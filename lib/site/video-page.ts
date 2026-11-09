import type { PublicProject, VideoPageSettings } from "./types";

// Resolve only against freshly fetched published records, never populated CMS
// relationships: a selected film may have been unpublished since settings saved.
export function arrangeVideos(projects: PublicProject[], settings: VideoPageSettings) {
  const published = new Map(projects.filter(project => project.kind === "video").map(project => [project.id, project]));
  const ids = [settings.featuredVideoId, ...settings.orderedVideoIds, ...published.keys()];
  const seen = new Set<string>();
  return ids.flatMap(id => {
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const project = published.get(id);
    return project ? [project] : [];
  });
}
