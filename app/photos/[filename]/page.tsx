import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicPhotographs } from "@/lib/supabase-public";
import PhotoDetail from "./photo-detail";

type PhotoPageProps = {
  params: Promise<{ filename: string }>;
};

// Newly published photographs should be reachable without rebuilding the site.
export const dynamic = "force-dynamic";

function decodedFilename(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PhotoPageProps): Promise<Metadata> {
  const filename = decodedFilename((await params).filename);
  const photograph = (await loadPublicPhotographs()).find((item) => item.filename === filename);
  if (!photograph) return { title: "Photograph not found — Arnaud Belec" };

  const title = photograph.title?.trim() || photograph.filename;
  const description = photograph.altText?.trim() || "Photograph by Arnaud Belec";

  return {
    title: `${title} — Arnaud Belec`,
    description,
    openGraph: {
      title: `${title} — Arnaud Belec`,
      description,
      type: "article",
      images: [{
        url: photograph.src,
        width: photograph.width,
        height: photograph.height,
        alt: description,
      }],
    },
  };
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const filename = decodedFilename((await params).filename);
  const photographs = await loadPublicPhotographs();
  const photograph = photographs.find((item) => item.filename === filename);
  if (!photograph) notFound();

  return <PhotoDetail key={photograph.id} photograph={photograph} photographs={photographs} />;
}
