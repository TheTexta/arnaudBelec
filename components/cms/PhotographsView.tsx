import { redirect } from "next/navigation";
import { DefaultTemplate } from "@payloadcms/next/templates";
import type { AdminViewServerProps } from "payload";
import { isCmsUser } from "@/lib/cms/auth";
import { PhotographsClient } from "./PhotographsClient";
import { PreviewClient } from "./PreviewClient";

function ProtectedView(props: AdminViewServerProps & { children: React.ReactNode }) {
  const { req, permissions, locale, visibleEntities } = props.initPageResult;
  if (!isCmsUser(req.user)) redirect("/cms/login");
  return <DefaultTemplate i18n={req.i18n} locale={locale} params={props.params} payload={req.payload} permissions={permissions} req={req} searchParams={props.searchParams} user={props.user} visibleEntities={visibleEntities}>{props.children}</DefaultTemplate>;
}
export function PhotographsView(props: AdminViewServerProps) {
  const user = props.initPageResult.req.user;
  if (!isCmsUser(user)) redirect("/cms/login");
  return <ProtectedView {...props}><PhotographsClient userId={String(user!.id)} email={String(user!.email ?? "")} /></ProtectedView>;
}
export function PreviewView(props: AdminViewServerProps) { return <ProtectedView {...props}><PreviewClient /></ProtectedView>; }
