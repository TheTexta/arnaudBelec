import { createClient } from "@supabase/supabase-js";
import { AdminRequestError } from "../admin/server";

export const cmsEnabled = () => process.env.ARNAUD_CMS_ENABLED === "true";
export const allowedUser = (id: unknown) => typeof id === "string" && (process.env.SUPABASE_ADMIN_USER_IDS ?? "").split(",").some(value => value.trim() === id);
const secure = () => process.env.NODE_ENV === "production";
export const cookieNames = () => ({ access: `${secure() ? "__Host-" : ""}arnaud-cms-access`, refresh: `${secure() ? "__Host-" : ""}arnaud-cms-refresh` });

export function assertOrigin(headers: Headers) {
  const origin = headers.get("origin");
  const trusted = process.env.ARNAUD_CMS_ORIGIN;
  if (!trusted || origin !== new URL(trusted).origin) throw new AdminRequestError("This request must come from Arnaud’s admin.", 403);
}

export function cookie(headers: Headers, name: string) {
  return headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

export function accessToken(headers: Headers, mutation = false) {
  // An explicit bad bearer never falls back to ambient cookies.
  if (headers.has("authorization")) return /^Bearer ([^\s]+)$/.exec(headers.get("authorization") ?? "")?.[1] ?? "";
  if (!cmsEnabled()) return "";
  const token = cookie(headers, cookieNames().access);
  if (token && mutation) assertOrigin(headers);
  return token;
}

export function authClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AdminRequestError("Supabase sign-in is not configured.", 503);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export function tokenExpiry(token: string) {
  try {
    const exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp;
    return typeof exp === "number" && Number.isFinite(exp) && exp > Date.now() / 1000 ? exp : null;
  } catch { return null; }
}

export async function verifyToken(token: string) {
  if (!token) return null;
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user || !allowedUser(data.user.id)) return null;
  const exp = tokenExpiry(token);
  return exp ? { id: data.user.id, email: data.user.email ?? "", exp } : null;
}

export function sessionCookies(response: Response, session?: { access_token: string; refresh_token: string; expires_at?: number }) {
  const names = cookieNames();
  for (const [name, value, age] of [
    [names.access, session?.access_token ?? "", session ? Math.max(0, (session.expires_at ?? 0) - Math.floor(Date.now() / 1000)) : 0],
    [names.refresh, session?.refresh_token ?? "", session ? 60 * 60 * 24 * 7 : 0],
  ] as const) response.headers.append("Set-Cookie", `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure() ? "; Secure" : ""}`);
  return response;
}
