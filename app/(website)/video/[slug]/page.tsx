import { ProjectRoute } from "@/components/site/ProjectRoute";
import { projectMetadata } from "@/components/site/project-data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return projectMetadata("video", (await params).slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  // Resolve existence before streaming so unknown/draft-only URLs return HTTP 404.
  return await ProjectRoute({ kind: "video", slug });
}
