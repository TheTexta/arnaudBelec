import type { CollectionConfig, Field } from "payload";
import { isCmsUser } from "../cms/auth";
import { requireSiteExpansion, siteExpansionEnabled } from "../cms/site-access";

const admin: NonNullable<CollectionConfig["access"]>["read"] = ({ req }) => siteExpansionEnabled() && isCmsUser(req.user);
const operational = { create: () => false, update: () => false, delete: () => false, read: admin };
const text = (name: string, extra: Partial<Field> = {}): Field => ({ name, type: "text", ...extra } as Field);
const date = (name: string): Field => ({ name, type: "date" });
const base = {
  timestamps: true, lockDocuments: false as const,
  admin: { group: "Newsletter", hidden: () => !siteExpansionEnabled() }, access: operational,
  hooks: { beforeOperation: [() => { requireSiteExpansion(); }] },
};

// IDs use the owning adapter's idType: uuid. No public collection API writes,
// including authenticated admin writes: state transitions go through this module.
export const NewsletterSubscribers: CollectionConfig = {
  ...base, slug: "newsletter-subscribers", dbName: "newsletter_subscribers",
  admin: { ...base.admin, useAsTitle: "email", defaultColumns: ["email", "status", "confirmedAt"] },
  fields: [
    { name: "email", type: "email", required: true, unique: true },
    { name: "status", type: "select", required: true, defaultValue: "pending", index: true, options: ["pending", "confirmed", "suppressed"] },
    text("confirmationHash", { unique: true }), date("confirmationExpiresAt"), date("confirmationRequestedAt"),
    text("unsubscribeHash", { required: true, unique: true }), date("confirmedAt"), date("suppressedAt"),
  ],
};

export const NewsletterDeliveries: CollectionConfig = {
  ...base, slug: "newsletter-deliveries", dbName: "newsletter_deliveries",
  fields: [
    text("publicationKey", { required: true, unique: true }),
    { name: "post", type: "relationship", relationTo: "posts", required: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "queued", index: true, options: ["queued", "complete", "cancelled"], admin: { description: "Complete means processing finished, not guaranteed delivery. Inspect recipient outcomes for failures or reconciliation." } },
  ],
};

export const NewsletterRecipients: CollectionConfig = {
  ...base, slug: "newsletter-recipients", dbName: "newsletter_recipients",
  fields: [
    text("deliveryKey", { required: true, unique: true }),
    { name: "delivery", type: "relationship", relationTo: "newsletter-deliveries" as never, required: true, index: true },
    { name: "subscriber", type: "relationship", relationTo: "newsletter-subscribers" as never, required: true, index: true },
    { name: "status", type: "select", required: true, defaultValue: "pending", index: true, options: ["pending", "sending", "retry", "sent", "skipped", "failed", "reconcile"] },
    date("firstAttemptAt"), date("claimedAt"), date("retryAt"), text("claimToken"), text("messageHash"),
    text("providerId"), text("lastError"),
  ],
};
