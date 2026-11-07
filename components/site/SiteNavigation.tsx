import Link from "next/link";

export const siteLinks = [
  { href: "/photos", label: "Photography" },
  { href: "/blog", label: "Journal" },
  { href: "/video", label: "Video" },
  { href: "/fashion", label: "Fashion" },
] as const;

export function SiteNavigation({ pathname, className = "" }: { pathname?: string; className?: string }) {
  return <nav aria-label="Portfolio" className={`site-navigation ${className}`}>
    {siteLinks.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href || pathname?.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
