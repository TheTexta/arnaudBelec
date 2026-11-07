# Private large-original operator import

**Production acceptance:** the owner-approved three-master intake completed with
16,205,649,755 independently read-back-verified original bytes. All remain attached
only to saved private Video drafts. Final release:
`dpl_9BCvNXNg1nmLSUyppiuJvUoQcoen`; applied raw journal migration:
`20261106_120000_large_originals`. See
[`original-video-support-plan.md`](original-video-support-plan.md) for evidence,
preservation, temporary-access cleanup and the untested Safari/iOS limitation.

This CLI is an **operator-only Mac process**, not a Vercel request or a Payload
collection/registration endpoint. Ordinary native uploads still have the existing
100 MiB receipt/verification rules. Importing creates a private Media record only:
it does not create or publish a Video/project/post. Keep the existing Video drafts
private. The source file is opened read-only; no compression/remux/transcode occurs.

## Prerequisites and explicit authority

Apply `20261106_120000_large_originals` after the native/category migrations with
separately approved deployment authority. It creates only a raw private operator
journal; no Media column change or Payload schema snapshot is needed.

Use Node from `.nvmrc`, installed project dependencies and local `ffprobe` on PATH.
Supply environment variables through the approved operator shell; **the command
never loads .env files or reads application credentials**:

- `ARNAUD_ORIGINALS_OPERATOR_ENABLED=true`
- `ARNAUD_ORIGINALS_DATABASE_URL`: direct Arnaud owner/migrator identity, not runtime
- `ARNAUD_ORIGINALS_ACTOR_ID`: an existing `arnaud_cms.cms_users` UUID
- `ARNAUD_ORIGINALS_R2_ACCOUNT_ID`, `ARNAUD_ORIGINALS_R2_ACCESS_KEY_ID`,
  `ARNAUD_ORIGINALS_R2_SECRET_ACCESS_KEY`, optional
  `ARNAUD_ORIGINALS_R2_SESSION_TOKEN` (supported for temporary credentials)

Scope the temporary R2 capability to private `arnaudbelec-staging` and
`journal-native/large-originals/` only. No existing native originals, other bucket,
ListBuckets permission, public URL, application feature flag or new shared role is
needed. Provision a several-hour capability covering transfer and full read-back.
Never place credentials in arguments, source control, reports or local snapshots.

## Commands

```sh
npx tsx scripts/cms/import-original.ts --help
npx tsx scripts/cms/import-original.ts --file /absolute/master.mp4
npx tsx scripts/cms/import-original.ts --file /absolute/master.mp4 --key stable-owner-approved-name --upload
npx tsx scripts/cms/import-original.ts --inspect IMPORT_UUID
npx tsx scripts/cms/import-original.ts --file /absolute/master.mp4 --resume IMPORT_UUID --upload
```

No flags prints help. Without `--upload`, a supplied file is a local-only dry run
(full SHA-256 and bounded ffprobe, no DB/R2). `--dry-run` explicitly asserts that
mode. New writes require **both** `--upload` and operator enable. Reuse the stable
idempotency key or import UUID after interruption; never invent a new key to hide
an uncertain import. UUID filenames are globally unique; original names remain in
the private journal and Media caption. Delivery remains
`/api/cms/media/file/<UUID>.mp4`; coordinates are prefix `journal-native`,
`_objectkey=large-originals/<UUID>`, `upload_identity=<UUID>`.

Limits: 1 byte–8 GiB, actual MP4 detection, H.264 video/AAC audio, 64 MiB parts,
two concurrent part buffers. ffprobe has a 30-second timeout/1 MiB output bound;
part/control requests have five-minute timeouts, full read-back one hour. A
renewed exclusive DB lease lasts 30 minutes, allowing recovery after process death.
DB transactions never encompass transfer or hashing. Every DB connection checks
the operator role and the existing actor.

## Verification and recovery

The source identity (canonical path/device/inode/size/mtime/ctime) and full SHA-256
are bound before upload and rechecked before completion. Resume trusts paginated
R2 ListParts, not local acknowledgements; unexpected size/order/duplicate part
entries fail closed. Completion uses `If-None-Match: *` and a unique immutable key;
an uncertain result is reconciled with HEAD. Unsupported conditional completion
fails closed rather than falling back to overwrite. Before registration the
operator independently streams the entire private R2 object with `If-Match`,
computes SHA-256/size/detected MIME and checks HEAD before/after. The local probe
is bound to that exact SHA using the same inherited, seekable descriptor as the
hash pass, so a path/symlink swap cannot probe a different file. No second remote
ffprobe URL is required. New object metadata is `private, no-store`.

One short locked transaction records verified observations, inserts native Media,
and links its unique ID in the journal. A crash/retry cannot create a second Media
row. Runtime/browser/public roles cannot read or write the journal. No HTTP caller
can submit `verified:true` to this path.

Private atomic, fsynced 0600 snapshots are written under 0700
`.local/original-imports` (or explicit `--journal-dir`). They contain identity,
UUID, key and upload ID, not credentials/signed URLs/raw errors. The DB journal is
authoritative. SDK/DB errors are deliberately not printed; inspect retained state
through the operator command. `recoverable_error` is not permission to delete.

If CreateMultipartUpload's response is lost, `upload_id=CREATE_UNCERTAIN` blocks
blind recreation. A separately authorized operator must diagnose the private
orphan upload, and attach its confirmed upload ID to the same journal record.
Do not auto-abort or delete. If completion succeeded before interruption, resume
finds the object and repeats independent verification. If registration committed
but its response was lost, resume returns the existing Media ID. Expired temporary
credentials require new identically scoped credentials, then the same resume UUID.
Leases must expire or be released by the original process; never force-take a live
operator lease. Source changes fail closed and retain all recovery objects.

After acceptance, revoke only the task's temporary Auth session (local logout,
then verify other sessions survive), delete its local credential/signed-URL
artifacts, and stop/remove only its owned tunnel/isolated restore fixture. R2 STS
credentials auto-expire; do not revoke or rotate the parent site key merely to
retire one temporary credential. Retain non-secret import/recovery receipts and
originals. The real acceptance fixture's 64-byte object and 64-byte pending part
remain private; their cleanup is a separate approval, not an importer side effect.

No down migration removes this audit/recovery journal. Retirement, orphan cleanup,
source deletion, publication and credential provisioning are separate approvals.
