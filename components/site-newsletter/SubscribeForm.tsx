"use client";

import { useId, useState, type FormEvent } from "react";

// Render only after the server's newsletterConfigured() readiness check.
export function SubscribeForm() {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    setPending(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/newsletter/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not request a confirmation. Please try later.");
      setMessage(result.message || "Request received. Check your email for a confirmation link.");
      form.reset();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "Could not request a confirmation. Please try later.");
    } finally { setPending(false); }
  }
  return <section className="site-newsletter" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Journal by email</h2>
    <p id={`${id}-description`}>New entries, sent occasionally. Confirm by email; unsubscribe at any time.</p>
    <form onSubmit={submit} aria-busy={pending}>
      <label htmlFor={`${id}-email`}>Email address</label>
      <input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254} aria-describedby={`${id}-description ${id}-status`} disabled={pending} />
      <button type="submit" disabled={pending}>{pending ? "Requesting…" : "Request updates"}</button>
      <p id={`${id}-status`} role={failed ? "alert" : "status"} aria-live="polite">{message}</p>
    </form>
  </section>;
}
