import { nonPhotoFonts } from "@/app/non-photo-fonts";
import "@/app/blog/blog.css";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <main className={`journal-shell ${nonPhotoFonts}`}>
    {children}
  </main>;
}
