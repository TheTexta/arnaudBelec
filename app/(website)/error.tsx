"use client";

import { SiteShell } from "@/components/site/SiteShell";
import { defaultSiteSettings } from "@/lib/site/types";

export default function PublicError({ reset }: { reset: () => void }) {
  return <SiteShell settings={{ ...defaultSiteSettings, homePalette: defaultSiteSettings.homepage.palette }}>
    <main className="site-project-index"><h1>Page unavailable</h1><p>This page could not be loaded. Please try again.</p><button className="site-retry" onClick={reset}>Try again</button></main>
  </SiteShell>;
}
