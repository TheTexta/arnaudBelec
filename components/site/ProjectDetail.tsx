import Link from "next/link";
import BlogContent from "@/app/blog/content";
import type { PublicProject } from "@/lib/site/types";
import { ProjectMedia } from "./ProjectMedia";
import { ProjectPlayback } from "./ProjectPlayback";
import { TurntableViewer } from "@/components/garment-viewer/TurntableViewer";
import "./site.css";

export function ProjectDetail({ project, preview = false }: { project: PublicProject; preview?: boolean }) {
  const isFashion = project.kind === "fashion";
  const hasMedia = project.cover || project.film || project.youtubeId || project.gallery.length || project.turntableFrames.length;
  return <main className={`site-project-detail site-project-detail--${project.kind}${preview ? ` site-project-preview site-project-preview--${project.kind}` : ""}`}>
    {preview ? <p className="site-preview-notice" role="status">Private preview. Unpublished changes are not visible on the public site.</p> : null}
    <Link className="site-project-back" href={`/${project.kind}`}>All {project.kind === "video" ? "films" : "fashion projects"}</Link>
    <header className="site-detail-header">
      <h1>{project.title}</h1>
      {project.year ? <p className="site-project-year">{project.year}</p> : null}
      {isFashion && project.excerpt ? <p className="site-project-excerpt">{project.excerpt}</p> : null}
    </header>
    <ProjectPlayback project={project} eager />
    {!hasMedia ? <p className="site-detail-empty">Images and media for this project are not available yet.</p> : null}
    {!isFashion && project.excerpt ? <p className="site-project-excerpt">{project.excerpt}</p> : null}
    {project.body ? <div className="site-project-body"><BlogContent body={project.body} /></div> : null}
    {project.credits ? <section className="site-project-credits"><h2>Credits</h2><p>{project.credits}</p></section> : null}
    {project.turntableFrames.length ? <section className="site-project-views" aria-labelledby="project-views-heading">
      <h2 id="project-views-heading">Views</h2>
      <TurntableViewer frames={project.turntableFrames} label={`${project.title} — garment views`} />
    </section> : null}
    {project.gallery.length ? <section className="site-project-gallery" aria-label="Project gallery">{project.gallery.map((media) => <ProjectMedia key={media.id} media={media} />)}</section> : null}
  </main>;
}
