import Link from "next/link";
import type { ProjectKind, PublicProject } from "@/lib/site/types";
import { ProjectMedia } from "./ProjectMedia";
import "./site.css";

export function ProjectIndex({ kind, projects }: { kind: ProjectKind; projects: PublicProject[] }) {
  const title = kind === "video" ? "Video" : "Fashion";
  return <main className={`site-project-index site-project-index--${kind}`}>
    <h1>{title}</h1>
    {projects.length ? <div className="site-project-list">
      {projects.map((project, index) => <article className="site-project-entry" key={project.id}>
        {project.cover ? <ProjectMedia media={project.cover} eager={index === 0} href={`/${kind}/${encodeURIComponent(project.slug)}`} linkLabel={`View ${project.title}`} /> : null}
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
