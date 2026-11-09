import type { Metadata } from "next";
import { nonPhotoFonts } from "@/app/non-photo-fonts";
import { SiteAudioRoot } from "@/components/site/SiteAudioRoot";
import { getPublicSiteSettings } from "@/lib/site/public";
import "@/app/globals.css";
import "@/app/site-font.css";
import "@/components/site/site.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://arnaud-belec.vercel.app"),
  title: "Arnaud Belec",
  description: "Photographs, films, fashion and writing by Arnaud Belec.",
};

// Published settings are request-time data, including on the not-found surface.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicSiteSettings();
  return (
    <html lang="en" className={`scroll-smooth motion-reduce:scroll-auto ${nonPhotoFonts}`}>
      <body className="min-h-full min-w-80"><SiteAudioRoot track={settings.ambientAudio}>{children}</SiteAudioRoot></body>
    </html>
  );
}
