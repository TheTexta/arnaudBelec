import { open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { S3Client, ListObjectsV2Command, ListMultipartUploadsCommand, GetObjectCommand, DeleteObjectCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { assertLegacyObject, buckets, cleanMedia, digest, planReset, resetJournal, type Manifest, type Storage, type ObjectIdentity, type Multipart } from "../../lib/cms/reset";

// No dotenv/Payload imports, credential defaults, or target discovery.
async function main() {
  const [phase = "plan", ...args] = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--output", "--manifest", "--confirm"].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error("Invalid arguments.");
    options[args[i]] = args[i + 1];
  }
  if (!["plan", "reset", "clean-media"].includes(phase) || (phase === "plan" ? !options["--output"] || args.length !== 2 : !options["--manifest"] || !options["--confirm"] || args.length !== 4)) throw new Error("Use plan --output FILE, reset --manifest FILE --confirm HASH, or clean-media --manifest FILE --confirm HASH.");
  const required = (key: string) => { const value = process.env[key]; if (!value) throw new Error("Missing explicit operator configuration."); return value; };
  const url = required("ARNAUD_JOURNAL_RESET_DATABASE_URL");
  const endpoint = required("ARNAUD_JOURNAL_RESET_R2_ENDPOINT");
  const target = digest({ database: url, storage: endpoint });
  if (phase !== "plan" && required("ARNAUD_JOURNAL_RESET_WRITES_FROZEN") !== "yes") throw new Error("External write freeze acknowledgement required.");
  const db = new pg.Client({ connectionString: url });
  let s3: S3Client | undefined;
  try {
    await db.connect();
    const file = resolve(options[phase === "plan" ? "--output" : "--manifest"]);
    const journalFile = `${file}.journal.jsonl`;
    async function syncDirectory() { const dir = await open(dirname(file), "r"); try { await dir.sync(); } finally { await dir.close(); } }
    async function journal(event: Record<string, unknown>) {
      const handle = await open(journalFile, "a", 0o600);
      try { await handle.writeFile(`${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`); await handle.sync(); } finally { await handle.close(); }
      await syncDirectory();
    }
    function storage(): Storage {
      s3 = new S3Client({ region: "auto", forcePathStyle: true, endpoint, credentials: { accessKeyId: required("ARNAUD_JOURNAL_RESET_R2_ACCESS_KEY_ID"), secretAccessKey: required("ARNAUD_JOURNAL_RESET_R2_SECRET_ACCESS_KEY") }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
      const client = s3;
      async function identify({ bucket, key }: Pick<ObjectIdentity, "bucket" | "key">): Promise<ObjectIdentity | null> {
        assertLegacyObject(bucket, key);
        try {
          const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          if (!object.Body || !object.ETag || object.ContentLength === undefined) throw new Error("Missing object identity.");
          const hash = createHash("sha256");
          let size = 0;
          for await (const chunk of object.Body as AsyncIterable<Uint8Array>) { hash.update(chunk); size += chunk.length; }
          if (size !== object.ContentLength) throw new Error("Object read-back size differs.");
          return { bucket, key, size, etag: object.ETag, sha256: hash.digest("hex") };
        } catch (error) { if ((error as { name?: string }).name === "NoSuchKey") return null; throw error; }
      }
      return {
        identify,
        async inventory() {
          const objects: ObjectIdentity[] = [], multipart: Multipart[] = [];
          for (const bucket of buckets) {
            let token: string | undefined;
            do {
              const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "blog/", ContinuationToken: token }));
              for (const item of page.Contents ?? []) {
                if (!item.Key) throw new Error("Missing object key.");
                const object = await identify({ bucket, key: item.Key });
                if (!object) throw new Error("Storage changed during inventory.");
                objects.push(object);
              }
              token = page.NextContinuationToken;
              if (page.IsTruncated && !token) throw new Error("Incomplete object inventory.");
            } while (token);
            let keyMarker: string | undefined, uploadMarker: string | undefined;
            do {
              const page = await client.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: "blog/", KeyMarker: keyMarker, UploadIdMarker: uploadMarker }));
              for (const upload of page.Uploads ?? []) {
                if (!upload.Key || !upload.UploadId) throw new Error("Incomplete multipart identity.");
                assertLegacyObject(bucket, upload.Key);
                multipart.push({ bucket, key: upload.Key, uploadId: upload.UploadId });
              }
              keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
              uploadMarker = page.NextUploadIdMarker;
              if (page.IsTruncated && !keyMarker) throw new Error("Incomplete multipart inventory.");
            } while (keyMarker);
          }
          return { objects, multipart };
        },
        async remove(o) { await client.send(new DeleteObjectCommand({ Bucket: o.bucket, Key: o.key, IfMatch: o.etag })); },
        async abort(u) {
          try { await client.send(new AbortMultipartUploadCommand({ Bucket: u.bucket, Key: u.key, UploadId: u.uploadId })); }
          catch (error) { if ((error as { name?: string }).name !== "NoSuchUpload") throw error; }
        },
      };
    }
    if (phase === "plan") {
      const manifest = await planReset(db, storage(), target);
      const handle = await open(file, "wx", 0o600);
      try { await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
      await syncDirectory();
      console.log(JSON.stringify({ phase, digest: manifest.digest, rows: Object.fromEntries(Object.entries(manifest.rows).map(([t, r]) => [t, r.length])), objects: manifest.objects.length, multipart: manifest.multipart.length }));
    } else {
      const manifest = JSON.parse(await readFile(file, "utf8")) as Manifest;
      if (manifest.target !== target) throw new Error("Database/storage target differs.");
      const handle = await open(file, "r"); try { await handle.sync(); } finally { await handle.close(); }
      if (phase === "reset") await resetJournal(db, manifest, options["--confirm"], target, journal);
      else {
        const events = (await readFile(journalFile, "utf8")).trim().split("\n").map(line => JSON.parse(line) as { phase: string; digest?: string });
        await cleanMedia(db, storage(), manifest, options["--confirm"], events.some(e => e.phase === "reset-committed" && e.digest === manifest.digest), journal);
      }
      console.log(JSON.stringify({ phase, digest: manifest.digest, complete: true }));
    }
  } finally { s3?.destroy(); await db.end(); }
}
main().catch(() => {
  // Driver/S3 errors can contain statements, document bodies or credentials.
  console.error("Journal operation refused or incomplete. Retain the manifest and journal; privately verify configuration, external write freeze, permissions and target state before retrying. No automatic recovery or deletion is performed.");
  process.exitCode = 1;
});
