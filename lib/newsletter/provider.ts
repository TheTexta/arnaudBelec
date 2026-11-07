import { createHash, createHmac, randomBytes } from "node:crypto";
import { newsletterEnvironment } from "./config";

export const token = () => randomBytes(32).toString("base64url");
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const unsubscribeToken = (id: string, secret: string) => createHmac("sha256", secret).update(`arnaud-newsletter-unsubscribe:${id}`).digest("base64url");
export type Message = { to: string; subject: string; text: string; unsubscribe?: string };
export type SendResult = { status: "sent"; id: string } | { status: "retry" | "failed" | "reconcile"; error: string };

export async function sendMessage(message: Message, key: string): Promise<SendResult> {
  const config = newsletterEnvironment();
  if (!config) return { status: "failed", error: "configuration_unavailable" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text,
        ...(message.unsubscribe ? { headers: { "List-Unsubscribe": `<${message.unsubscribe}>` } } : {}) }),
    });
    if (!response.ok) {
      // Do not persist provider response bodies (may contain addresses/secrets).
      if (response.status === 409) return { status: "reconcile", error: "provider_idempotency_conflict" };
      return { status: response.status === 429 || response.status >= 500 ? "retry" : "failed", error: `provider_http_${response.status}` };
    }
    const result = await response.json() as { id?: unknown };
    return typeof result.id === "string" && result.id.length < 200
      ? { status: "sent", id: result.id } : { status: "retry", error: "provider_response_uncertain" };
  } catch { return { status: "retry", error: "provider_outcome_uncertain" }; }
}
