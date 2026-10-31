import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AdminRequestError } from "../admin/server";
import { UUID, type BlogPost } from "./document";

export function assertId(id: string) {
  if (!UUID.test(id)) throw new AdminRequestError("Post or media not found.", 404);
  return id;
}

export function publicBlogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}

export function blogDatabaseError(error: { code?: string; message: string }): never {
  if (error.code === "40001" || error.message.includes("blog_conflict")) throw new AdminRequestError("This post changed in another tab. Copy your unsaved work, then reload before saving again.", 409, "blog_conflict");
  if (error.code === "23505") throw new AdminRequestError("That URL name is already in use. Choose another one.", 409);
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? "")) throw new AdminRequestError("The blog database is not installed yet. Apply the blog migration before writing posts.", 503);
  throw new Error("The blog could not be saved. Please try again.");
}

export async function readPost(service: SupabaseClient, id: string): Promise<BlogPost> {
  const { data, error } = await service.from("arnaud_blog_posts").select("*,publication:arnaud_blog_publications(source_version,slug)").eq("id", assertId(id)).maybeSingle();
  if (error) blogDatabaseError(error);
  if (!data) throw new AdminRequestError("Post not found.", 404);
  return data as BlogPost;
}

export function noStore(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export function inputVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new AdminRequestError("Invalid saved post version.", 400);
  return Number(value);
}
