import Link from "next/link";
import { PublicSiteFrame } from "@/components/site/PublicSiteFrame";

export default function NotFound() {
  return <PublicSiteFrame><main className="site-project-index"><h1>Page not found</h1><p>This page is not available.</p><Link href="/">Return to the homepage</Link></main></PublicSiteFrame>;
}
