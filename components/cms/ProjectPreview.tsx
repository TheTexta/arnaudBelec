import { notFound, redirect } from "next/navigation";
import { DefaultTemplate } from "@payloadcms/next/templates";
import type { AdminViewServerProps } from "payload";
import { isCmsUser } from "@/lib/cms/auth";
import { siteExpansionEnabled } from "@/lib/cms/site-access";
import { toPublicProject } from "@/lib/site/public";
import { ProjectDetail } from "@/components/site/ProjectDetail";
import { PalettePreview } from "@/components/site/PalettePreview";
import { nonPhotoFonts } from "@/app/non-photo-fonts";
import "@/app/blog/blog.css";

export async function ProjectPreview(props: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = props.initPageResult;
  if (!isCmsUser(req.user)) redirect("/cms/login");
  if (!siteExpansionEnabled()) notFound();
  const query = (await props.searchParams) ?? {};
  const collection = query.collection;
  const id = query.id;
  if ((collection !== "videos" && collection !== "fashion-projects") || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const raw = await req.payload.findByID({ collection, id, draft: true, depth: 1, overrideAccess: false, req, disableErrors: true });
  if (!raw) notFound();
  const project = toPublicProject(raw, collection === "videos" ? "video" : "fashion");
  return <DefaultTemplate i18n={req.i18n} locale={locale} params={props.params} payload={req.payload} permissions={permissions} req={req} searchParams={props.searchParams} user={props.user} visibleEntities={visibleEntities}>
    <div className={nonPhotoFonts}><PalettePreview preset="fashion" palette={project.palette}><ProjectDetail project={project} preview /></PalettePreview></div>
  </DefaultTemplate>;
}
