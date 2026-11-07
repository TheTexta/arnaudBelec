"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { SiteSettings } from "@/lib/site/types";
import { PublicAtmosphere } from "@/components/site-effects/PublicAtmosphere";
import { SiteNavigation } from "./SiteNavigation";
import { PublicAudioProvider } from "@/components/site-audio/PublicAudioProvider";
import { SoundControls } from "@/components/site-audio/SoundControls";
import { SubscribeForm } from "@/components/site-newsletter/SubscribeForm";
import { HomeFluid } from "@/components/site-effects/HomeFluid";
import { homeInk } from "@/lib/site/homepage";
import type { CSSProperties } from "react";

type ShellSettings = Pick<SiteSettings, "contactEmail" | "socialLinks" | "ambientAudio"> & { homePalette: SiteSettings["homepage"]["palette"] };

export function SiteShell({ children, settings, newsletterAvailable = false }: { children: ReactNode; settings: ShellSettings; newsletterAvailable?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return children;

  const isPhoto = pathname === "/photos" || pathname.startsWith("/photos/");
  const isHome = pathname === "/";
  const preset = pathname.startsWith("/blog") ? "journal" : pathname.startsWith("/video") ? "video" : pathname.startsWith("/fashion") ? "fashion" : "home";

  const homeStyle = isHome ? { "--home-filler": settings.homePalette.background, "--home-ink": homeInk(settings.homePalette.background) } as CSSProperties : undefined;
  return <PublicAudioProvider track={settings.ambientAudio}><div className={`site-shell site-shell--${isPhoto ? "photo" : preset}${isHome ? " site-shell--entrance" : ""}`} style={homeStyle}>
    {isHome ? <HomeFluid palette={settings.homePalette} /> : !isPhoto ? <PublicAtmosphere preset={preset} className="site-atmosphere" /> : null}
    <a className="site-skip" href="#public-content">Skip to content</a>
    {!isHome ? <header className="site-header">
      <Link className="site-name" href="/">Arnaud Belec</Link>
      <SiteNavigation pathname={pathname} />
    </header> : null}
    <div className="site-content" id="public-content" tabIndex={-1}>{children}</div>
    {newsletterAvailable && (isHome || preset === "journal") ? <div className="site-subscription"><SubscribeForm /></div> : null}
    <div className="site-sound"><SoundControls /></div>
    {!isPhoto ? <footer className="site-footer" id="contact">
      <span>Arnaud Belec</span>
      <div className="site-contact">
        {settings.contactEmail ? <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a> : null}
        {settings.socialLinks.filter((link) => /^(?:https:\/\/|mailto:)/i.test(link.url)).map((link) => <a key={link.url} href={link.url} rel="me">{link.label}</a>)}
      </div>
    </footer> : null}
  </div></PublicAudioProvider>;
}
