import { UUID } from "@/lib/blog/document";
import { notFound } from "next/navigation";
import PostEditor from "@/app/admin/posts/post-editor";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PostEditor key={id} id={id} />;
}
