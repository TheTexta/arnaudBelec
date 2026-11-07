import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, type CollectionAfterChangeHook } from "payload";
import { newsletterConfigured } from "./config";

export const queuePostAnnouncement: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // firstPublishedAt is maintained by the native Posts guard. Existing published
  // documents, restores and ordinary edits can never acquire a new outbox entry.
  if (doc._status !== "published" || !doc.firstPublishedAt || previousDoc?.firstPublishedAt || previousDoc?._status === "published") return doc;
  if (req.query?.autosave === "true" || req.query?.autosave === true || req.context?.arnaudNewsletterSkip === true) return doc;
  if ((req.context?.arnaudNativeJournal as { restoring?: boolean } | undefined)?.restoring) return doc;
  if (!await newsletterConfigured(req.payload, req)) return doc;
  const transactionID = await req.transactionID;
  const db = transactionID ? req.payload.db.sessions?.[transactionID]?.db as PostgresAdapter["drizzle"] | undefined : undefined;
  if (!db) throw new APIError("Newsletter enqueue requires the publication transaction.", 503);
  // Stable first-publication key, not a version/content copy. ON CONFLICT is safe
  // under concurrent publication; rollback removes the outbox along with the post.
  await db.execute(sql`insert into arnaud_cms.newsletter_deliveries (id, publication_key, post_id, status, created_at, updated_at)
    values (gen_random_uuid(), ${`first:${doc.id}`}, ${doc.id}::uuid, 'queued', now(), now()) on conflict (publication_key) do nothing`);
  return doc;
};
