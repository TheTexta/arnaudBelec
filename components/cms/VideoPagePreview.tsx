import { notFound, redirect } from "next/navigation";
import { DefaultTemplate } from "@payloadcms/next/templates";
import type { AdminViewServerProps } from "payload";
import { isCmsUser } from "@/lib/cms/auth";
import { siteExpansionEnabled } from "@/lib/cms/site-access";
import { getPublicProjects, toPublicSiteSettings } from "@/lib/site/public";
import { ProjectIndex } from "@/components/site/ProjectIndex";
import { nonPhotoFonts } from "@/app/non-photo-fonts";

export async function VideoPagePreview(props: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = props.initPageResult;
  if (!isCmsUser(req.user)) redirect("/cms/login");
  if (!siteExpansionEnabled()) notFound();
  const raw = await req.payload.findGlobal({ slug: "site-settings", draft: true, depth: 0, overrideAccess: false, req });
  const settings = toPublicSiteSettings(raw);
  const projects = await getPublicProjects("video", [settings.videoPage.featuredVideoId, ...settings.videoPage.orderedVideoIds].filter((id): id is string => Boolean(id)));
  return <DefaultTemplate i18n={req.i18n} locale={locale} params={props.params} payload={req.payload} permissions={permissions} req={req} searchParams={props.searchParams} user={props.user} visibleEntities={visibleEntities}>
    <div className={`${nonPhotoFonts} site-project-preview site-project-preview--video`}>
      <p className="site-preview-notice" role="status">Private preview. Unpublished changes are not visible on the public site.</p>
      <ProjectIndex kind="video" projects={projects} videoPage={settings.videoPage} />
    </div>
  </DefaultTemplate>;
}
