import Link from "next/link";
import { RetiredJournalCleanup } from "./RetiredJournalCleanup";
export function Navigation() { return <div className="cms-extra-nav"><RetiredJournalCleanup /><Link href="/cms/photographs">Photographs</Link><Link href="/blog">View journal</Link><Link href="/">View photographs</Link></div>; }
