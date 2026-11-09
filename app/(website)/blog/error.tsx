"use client";
import { SiteShell } from "@/components/site/SiteShell";
import { defaultSiteSettings } from "@/lib/site/types";

export default function JournalError({ reset }: { reset: () => void }) {
  return <SiteShell settings={{ ...defaultSiteSettings, homePalette: defaultSiteSettings.homepage.palette }}><main className="journal-shell"><section className="journal-index"><h1>Journal unavailable</h1><p className="journal-intro">The posts could not be loaded. Please try again.</p><button className="blog-button" onClick={reset}>Try again</button></section></main></SiteShell>;
}
