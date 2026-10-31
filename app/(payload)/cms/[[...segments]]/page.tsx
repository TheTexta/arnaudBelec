import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";
import { notFound } from "next/navigation";
import { cmsEnabled } from "@/lib/cms/session";

export const dynamic = "force-dynamic";
type Args = { params: Promise<{ segments: string[] }>; searchParams: Promise<Record<string, string | string[]>> };
export const generateMetadata = ({ params, searchParams }: Args) => {
  if (!cmsEnabled()) return { title: "Not found", robots: { index: false, follow: false } };
  return generatePageMetadata({ config, params, searchParams });
};
export default function Page({ params, searchParams }: Args) {
  if (!cmsEnabled()) notFound();
  return RootPage({ config, importMap, params, searchParams });
}
