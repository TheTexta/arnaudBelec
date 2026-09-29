import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export class AdminRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export type AdminContext = {
  user: User;
  service: SupabaseClient;
  serviceRoleKey: string;
};

export async function authorizeAdmin(request: Request): Promise<AdminContext> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminIds = new Set((process.env.SUPABASE_ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!url || !anonKey || !serviceRoleKey || adminIds.size === 0) {
    throw new AdminRequestError("The photo admin is not configured on this server.", 503);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new AdminRequestError("Sign in to continue.", 401);

  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
  const authClient = createClient(url, anonKey, options);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new AdminRequestError("Your session has expired. Sign in again.", 401);
  if (!adminIds.has(data.user.id)) throw new AdminRequestError("This account cannot manage photographs.", 403);

  return { user: data.user, service: createClient(url, serviceRoleKey, options), serviceRoleKey };
}

export function adminErrorResponse(error: unknown): Response {
  if (!(error instanceof AdminRequestError) && !(error instanceof Error)) {
    console.error("Photo admin request failed:", error);
    return Response.json({ error: "The request failed. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof AdminRequestError) {
    return Response.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, {
      status: error.status, headers: { "Cache-Control": "no-store" },
    });
  }
  console.error("Photo admin request failed:", error);
  return Response.json({ error: "The request failed. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
