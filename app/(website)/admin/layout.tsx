import type { Metadata, Viewport } from "next";
import { nonPhotoFonts } from "@/app/non-photo-fonts";
import AdminAccess from "@/app/admin/admin-access";
import "@/app/blog/blog.css";
import { redirect } from "next/navigation";
import { cmsEnabled } from "@/lib/cms/session";

export const metadata: Metadata = { title: "Admin — Arnaud Belec", robots: { index: false, follow: false } };
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (cmsEnabled()) redirect("/cms");
  return <div className={nonPhotoFonts}><AdminAccess>{children}</AdminAccess></div>;
}
