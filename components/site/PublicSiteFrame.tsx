import type { ReactNode } from "react";
import { getPublicSiteSettings } from "@/lib/site/public";
import type { PagePalette } from "@/lib/site/page-palette";
import { newsletterConfigured } from "@/lib/newsletter/config";
import { SiteShell } from "./SiteShell";

// A route owns its server-rendered palette; a cached ancestor layout cannot know
// a descendant slug. Only the audio provider stays in the persistent root.
export async function PublicSiteFrame({ children, palette = null }: { children: ReactNode; palette?: PagePalette | null }) {
  const [settings, newsletterAvailable] = await Promise.all([getPublicSiteSettings(), newsletterConfigured()]);
  return <SiteShell settings={{ contactEmail: settings.contactEmail, socialLinks: settings.socialLinks, homePalette: settings.homepage.palette }} palette={palette} newsletterAvailable={newsletterAvailable}>{children}</SiteShell>;
}
