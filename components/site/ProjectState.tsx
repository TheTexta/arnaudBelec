import Link from "next/link";
import type { ProjectKind } from "@/lib/site/types";

export function ProjectLoading({ kind }: { kind: ProjectKind }) {
  return <main className="site-project-index" aria-busy="true"><h1>{kind === "video" ? "Video" : "Fashion"}</h1><p className="site-loading" role="status">Loading projects…</p></main>;
}

export function ProjectUnavailable({ kind, slug }: { kind: ProjectKind; slug?: string }) {
  const href = `/${kind}${slug ? `/${encodeURIComponent(slug)}` : ""}`;
  return <main className="site-project-index"><h1>{kind === "video" ? "Video" : "Fashion"}</h1><section className="site-empty" role="status">
    <h2>Projects could not be loaded.</h2><p>Try again, or explore the photographs while this section is unavailable.</p>
    <a href={href}>Try again</a><Link href="/photos">Explore the photographs</Link>
  </section></main>;
}
