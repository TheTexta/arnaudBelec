import { createHash, randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";

export const MAX_ORIGINAL_BYTES = 8 * 1024 ** 3;
export const PART_BYTES = 64 * 1024 ** 2;
export const PRIVATE_BUCKET = "arnaudbelec-staging";
export type Probe = { duration: number; width: number; height: number; videoCodec: string; audioCodecs: string[] };
export type Manifest = { filename: string; bytes: number; sha256: string; identity: Record<string, string>; probe: Probe };
export type ImportRecord = Manifest & { id: string; actor: string; idempotency: string; key: string; bucket: string; state: string; uploadId?: string; mediaId?: string };
export type Part = { number: number; bytes: number; etag: string };
export type Head = { bytes: number; etag: string };
export type Observation = Head & { sha256: string; mime: "video/mp4" };
export interface Source {
  scan(): Promise<Manifest>;
  assertIdentity(identity: Manifest["identity"]): Promise<void>;
  part(offset: number, bytes: number, identity: Manifest["identity"]): Promise<Buffer>;
}
export interface Journal {
  reserve(record: ImportRecord): Promise<ImportRecord>;
  inspect(id: string): Promise<ImportRecord>;
  lease(id: string, token: string): Promise<void>;
  renew(id: string, token: string): Promise<void>;
  release(id: string, token: string, failed: boolean): Promise<void>;
  upload(id: string, token: string, uploadId: string): Promise<void>;
  state(id: string, token: string, state: "uploaded" | "verifying"): Promise<void>;
  register(id: string, token: string, observation: Observation): Promise<string>;
}
export interface Storage {
  head(key: string): Promise<Head | null>;
  create(key: string): Promise<string>;
  list(key: string, uploadId: string, marker?: string): Promise<{ parts: Part[]; next?: string }>;
  put(key: string, uploadId: string, number: number, body: Buffer): Promise<string>;
  complete(key: string, uploadId: string, parts: Part[]): Promise<void>;
  read(key: string, etag: string): Promise<AsyncIterable<Uint8Array>>;
}

export function validateManifest(manifest: Manifest) {
  if (!Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1 || manifest.bytes > MAX_ORIGINAL_BYTES) throw new Error("Original must be 1 byte to 8 GiB.");
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256) || !/\.mp4$/i.test(manifest.filename) || /[/\\\0]/.test(manifest.filename)) throw new Error("Invalid MP4 manifest.");
  const p = manifest.probe;
  if (!Number.isFinite(p.duration) || p.duration <= 0 || !Number.isInteger(p.width) || p.width < 1 || !Number.isInteger(p.height) || p.height < 1 || p.videoCodec !== "h264" || p.audioCodecs.some(codec => codec !== "aac")) throw new Error("Expected H.264/AAC MP4 probe metadata.");
}
function validateRecord(record: ImportRecord) {
  validateManifest(record);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(record.id) || record.bucket !== PRIVATE_BUCKET || record.key !== `journal-native/large-originals/${record.id}/${record.id}.mp4`) throw new Error("Import storage identity denied.");
}
function sameSource(a: Manifest, b: Manifest) {
  // Postgres JSONB normalizes key order; compare scalar identity values.
  if (a.filename !== b.filename || a.bytes !== b.bytes || a.sha256 !== b.sha256 || Object.keys(a.identity).length !== Object.keys(b.identity).length || Object.entries(a.identity).some(([key, value]) => b.identity[key] !== value)) throw new Error("Source changed; recovery records retained.");
}

export function createOriginalImporter(journal: Journal, storage: Storage, source: Source, actor: string) {
  async function parts(record: ImportRecord) {
    const found: Part[] = [];
    const markers = new Set<string>();
    let marker: string | undefined;
    do {
      const page = await storage.list(record.key, record.uploadId!, marker);
      found.push(...page.parts);
      marker = page.next;
      if (marker && markers.has(marker)) throw new Error("Repeated ListParts marker.");
      if (marker) markers.add(marker);
    } while (marker);
    let previous = 0;
    const count = Math.ceil(record.bytes / PART_BYTES);
    for (const part of found) {
      if (!Number.isInteger(part.number) || part.number <= previous || part.number > count || part.bytes !== Math.min(PART_BYTES, record.bytes - (part.number - 1) * PART_BYTES) || !part.etag) throw new Error("Invalid remote multipart manifest.");
      previous = part.number;
    }
    return found;
  }
  async function run(id: string) {
    const token = randomUUID();
    await journal.lease(id, token);
    let failed = true;
    let lost = false;
    let heartbeat = Promise.resolve();
    const timer = setInterval(() => { heartbeat = heartbeat.then(() => journal.renew(id, token)).catch(() => { lost = true; }); }, 10_000);
    const guard = async () => { await heartbeat; if (lost) throw new Error("Operator lease lost."); await journal.renew(id, token); };
    try {
      let record = await journal.inspect(id);
      validateRecord(record);
      if (record.actor !== actor) throw new Error("Import actor denied.");
      if (record.mediaId) { failed = false; return record; }
      sameSource(record, await source.scan());
      await guard();
      let head = await storage.head(record.key);
      if (!head) {
        // Intent is durable BEFORE Create. A lost response needs operator
        // diagnosis, never a blind new upload that hides a private orphan.
        if (!record.uploadId) {
          await journal.upload(id, token, "CREATE_UNCERTAIN");
          const uploadId = await storage.create(record.key);
          await journal.upload(id, token, uploadId);
          record = { ...record, uploadId };
        }
        if (record.uploadId === "CREATE_UNCERTAIN") throw new Error("Uncertain multipart creation; operator diagnosis required.");
        const remote = await parts(record);
        const present = new Set(remote.map(part => part.number));
        const pending = Array.from({ length: Math.ceil(record.bytes / PART_BYTES) }, (_, i) => i + 1).filter(n => !present.has(n));
        // Two bounded buffers, never a whole-file buffer or unbounded queue.
        for (let i = 0; i < pending.length; i += 2) {
          await guard();
          const results = await Promise.allSettled(pending.slice(i, i + 2).map(async number => {
            const offset = (number - 1) * PART_BYTES;
            const body = await source.part(offset, Math.min(PART_BYTES, record.bytes - offset), record.identity);
            await guard();
            await storage.put(record.key, record.uploadId!, number, body);
          }));
          if (results.some(result => result.status === "rejected")) throw new Error("Part transfer interrupted; resume from authoritative remote parts.");
        }
        sameSource(record, await source.scan());
        const completeParts = await parts(record);
        if (completeParts.length !== Math.ceil(record.bytes / PART_BYTES) || completeParts.some((part, index) => part.number !== index + 1)) throw new Error("Missing remote parts.");
        await guard();
        head = await storage.head(record.key);
        if (!head) {
          // Adapter sends If-None-Match: *. A lost completion response is
          // reconciled by HEAD and an independent full-byte verification.
          try { await storage.complete(record.key, record.uploadId!, completeParts); }
          catch { head = await storage.head(record.key); if (!head) throw new Error("Completion uncertain; retain and resume."); }
        }
        head = await storage.head(record.key);
      }
      if (!head || head.bytes !== record.bytes || !head.etag) throw new Error("Remote original size mismatch.");
      await journal.state(id, token, "uploaded");
      await journal.state(id, token, "verifying");
      const digest = createHash("sha256");
      let bytes = 0;
      let prefix = Buffer.alloc(0);
      for await (const chunk of await storage.read(record.key, head.etag)) {
        if (lost) throw new Error("Operator lease lost.");
        bytes += chunk.length;
        if (bytes > record.bytes) throw new Error("Remote original exceeds expected size.");
        digest.update(chunk);
        if (prefix.length < 8192) prefix = Buffer.concat([prefix, chunk.subarray(0, 8192 - prefix.length)]);
      }
      const sha256 = digest.digest("hex");
      const detected = await fileTypeFromBuffer(prefix);
      const after = await storage.head(record.key);
      if (bytes !== record.bytes || sha256 !== record.sha256 || detected?.mime !== "video/mp4" || after?.etag !== head.etag || after.bytes !== bytes) throw new Error("Independent remote verification failed.");
      await source.assertIdentity(record.identity);
      await guard();
      await journal.register(id, token, { bytes, sha256, mime: "video/mp4", etag: head.etag });
      failed = false;
      return await journal.inspect(id);
    } finally {
      clearInterval(timer);
      await heartbeat;
      await journal.release(id, token, failed);
    }
  }
  return {
    async beginOriginal(idempotency: string) {
      if (!idempotency || idempotency.length > 200) throw new Error("An explicit stable idempotency key is required.");
      const manifest = await source.scan();
      validateManifest(manifest);
      const id = randomUUID();
      const record = await journal.reserve({ ...manifest, id, actor, idempotency, key: `journal-native/large-originals/${id}/${id}.mp4`, bucket: PRIVATE_BUCKET, state: "reserved" });
      validateRecord(record);
      sameSource(record, manifest);
      return record;
    },
    resumeOriginal: run,
    completeOriginal: run,
    async inspectOriginal(id: string) { const record = await journal.inspect(id); validateRecord(record); if (record.actor !== actor) throw new Error("Import actor denied."); return record; },
  };
}
