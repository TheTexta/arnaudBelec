import Link from "next/link";
import { nonPhotoFonts } from "@/app/non-photo-fonts";
import "@/app/blog/blog.css";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <main className={`journal-shell ${nonPhotoFonts}`}>
    <header className="journal-nav">
      <Link className="journal-name" href="/">Arnaud Belec</Link>
      <nav aria-label="Site"><Link href="/">Photographs</Link><Link href="/blog">Journal</Link></nav>
    </header>
    {children}
  </main>;
}
