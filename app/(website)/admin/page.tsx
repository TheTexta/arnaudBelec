import type { Metadata } from "next";
import AdminPanel from "@/app/admin/admin-panel";

export const metadata: Metadata = {
  title: "Photo admin — Arnaud Belec",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
