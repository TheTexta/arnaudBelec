import { createHash } from "node:crypto";

// Operator-only, independent of Payload hooks, application credentials and dotenv.
export interface Database { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }
const tables = [
  ["arnaud_cms.payload_locked_documents_rels", ["id"]],
  ["public.arnaud_blog_publication_media", ["post_id", "media_id"]],
  ["public.arnaud_blog_publications", ["id"]],
  ["public.arnaud_blog_revisions", ["post_id", "version"]],
  ["public.arnaud_blog_media", ["id"]],
  ["public.arnaud_blog_posts", ["id"]],
  ["arnaud_cms._posts_v", ["id"]],
  ["arnaud_cms.legacy_revisions", ["id"]],
  ["arnaud_cms.posts", ["id"]],
] as const;
export const buckets = ["arnaudbelec", "arnaudbelec-staging"] as const;
export type ObjectIdentity = { bucket: string; key: string; size: number; etag: string; sha256: string };
export type Multipart = { bucket: string; key: string; uploadId: string };
export interface Storage {
  inventory(): Promise<{ objects: ObjectIdentity[]; multipart: Multipart[] }>;
  identify(object: Pick<ObjectIdentity, "bucket" | "key">): Promise<ObjectIdentity | null>;
  remove(object: ObjectIdentity): Promise<void>;
  abort(upload: Multipart): Promise<void>;
}
type Entry = { key: Record<string, unknown>; sha256: string };
type Media = { path: string; multipartId: string | null; size: number; sha256: string | null };
export type Manifest = {
  version: 1; target: string; rows: Record<string, Entry[]>; media: Media[];
  objects: ObjectIdentity[]; multipart: Multipart[]; digest: string;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",") + "}";
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
function ordered<T>(items: T[]): T[] { return items.sort((a, b) => canonical(a).localeCompare(canonical(b))); }
export function assertLegacyObject(bucket: string, key: string) {
  if (!buckets.includes(bucket as typeof buckets[number]) || !/^blog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm|mp3|ogg|wav)$/.test(key)) throw new Error("Unexpected storage namespace; refusing cleanup.");
}
function validate(manifest: Manifest, confirmation: string) {
  const { digest: expected, ...payload } = manifest;
  if (manifest.version !== 1 || digest(payload) !== expected || confirmation !== expected) throw new Error("Exact manifest hash confirmation required.");
  if (Object.keys(manifest.rows).sort().join() !== tables.map(([name]) => name).sort().join()) throw new Error("Unexpected reset scope.");
  for (const [table, columns] of tables) for (const entry of manifest.rows[table]) {
    if (Object.keys(entry.key).sort().join() !== [...columns].sort().join() || columns.some(c => entry.key[c] == null) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Invalid row identity.");
  }
  for (const o of [...manifest.objects, ...manifest.multipart]) assertLegacyObject(o.bucket, o.key);
  for (const m of manifest.media) assertLegacyObject(buckets[0], m.path);
}
async function snapshot(db: Database) {
  const rows: Manifest["rows"] = {};
  const media: Media[] = [];
  for (const [table, columns] of tables) {
    // Includes null-parent versions and orphan imported history, not just UI rows.
    const filter = table.endsWith("payload_locked_documents_rels") ? " WHERE posts_id IS NOT NULL OR legacy_revisions_id IS NOT NULL" : "";
    const result = await db.query(`SELECT to_jsonb(t) AS value FROM ${table} t${filter}`);
    rows[table] = ordered(result.rows.map(({ value }) => {
      const row = value as Record<string, unknown>;
      if (table === "public.arnaud_blog_media") {
        assertLegacyObject(buckets[0], String(row.storage_path));
        media.push({ path: String(row.storage_path), multipartId: row.multipart_id as string | null, size: Number(row.size_bytes), sha256: row.sha256 as string | null });
      }
      return { key: Object.fromEntries(columns.map(c => [c, row[c]])), sha256: digest(row) };
    }));
  }
  return { rows, media: ordered(media) };
}
export async function planReset(db: Database, storage: Storage, target: string): Promise<Manifest> {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  let data: Awaited<ReturnType<typeof snapshot>>;
  try { data = await snapshot(db); await db.query("COMMIT"); }
  catch (error) { await db.query("ROLLBACK"); throw error; }
  // Never hold a database transaction while hashing storage. Reset compares the
  // full snapshot under locks and refuses any intervening content changes.
  const inventory = await storage.inventory();
  for (const o of [...inventory.objects, ...inventory.multipart]) assertLegacyObject(o.bucket, o.key);
  for (const m of data.media) for (const o of inventory.objects.filter(o => o.key === m.path)) {
    if (o.size !== m.size || (m.sha256 && o.sha256 !== m.sha256)) throw new Error("Registry and stored object identity differ.");
  }
  const payload = { version: 1 as const, target, ...data, objects: ordered(inventory.objects), multipart: ordered(inventory.multipart) };
  return { ...payload, digest: digest(payload) };
}
type Journal = (event: Record<string, unknown>) => Promise<void>;
export async function resetJournal(db: Database, manifest: Manifest, confirmation: string, target: string, journal: Journal) {
  validate(manifest, confirmation);
  if (manifest.target !== target) throw new Error("Database target differs from manifest.");
  await journal({ phase: "reset-started", digest: manifest.digest });
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query(`LOCK TABLE ${tables.map(([t]) => t).join(", ")} IN ACCESS EXCLUSIVE MODE`);
    const live = await snapshot(db);
    if (digest(live) !== digest({ rows: manifest.rows, media: manifest.media })) throw new Error("Database changed since plan; no rows deleted.");
    for (const [table] of tables) for (const entry of manifest.rows[table]) await db.query(`DELETE FROM ${table} t WHERE to_jsonb(t) @> $1::jsonb`, [JSON.stringify(entry.key)]);
    const empty = await snapshot(db);
    if (Object.values(empty.rows).some(rows => rows.length)) throw new Error("Reset verification failed.");
    await db.query("COMMIT");
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  await journal({ phase: "reset-committed", digest: manifest.digest });
}
export async function verifyTargetsAbsent(db: Database, manifest: Manifest) {
  for (const [table] of tables) {
    const exists = await db.query("SELECT to_regclass($1) AS name", [table]);
    if (!exists.rows[0].name) continue;
    for (const entry of manifest.rows[table]) {
      const result = await db.query(`SELECT 1 FROM ${table} t WHERE to_jsonb(t) @> $1::jsonb LIMIT 1`, [JSON.stringify(entry.key)]);
      if (result.rows.length) throw new Error("Reset target rows still exist; storage retained.");
    }
  }
}
export async function cleanMedia(db: Database, storage: Storage, manifest: Manifest, confirmation: string, committed: boolean, journal: Journal) {
  validate(manifest, confirmation);
  if (!committed) throw new Error("Durable reset-committed receipt required.");
  await verifyTargetsAbsent(db, manifest);
  const inventory = await storage.inventory();
  for (const o of inventory.objects) if (!manifest.objects.some(planned => digest(planned) === digest(o))) throw new Error("Storage changed since plan.");
  for (const u of inventory.multipart) if (!manifest.multipart.some(planned => digest(planned) === digest(u))) throw new Error("Multipart inventory changed since plan.");
  // Stop outstanding upload identities before deleting their completed objects.
  for (const upload of inventory.multipart) {
    await journal({ phase: "multipart-abort-started", ...upload });
    await storage.abort(upload);
    await journal({ phase: "multipart-aborted", ...upload });
  }
  for (const object of manifest.objects) {
    const live = await storage.identify(object);
    if (!live) continue;
    if (digest(live) !== digest(object)) throw new Error("Object identity changed; retained.");
    await journal({ phase: "object-delete-started", ...object });
    await storage.remove(object);
    if (await storage.identify(object)) throw new Error("Object deletion was not verified.");
    await journal({ phase: "object-deleted", bucket: object.bucket, key: object.key });
  }
  const remaining = await storage.inventory();
  if (remaining.objects.length || remaining.multipart.length) throw new Error("Legacy journal storage is not empty.");
  await journal({ phase: "media-cleaned", digest: manifest.digest });
}
