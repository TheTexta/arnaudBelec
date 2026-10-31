"use client";

import { adminSupabase } from "@/lib/admin/browser";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent } from "react";

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

type AdminAccess = {
  userId: string;
  email: string;
  request: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  setNavigationWarning: (message: string | null) => void;
  confirmNavigation: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};
const AccessContext = createContext<AdminAccess | null>(null);
export const SiteAdminProvider = AccessContext.Provider;
export type { AdminAccess };
export function useSiteAdmin() {
  const access = useContext(AccessContext);
  if (!access) throw new Error("Site admin access is required.");
  return access;
}

export function useAdminNavigationWarning(message: string | null) {
  const { setNavigationWarning } = useSiteAdmin();
  useEffect(() => {
    setNavigationWarning(message);
    return () => setNavigationWarning(null);
  }, [message, setNavigationWarning]);
}

export default function AdminAccess({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => adminSupabase(), []);
  const [state, setState] = useState<"checking" | "signed-out" | "authorised" | "denied" | "unconfigured">(supabase ? "checking" : "unconfigured");
  const [identity, setIdentity] = useState({ id: "", email: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [navigationWarning, setNavigationWarning] = useState<string | null>(null);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session expired. Sign in again before saving.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new AdminApiError(data.error ?? "The request failed. Please try again.", response.status, data.code);
    return data as Record<string, unknown>;
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let generation = 0;
    async function verify() {
      const current = ++generation;
      try {
        const { data: { session } } = await supabase!.auth.getSession();
        if (!active || current !== generation) return;
        if (!session) { setState("signed-out"); return; }
        const response = await fetch("/api/admin/session", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!active || current !== generation) return;
        if (!response.ok) {
          setState(response.status === 403 ? "denied" : response.status === 503 ? "unconfigured" : "signed-out");
          setError(result.error ?? "Could not verify this account.");
          return;
        }
        setIdentity({ id: result.id, email: result.email }); setState("authorised"); setError("");
      } catch { if (active && current === generation) { setError("Could not verify your session. Reload to try again."); setState("signed-out"); } }
    }
    void verify();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { window.setTimeout(() => { if (active) void verify(); }, 0); });
    return () => { active = false; generation++; subscription.unsubscribe(); };
  }, [supabase]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); setPassword(""); }
  }

  async function signOut() {
    if (!window.confirm(navigationWarning ?? "Sign out of Arnaud’s admin?")) return;
    const result = await supabase?.auth.signOut();
    if (result?.error) setError(result.error.message);
  }

  const confirmNavigation = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.pathname !== pathname && navigationWarning && !window.confirm(navigationWarning)) event.preventDefault();
  }, [pathname, navigationWarning]);
  const access = useMemo(() => supabase ? { userId: identity.id, email: identity.email, supabase, request, setNavigationWarning, confirmNavigation } : null, [identity.id, identity.email, supabase, request, confirmNavigation]);
  return <main className="blog-admin"><div className="blog-admin-inner">
    <header className="blog-admin-nav"><Link className="journal-name" href="/admin" onClick={confirmNavigation}>Arnaud Belec — Admin</Link><nav aria-label="Administration"><Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined} onClick={confirmNavigation}>Photographs</Link><Link href="/admin/posts" aria-current={pathname.startsWith("/admin/posts") ? "page" : undefined} onClick={confirmNavigation}>Journal</Link><Link href="/" onClick={confirmNavigation}>View site</Link>{state === "authorised" ? <button type="button" onClick={signOut}>Sign out</button> : null}</nav></header>
    {error ? <p className="blog-notice blog-error" role="alert">{error}</p> : null}
    {state === "checking" ? <p role="status">Checking your session…</p> : null}
    {state === "unconfigured" ? <section className="blog-notice"><h1>Admin setup required</h1><p>Configure the site’s Supabase public URL, anon key, server-only service role key, and admin user IDs. All admin sections share this access.</p></section> : null}
    {state === "denied" ? <section className="blog-notice"><h1>Access unavailable</h1><p>This account is not on Arnaud’s site admin allowlist.</p><button className="blog-button" type="button" onClick={() => { void supabase?.auth.signOut(); }}>Sign out</button></section> : null}
    {state === "signed-out" ? <form className="blog-login" onSubmit={signIn}><h1>Sign in</h1><p className="blog-muted">One account for photographs and the journal.</p><label className="blog-field">Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label className="blog-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button className="blog-button blog-button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form> : null}
    {state === "authorised" && access ? <AccessContext.Provider value={access}>{children}</AccessContext.Provider> : null}
  </div></main>;
}
