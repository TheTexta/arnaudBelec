import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (publicSupabaseUrl) {
  try {
    const url = new URL(publicSupabaseUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      remotePatterns.push({
        protocol: url.protocol === "https:" ? "https" : "http",
        hostname: url.hostname,
        port: url.port,
        pathname: `${url.pathname.replace(/\/$/, "")}/storage/v1/object/public/arnaudbelec/**`,
      });
    }
  } catch {
    // Without a valid public URL the page uses its local placeholder gallery.
  }
}

const nextConfig: NextConfig = {
  images: { remotePatterns },
};

export default nextConfig;
