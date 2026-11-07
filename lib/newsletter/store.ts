import { randomUUID } from "node:crypto";
import { hash, token, unsubscribeToken } from "./provider";

export type Query = (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
export type Recipient = { id: string; delivery_id: string; subscriber_id: string; delivery_key: string; email: string; unsubscribe_hash: string; post_id: string; claim_token: string; message_hash: string | null };

// Every public transition is atomic SQL. Payload owns schema/collections; this
// small operational store uses only fixed, schema-qualified Arnaud tables.
export class NewsletterStore {
  constructor(readonly query: Query) {}

  async requestConfirmation(email: string, secret: string) {
    const id = randomUUID(), confirmation = token();
    const rows = await this.query(`insert into arnaud_cms.newsletter_subscribers
      (id,email,status,confirmation_hash,confirmation_expires_at,confirmation_requested_at,unsubscribe_hash,created_at,updated_at)
      values ($1,$2,'pending',$3,now()+interval '24 hours',now(),$4,now(),now())
      on conflict (email) do update set confirmation_hash=excluded.confirmation_hash,
        confirmation_expires_at=excluded.confirmation_expires_at,confirmation_requested_at=now(),updated_at=now()
      where newsletter_subscribers.status='pending' and
        (newsletter_subscribers.confirmation_requested_at is null or newsletter_subscribers.confirmation_requested_at < now()-interval '24 hours')
      returning id`, [id, email, hash(confirmation), hash(unsubscribeToken(id, secret))]);
    return rows.rows.length ? confirmation : null;
  }

  async confirm(value: string) {
    const result = await this.query(`update arnaud_cms.newsletter_subscribers set status='confirmed',confirmed_at=now(),
      confirmation_hash=null,confirmation_expires_at=null,updated_at=now()
      where confirmation_hash=$1 and status='pending' and confirmation_expires_at>now() returning id`, [hash(value)]);
    return result.rows.length === 1;
  }

  async unsubscribe(value: string) {
    await this.query(`update arnaud_cms.newsletter_subscribers set status='suppressed',suppressed_at=now(),
      confirmation_hash=null,confirmation_expires_at=null,updated_at=now() where unsubscribe_hash=$1`, [hash(value)]);
  }

  async nextDelivery() {
    const result = await this.query(`select id,post_id from arnaud_cms.newsletter_deliveries where status='queued' order by created_at,id limit 1`);
    return result.rows[0] as { id: string; post_id: string } | undefined;
  }

  async cancel(id: string) {
    await this.query(`update arnaud_cms.newsletter_deliveries set status='cancelled',updated_at=now() where id=$1`, [id]);
    await this.query(`update arnaud_cms.newsletter_recipients set status='skipped',last_error='post_withdrawn',updated_at=now()
      where delivery_id=$1 and status='pending'`, [id]);
    await this.query(`update arnaud_cms.newsletter_recipients set status='reconcile',last_error='post_withdrawn_after_attempt',updated_at=now()
      where delivery_id=$1 and status in ('sending','retry')`, [id]);
  }

  async seed(id: string, limit: number) {
    await this.query(`insert into arnaud_cms.newsletter_recipients
      (id,delivery_key,delivery_id,subscriber_id,status,created_at,updated_at)
      select gen_random_uuid(),d.id::text||':'||s.id::text,d.id,s.id,'pending',now(),now()
      from arnaud_cms.newsletter_deliveries d join arnaud_cms.newsletter_subscribers s
        on s.status='confirmed' and s.confirmed_at <= d.created_at
      where d.id=$1 and d.status='queued' and not exists
        (select 1 from arnaud_cms.newsletter_recipients r where r.delivery_key=d.id::text||':'||s.id::text)
      order by s.id limit $2 on conflict (delivery_key) do nothing`, [id, limit]);
  }

  async claim(id: string): Promise<Recipient | null> {
    // Resend retains idempotency for 24h. Stop at 23h, including an expired
    // sending lease after a process crash. Never silently retry old ambiguity.
    await this.query(`update arnaud_cms.newsletter_recipients set status='reconcile',last_error='idempotency_window_expired',updated_at=now()
      where delivery_id=$1 and status in ('retry','sending') and first_attempt_at < now()-interval '23 hours'
      and (claimed_at is null or claimed_at < now()-interval '2 minutes')`, [id]);
    const claim = randomUUID();
    const result = await this.query(`with candidate as (
      select r.id from arnaud_cms.newsletter_recipients r join arnaud_cms.newsletter_deliveries d on d.id=r.delivery_id
      where r.delivery_id=$1 and d.status='queued' and (r.status='pending' or
        (r.status='retry' and r.retry_at<=now()) or (r.status='sending' and r.claimed_at<now()-interval '2 minutes'))
      order by r.created_at,r.id for update of r skip locked limit 1
    ), claimed as (
      update arnaud_cms.newsletter_recipients r set status='sending',claimed_at=now(),claim_token=$2,
      first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now() from candidate c where r.id=c.id returning r.*
    ) select c.*,s.email,s.unsubscribe_hash,d.post_id from claimed c join arnaud_cms.newsletter_subscribers s on s.id=c.subscriber_id
      join arnaud_cms.newsletter_deliveries d on d.id=c.delivery_id`, [id, claim]);
    return result.rows[0] as Recipient | undefined ?? null;
  }

  async eligible(id: string) {
    return (await this.query(`select id from arnaud_cms.newsletter_subscribers where id=$1 and status='confirmed'`, [id])).rows.length === 1;
  }

  async messageHash(recipient: Recipient, digest: string) {
    const result = await this.query(`update arnaud_cms.newsletter_recipients set message_hash=$3 where id=$1 and claim_token=$2
      and status='sending' and (message_hash is null or message_hash=$3) returning id`, [recipient.id, recipient.claim_token, digest]);
    return result.rows.length === 1;
  }

  async finish(recipient: Recipient, status: string, error: string | null = null, providerID: string | null = null) {
    await this.query(`update arnaud_cms.newsletter_recipients set status=$3,last_error=$4,provider_id=$5,
      retry_at=case when $6::boolean then now()+interval '5 minutes' else null end,updated_at=now()
      where id=$1 and claim_token=$2 and status='sending'`, [recipient.id, recipient.claim_token, status, error, providerID, status === "retry"]);
  }

  async complete(id: string) {
    await this.query(`update arnaud_cms.newsletter_deliveries d set status='complete',updated_at=now() where id=$1 and status='queued'
      and not exists (select 1 from arnaud_cms.newsletter_recipients r where r.delivery_id=d.id and r.status in ('pending','retry','sending'))
      and not exists (select 1 from arnaud_cms.newsletter_subscribers s where s.status='confirmed' and s.confirmed_at<=d.created_at
        and not exists(select 1 from arnaud_cms.newsletter_recipients r where r.delivery_key=d.id::text||':'||s.id::text))`, [id]);
  }
}
