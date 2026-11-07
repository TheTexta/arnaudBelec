import type { Metadata } from "next";
import { nonPhotoFonts } from "@/app/non-photo-fonts";
import { SiteShell } from "@/components/site/SiteShell";
import { getPublicSiteSettings } from "@/lib/site/public";
import { newsletterConfigured } from "@/lib/newsletter/config";
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
  const [settings, newsletterAvailable] = await Promise.all([getPublicSiteSettings(), newsletterConfigured()]);
  return (
    <html lang="en" className={`scroll-smooth motion-reduce:scroll-auto ${nonPhotoFonts}`}>
      <body className="min-h-full min-w-80"><SiteShell settings={{ contactEmail: settings.contactEmail, socialLinks: settings.socialLinks, ambientAudio: settings.ambientAudio, homePalette: settings.homepage.palette }} newsletterAvailable={newsletterAvailable}>{children}</SiteShell></body>
    </html>
  );
}
