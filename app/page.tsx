import PhotoPage from "./photo-page";
import { loadPublicPhotographs } from "@/lib/supabase-public";

// Keep the catalogue current when photographs are added outside a site deploy.
export const dynamic = "force-dynamic";

export default async function Page() {
  const photographs = await loadPublicPhotographs();

  return <PhotoPage photographs={photographs} />;
}
