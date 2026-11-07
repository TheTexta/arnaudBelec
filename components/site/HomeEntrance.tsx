import type { SiteSettings } from "@/lib/site/types";
import type { PublicPhotograph } from "@/lib/supabase-public";
import { HOME_SECTIONS, homePreview } from "@/lib/site/homepage";
import { HomePreview } from "./HomePreview";

export function HomeEntrance({ photographs, settings }: { photographs: PublicPhotograph[]; settings: SiteSettings }) {
  return <main className="home-entrance">
    <h1>Arnaud Belec</h1>
    <nav className="home-scene" aria-label="Explore Arnaud’s work">
      {HOME_SECTIONS.map(({ key, label, href }) => {
        const preview = homePreview(settings.homepage[key], photographs);
        return <HomePreview key={`${key}-${preview?.src ?? "empty"}`} section={key} label={label} href={href} preview={preview} />;
      })}
    </nav>
    {settings.intro ? <p className="home-intro">{settings.intro}</p> : null}
  </main>;
}
