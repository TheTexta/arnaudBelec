import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arnaud Belec — Photos",
  description: "Photographs by Arnaud Belec",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth motion-reduce:scroll-auto [color-scheme:light]">
      <body className="min-h-full min-w-80 bg-white">{children}</body>
    </html>
  );
}
