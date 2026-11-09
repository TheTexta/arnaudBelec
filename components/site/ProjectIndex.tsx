import Link from "next/link";
import type { ProjectKind, PublicProject, VideoPageSettings } from "@/lib/site/types";
import { ProjectPlayback } from "./ProjectPlayback";
import { ProjectMedia } from "./ProjectMedia";
import { arrangeVideos } from "@/lib/site/video-page";
import "./site.css";

export function ProjectIndex({ kind, projects, videoPage }: { kind: ProjectKind; projects: PublicProject[]; videoPage?: VideoPageSettings }) {
  const title = kind === "video" ? videoPage?.heading || "Video" : "Fashion";
  const ordered = kind === "video" && videoPage ? arrangeVideos(projects, videoPage) : projects;
  return <main className={`site-project-index site-project-index--${kind}`}>
    <h1>{title}</h1>
    {kind === "video" && videoPage?.intro ? <p className="site-video-intro">{videoPage.intro}</p> : null}
    {ordered.length ? <div className="site-project-list">
      {ordered.map((project, index) => <article className={`site-project-entry${kind === "video" && project.id === videoPage?.featuredVideoId ? " site-project-entry--featured" : ""}`} key={project.id}>
        {kind === "video" && project.id === videoPage?.featuredVideoId ? <p className="site-featured-label">Featured film</p> : null}
        {kind === "video" ? <ProjectPlayback project={project} eager={index === 0} coverHref={`/${kind}/${encodeURIComponent(project.slug)}`} /> : project.cover ? <ProjectMedia media={project.cover} eager={index === 0} href={`/fashion/${encodeURIComponent(project.slug)}`} linkLabel={`View ${project.title}`} /> : null}
        <Link className="site-project-link" href={`/${kind}/${encodeURIComponent(project.slug)}`}>
          <div className="site-project-heading"><h2>{project.title}</h2>{project.year ? <span>{project.year}</span> : null}</div>
        </Link>
        {project.excerpt ? <p>{project.excerpt}</p> : null}
      </article>)}
    </div> : <section className="site-empty">
      <h2>{kind === "video" ? "No films published yet." : "No fashion projects published yet."}</h2>
      <p>{kind === "video" ? "Films will appear here as they are released." : "Collections and projects will appear here when available."}</p>
      <Link href="/photos">Explore the photographs</Link>
      <Link href="/blog">Read the Journal</Link>
    </section>}
  </main>;
}
