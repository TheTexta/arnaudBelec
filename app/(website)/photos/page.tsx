import type { Metadata } from "next";
import PhotoPage from "@/app/photo-page";
import { getPublicSiteSettings } from "@/lib/site/public";
import { loadPublicPhotographs } from "@/lib/supabase-public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Photography — Arnaud Belec",
  description: "Explore photographs by Arnaud Belec through colour and monochrome.",
  alternates: { canonical: "/photos" },
};

export default async function Page() {
  const [photographs, settings] = await Promise.all([loadPublicPhotographs(), getPublicSiteSettings()]);
  return <PhotoPage photographs={photographs} photoGroups={{ colourPhotoIds: settings.colourPhotoIds, monochromePhotoIds: settings.monochromePhotoIds }} />;
}
