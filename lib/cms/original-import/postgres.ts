import { Client } from "pg";
import type { ImportRecord, Journal, Observation, Probe } from "./core";

type Row = {
  id: string; actor_id: string; idempotency_key: string; original_filename: string;
  expected_bytes: string; expected_sha256: string; source_identity: Record<string, string>;
  object_key: string; bucket: string; state: string; upload_id: string | null; media_id: string | null; probe: Probe;
};
const record = (row: Row): ImportRecord => ({
  id: row.id, actor: row.actor_id, idempotency: row.idempotency_key, filename: row.original_filename,
  bytes: Number(row.expected_bytes), sha256: row.expected_sha256, identity: row.source_identity,
  key: row.object_key, bucket: row.bucket, state: row.state, uploadId: row.upload_id ?? undefined,
  mediaId: row.media_id ?? undefined, probe: row.probe,
});

// Each connection checks its effective operator role AND the existing CMS actor.
// No application env loader, Payload overrideAccess, HTTP endpoint or shared auth.
export function postgresJournal(connectionString: string, actor: string): Journal {
  async function connected<T>(work: (db: Client) => Promise<T>) {
    const db = new Client({ connectionString, application_name: "arnaud-original-import", statement_timeout: 30_000, connectionTimeoutMillis: 10_000 });
    await db.connect();
    try {
      const identity = await db.query<{ current_user: string }>("select current_user");
      if (!["arnaud_cms_owner", "arnaud_cms_migrator"].includes(identity.rows[0].current_user)) throw new Error("Operator database role denied.");
      if (!(await db.query("select id from arnaud_cms.cms_users where id=$1", [actor])).rowCount) throw new Error("Existing CMS actor required.");
      return await work(db);
    } finally { await db.end(); }
  }
  async function lockedUpdate(id: string, token: string, sql: string, values: unknown[] = []) {
    return connected(async db => {
      const result = await db.query(`update arnaud_cms.media_imports set ${sql}, updated_at=now() where id=$1 and actor_id=$2 and lease_token=$3 and lease_until>now() returning id`, [id, actor, token, ...values]);
      if (result.rowCount !== 1) throw new Error("Operator lease lost.");
    });
  }
  return {
    reserve: row => connected(async db => {
      if (row.actor !== actor) throw new Error("Import actor denied.");
      await db.query(`insert into arnaud_cms.media_imports
        (id,actor_id,idempotency_key,original_filename,expected_bytes,expected_sha256,source_identity,bucket,filename,object_key,probe)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(idempotency_key) do nothing`,
      [row.id, actor, row.idempotency, row.filename, row.bytes, row.sha256, row.identity, row.bucket, `${row.id}.mp4`, row.key, row.probe]);
      const result = await db.query<Row>("select * from arnaud_cms.media_imports where idempotency_key=$1 and actor_id=$2", [row.idempotency, actor]);
      if (!result.rowCount) throw new Error("Idempotency key belongs to another actor.");
      return record(result.rows[0]);
    }),
    inspect: id => connected(async db => {
      const result = await db.query<Row>("select * from arnaud_cms.media_imports where id=$1 and actor_id=$2", [id, actor]);
      if (!result.rowCount) throw new Error("Import not found for this actor.");
      return record(result.rows[0]);
    }),
    lease: (id, token) => connected(async db => {
      const result = await db.query(`update arnaud_cms.media_imports set lease_token=$3,lease_until=now()+interval '30 minutes',attempts=attempts+1,updated_at=now()
        where id=$1 and actor_id=$2 and (lease_until is null or lease_until<=now()) returning id`, [id, actor, token]);
      if (result.rowCount !== 1) throw new Error("Import already leased or actor denied.");
    }),
    renew: (id, token) => lockedUpdate(id, token, "lease_until=now()+interval '30 minutes'"),
    release: (id, token, failed) => connected(async db => {
      await db.query(`update arnaud_cms.media_imports set lease_token=null,lease_until=null,
        state=case when $4 and media_id is null then 'recoverable_error' else state end,
        last_error=case when $4 and media_id is null then 'operator_interrupted' else null end,updated_at=now()
        where id=$1 and actor_id=$2 and lease_token=$3`, [id, actor, token, failed]);
    }),
    upload: (id, token, uploadId) => connected(async db => {
      const result = await db.query(`update arnaud_cms.media_imports set upload_id=$4,state='uploading',updated_at=now()
        where id=$1 and actor_id=$2 and lease_token=$3 and lease_until>now()
        and (upload_id is null or (upload_id='CREATE_UNCERTAIN' and $4<>'CREATE_UNCERTAIN')) returning id`, [id, actor, token, uploadId]);
      if (result.rowCount !== 1) throw new Error("Upload identity or lease changed.");
    }),
    state: (id, token, state) => lockedUpdate(id, token, "state=$4", [state]),
    register: (id: string, token: string, observed: Observation) => connected(async db => {
      await db.query("begin");
      try {
        const result = await db.query<Row>(`select * from arnaud_cms.media_imports where id=$1 and actor_id=$2
          and lease_token=$3 and lease_until>now() for update`, [id, actor, token]);
        const row = result.rows[0];
        if (!row) throw new Error("Operator lease lost.");
        if (row.media_id) { await db.query("commit"); return row.media_id; }
        if (row.state !== "verifying" || Number(row.expected_bytes) !== observed.bytes || row.expected_sha256 !== observed.sha256 || observed.mime !== "video/mp4" || !observed.etag) throw new Error("Locked original verification required.");
        await db.query(`update arnaud_cms.media_imports set state='verified',observed_bytes=$2,observed_sha256=$3,observed_mime=$4,observed_etag=$5 where id=$1`, [id, observed.bytes, observed.sha256, observed.mime, observed.etag]);
        // Trusted operator ingestion boundary, not an alternate native upload API.
        // Exact installed S3 layout: prefix / _objectkey / filename.
        await db.query(`insert into arnaud_cms.media
          (id,caption,verified,sha256,upload_identity,prefix,_objectkey,url,filename,mime_type,filesize,width,height)
          values ($1::uuid,$2,true,$3,$1::text,'journal-native',$4,$5,$6,'video/mp4',$7,$8,$9)`,
        [id, row.original_filename, observed.sha256, `large-originals/${id}`, `/api/cms/media/file/${id}.mp4`, `${id}.mp4`, observed.bytes, row.probe.width, row.probe.height]);
        await db.query("update arnaud_cms.media_imports set state='registered',media_id=$1,last_error=null,updated_at=now() where id=$1", [id]);
        await db.query("commit");
        return id;
      } catch (error) { await db.query("rollback"); throw error; }
    }),
  };
}
