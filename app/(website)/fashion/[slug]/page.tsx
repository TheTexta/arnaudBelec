import { ProjectRoute } from "@/components/site/ProjectRoute";
import { projectMetadata } from "@/components/site/project-data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return projectMetadata("fashion", (await params).slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return await ProjectRoute({ kind: "fashion", slug });
}
