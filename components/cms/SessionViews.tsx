"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { cmsRequest } from "./request";

export function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError("");
    try {
      await cmsRequest("/api/cms/cms-users/login", { method: "POST", body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      // Reload server-rendered authentication after receiving HttpOnly cookies.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      form.reset(); window.location.assign("/cms");
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <main className="cms-session"><form onSubmit={submit}><h1>Arnaud Belec</h1><h2>Sign in</h2><p>One Supabase account for photographs and the journal.</p><label>Email<input name="email" type="email" autoComplete="username" required disabled={busy} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label>{error ? <p role="alert">{error}</p> : null}<button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button><Link href="/">Back to photographs</Link></form></main>;
}

export function LogoutButton() { return <Link href="/cms/logout">Sign out</Link>; }
export function Logout() {
  const [error, setError] = useState("");
  useEffect(() => {
    cmsRequest("/api/cms/cms-users/logout", { method: "POST" }).then(() => window.location.replace("/cms/login")).catch(() => setError("Could not sign out. Reload to try again."));
  }, []);
  return <main className="cms-session"><p role={error ? "alert" : "status"}>{error || "Signing out…"}</p></main>;
}
