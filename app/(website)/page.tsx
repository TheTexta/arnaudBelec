import type { Metadata } from "next";
import { HomeEntrance } from "@/components/site/HomeEntrance";
import { getPublicSiteSettings } from "@/lib/site/public";
import { loadPublicPhotographs } from "@/lib/supabase-public";
import { PublicSiteFrame } from "@/components/site/PublicSiteFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arnaud Belec",
  description: "Photographs, films, fashion and writing by Arnaud Belec.",
  alternates: { canonical: "/" },
};

export default async function Page() {
  const [photographs, settings] = await Promise.all([loadPublicPhotographs(), getPublicSiteSettings()]);
  return <PublicSiteFrame><HomeEntrance photographs={photographs} settings={settings} /></PublicSiteFrame>;
}
