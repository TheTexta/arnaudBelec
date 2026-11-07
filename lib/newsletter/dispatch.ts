import { hash, sendMessage, unsubscribeToken, type Message, type SendResult } from "./provider";
import { NewsletterStore } from "./store";

export type PublishedPost = { id: string; _status?: string | null; title: string; slug: string; firstPublishedAt?: string | null };
type Dependencies = {
  store: NewsletterStore;
  readPost: (id: string) => Promise<PublishedPost | null>;
  config: { origin: string; secret: string; from: string };
  send?: (message: Message, key: string) => Promise<SendResult>;
};

export async function dispatchBatch({ store, readPost, config, send = sendMessage }: Dependencies, limit = 10) {
  const outcomes: Record<string, number> = {};
  const delivery = await store.nextDelivery();
  if (!delivery) return { processed: 0, outcomes };
  const current = await readPost(delivery.post_id);
  if (!current || current._status !== "published") {
    await store.cancel(delivery.id);
    return { processed: 0, outcomes: { withdrawn: 1 } };
  }
  const bounded = Math.min(10, Math.max(1, Math.trunc(limit) || 1));
  await store.seed(delivery.id, bounded);
  for (let i = 0; i < bounded; i++) {
    const recipient = await store.claim(delivery.id);
    if (!recipient) break;
    // Native post and current suppression are checked for each remote send,
    // not merely at fanout time. A send already in flight cannot be recalled.
    const post = await readPost(recipient.post_id);
    if (!post || post._status !== "published" || !await store.eligible(recipient.subscriber_id)) {
      const status = recipient.message_hash ? "reconcile" : "skipped";
      await store.finish(recipient, status, "withdrawn_or_suppressed");
      outcomes[status] = (outcomes[status] ?? 0) + 1;
      continue;
    }
    const unsubscribeValue = unsubscribeToken(recipient.subscriber_id, config.secret);
    if (hash(unsubscribeValue) !== recipient.unsubscribe_hash) {
      await store.finish(recipient, "reconcile", "unsubscribe_secret_changed");
      outcomes.reconcile = (outcomes.reconcile ?? 0) + 1;
      continue;
    }
    const unsubscribe = `${config.origin}/api/newsletter/unsubscribe?token=${unsubscribeValue}`;
    const message: Message = { to: recipient.email, subject: "A new journal entry from Arnaud Belec",
      text: `${post.title}\n\nRead the entry: ${config.origin}/blog/${encodeURIComponent(post.slug)}\n\nUnsubscribe: ${unsubscribe}`, unsubscribe };
    // Remote idempotency requires identical parameters. A post edit, sender
    // change or token-secret rotation between attempts requires reconciliation.
    if (!await store.messageHash(recipient, hash(JSON.stringify({ from: config.from, ...message })))) {
      await store.finish(recipient, "reconcile", "message_changed_after_attempt");
      outcomes.reconcile = (outcomes.reconcile ?? 0) + 1;
      continue;
    }
    const result = await send(message, `arnaud-newsletter:${recipient.delivery_key}`);
    await store.finish(recipient, result.status, result.status === "sent" ? null : result.error, result.status === "sent" ? result.id : null);
    outcomes[result.status] = (outcomes[result.status] ?? 0) + 1;
  }
  await store.complete(delivery.id);
  return { processed: Object.values(outcomes).reduce((a, b) => a + b, 0), outcomes };
}
