import type { ServerFunctionClient } from "payload";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import config from "@payload-config";
import { cmsEnabled, assertOrigin } from "@/lib/cms/session";
import { importMap } from "./cms/importMap";
import { nonPhotoFonts } from "@/app/non-photo-fonts";
import "@payloadcms/next/css";
import "@/app/site-font.css";
import "@/components/cms/cms.css";
import type { Viewport } from "next";

export const viewport: Viewport = { interactiveWidget: "resizes-content" };

const serverFunction: ServerFunctionClient = async args => {
  "use server";
  if (!cmsEnabled()) notFound();
  assertOrigin(await headers());
  return handleServerFunctions({ ...args, config, importMap });
};

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  if (!cmsEnabled()) notFound();
  return <RootLayout config={config} importMap={importMap} serverFunction={serverFunction} htmlProps={{ className: `${nonPhotoFonts} cms-admin` }}>{children}</RootLayout>;
}
