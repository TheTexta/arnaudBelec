# Original-quality video intake — completed

## Approval boundary

**Follow-up approval (2026-11-06):** the owner approved this plan and requested
upload after implementation. Work is now authorized for these three supplied
masters, the additive private import journal, scoped release and real large-file
acceptance. The chosen initial execution location is this operator Mac, with an
8 GiB/file ceiling, bounded 64 MiB multipart transfer and temporary credentials
limited to `arnaudbelec-staging/journal-native/large-originals/`. Existing native
Media is outside that credential prefix. No permanent worker/service, encoding,
public project publication or unrelated pending site changes are included.

The implementation preserves the ordinary 100 MiB native uploader.
The operator journal's unique Media relationship provides provenance without an
unnecessary new Media column or HTTP verification-bypass endpoint. Registration
requires private operator database authority and independent streamed R2
verification, never a client-supplied `verified: true`.

The initial 2026-11-06 decision was **plan original-video support**, not compression
or upload. That earlier hold is superseded only by the follow-up approval above.
The completed category/image import remains independent. All supplied originals
remain untouched.

## Completed rollout and acceptance

The approved 2026-11-06 intake finished on 2026-11-07 UTC. **All three supplied
masters, 16,205,649,755 original bytes, are uploaded and independently read-back
SHA-256/size/MIME verified.** Nothing was compressed, remuxed, renamed, deleted or
published. Source identities remain unchanged.

- Lullaby is the `film` in its existing saved private draft. To Hang's existing
  draft body retains its prior content and appends separately labelled **OVES**
  and **VOSF** native uploads. Neither is designated a preferred primary cut.
  Covers, ordered galleries, slugs, years, credits and previous history survive.
  Changes are saved draft versions, not public main-document publication.
- Applied only additive native migration `20261106_120000_large_originals` using
  the existing migrator→owner identity. No Media columns, Payload collection,
  HTTP verification bypass, runtime journal grants or shared authorization change.
  Full expansion/homepage migrations remain unapplied and separately gated.
- Final application: **`dpl_9BCvNXNg1nmLSUyppiuJvUoQcoen`** at
  `https://arnaud-belec.vercel.app`. Its 202 deployed source files match archive
  SHA-256 `2a7b36cf12e4df24a7ebe66bb84d16d364f4a570366bde1867b99b0175cf1b30`.
  The video release was rebased onto independently released palette deployment
  `dpl_C6pjaSz3JYLw8c56hGsno7uweHZe`; its palette code is preserved. The earlier
  stage `dpl_DiuWTMnqmbf6wiUhz6KYrNrU3iTy` was never promoted and is not a safe
  rollback baseline. Final retry fix supersedes `dpl_HPXJpnWACDSTfEs2NMz1F96GqXTA`.
- Real Lullaby lost-part acknowledgement/resume reused stored parts. Real R2
  conditional completion and mismatched `If-Match` both returned 412. Full native
  backup restored into isolated PostgreSQL 15.8; all 20 original table fingerprints
  matched before migration. Migration preservation and concurrent-lease tests passed.
- All masters passed first/tail/suffix byte comparisons, invalid-range 416,
  anonymous denial and actual expired-capability 403 checks; signing remains 60s.
  Six real 4K initial/tail playback cases passed in Chrome at 1440px and 390px.
  OVES also passed a genuinely unbuffered seek after actual capability expiry,
  reauthorization through the canonical app URL, preserved pause and resumed
  decoded frames, without manual Retry. Captures were inspected; no page errors or
  overflow were observed. This is not a continuous ten-minute playback benchmark.
- Main checks: lint, types, 54 CMS, three media and 40 site tests. Frozen scoped
  release: lint/types, 36 CMS, three media, 13 mocked-transport recovery cases and
  enabled/disabled Webpack builds. Rebased palette/admin/storage checks also passed.
  Descriptor-bound probing and retry-state fixes have regression coverage.
- All 20 pre-existing Media, prior Journal/Fashion content and Video history
  content are preserved. Only three Media were created by this task. Concurrent
  Circle of Fashion's ten Media and private draft are separately observed and
  preserved, not counted as video imports. All 16 photograph rows are unchanged;
  the independent 16-photo MMCQ rollout is retained, not attributed to video work.
- Only the temporary import Auth session was revoked; all 16 prior sessions and
  all 18 other sessions present at logout survived. Fresh capabilities for all
  three originals were denied after logout. Token/signed-URL/temporary-R2 artifacts
  were removed. The prefix-scoped STS credential auto-expires at
  `2026-11-07T04:07:16.597Z`; it cannot be individually revoked without affecting
  the site's parent key, which was not changed. The owned network-none restore
  container and loopback tunnel were removed/stopped. No production service or
  persistent volume was deleted. One 64-byte private safety fixture and one
  64-byte incomplete multipart part are intentionally retained pending cleanup
  authorization. No commit or push was performed.

**Remaining limitation:** Safari, WebKit and physical iOS were not tested. Narrow
Chrome viewport checks are not mobile-device acceptance; original ~100–103 Mbps
4K delivery still needs compatible decoding and sufficient network headroom.
No adaptive rendition, automatic compression or universal smooth-playback claim
is implied. P22's separate web-use licence/deployment gate remains unchanged.

Private operational evidence is retained in ignored
`.local/original-video-intake-20261106/`: source/upload/recovery receipts, frozen
release manifests, playback/range/expiry results, preservation and cleanup receipts.
No bearer credentials or signed URLs are needed for this documentation. The
shipping procedure is [`large-original-operator.md`](large-original-operator.md).

## Supplied masters

| Filename | Bytes | Duration | Video |
| --- | ---: | ---: | --- |
| `Lullaby - 1min Visualizer.mp4` | 767,818,349 | 61.228 s | 3840×2160 H.264 Main 5.1, ~100 Mbps |
| `To Hang by a Thread (2025) - OVES.mp4` | 7,603,284,270 | 606.272 s | 3840×2160 H.264 High 5.2, ~100 Mbps |
| `To Hang by a Thread (2025) - VOSF.mp4` | 7,834,547,136 | 606.272 s | 3840×2160 H.264 High 5.2, ~103 Mbps |

Read-only box inspection and `ffprobe` found front-loaded `moov` metadata in all
three files; no fast-start remux is needed. All have AAC audio and approximately
23.976 fps. OVES/VOSF are preserved as supplied labels, without inferred meanings
or credits. Full video SHA-256 hashes were subsequently calculated read-only before
implementation: all three source identities and byte counts were stable. The
private manifest is `.local/original-video-intake-20261106/source-manifest.json`;
the independent complete read-back acceptance is recorded above.

## Implemented operator design

Use a small, operator-run large-original importer first. Leave the existing native
≤100 MiB uploader and its verified immutable Media workflow unchanged. Upload
directly to private R2 using multipart requests; perform trusted read-back
verification outside Vercel; register into the existing Media collection only
after verification. Do not introduce another publication/authorization model or
reuse another project's processing infrastructure without separate approval.

Increasing `MAX_MEDIA_BYTES` alone is unsafe. Native receipt materialization
downloads the object to Vercel temporary storage before Media creation; multi-GB
files exceed practical duration/disk/retry boundaries. The current single PUT is
also unsuitable for the two >5 GiB files. MIME and client hashes are not trusted
verification, and multipart ETags are not SHA-256 hashes.

### 1. Private additive journal and registration seam

Private `arnaud_cms.media_imports` journal:

- UUID, actor UUID, unique idempotency key and unique immutable object identity.
- Original filename, expected bytes (`bigint`) and SHA-256; fixed site bucket/key.
- Multipart upload ID, part size and durable progress.
- State: reserved → uploading → uploaded → verifying → verified → registered;
  recoverable failure details, verification lease/attempt and timestamps.
- Observed byte count/hash/MIME, ETag, probe metadata and unique Media ID.

Constrain valid states, positive byte counts and hash formats. Journal access stays
private. Ordinary HTTP fields must never grant trusted verification or bypass the
native receipt. The journal's unique Media relationship supplies provenance without
adding Media fields. Internal registration is bound to the locked journal and
independently verified observations. A short
transaction registers the existing object exactly once without downloading or
uploading it again. Preserve descriptive-only Media updates and project relations.

The reviewed raw Postgres migration has restrictive grants and is intentionally
outside Payload model snapshots/types. Historical migrations and shared
authorization are not rewritten. Operator module interface:

```text
beginOriginal(stableIdempotencyKey) → reservedRecord
resumeOriginal(importId) → verifiedAndRegisteredRecord
completeOriginal(importId) → verifiedAndRegisteredRecord
inspectOriginal(importId) → currentRecord
```

### 2. Resumable original-preserving transfer

Stream a full local SHA-256 and detect source changes before/during transfer.
Allocate a unique random `journal-native/large-originals/<UUID>/<UUID>.mp4` key in
private `arnaudbelec-staging`. Transfer 64 MiB parts with concurrency two using
temporary prefix-scoped credentials. Per-part signed browser URLs are unnecessary
for this operator-only CLI; every import remains bound to its existing CMS actor.

Persist local progress atomically without credentials/signed URLs in ordinary
logs. Reconcile paginated R2 `ListParts`, contiguous numbering and expected sizes;
local/browser progress is not authoritative. Reconcile a lost completion response
against the resulting object before retrying. No publication copy, overwrite,
compression, remux or automatic deletion. Cancellation stops transfer but does
not authorize deleting retained originals.

### 3. Trusted bounded-memory verification outside Vercel

Choose and approve the operator execution location and narrowly scoped authority
before implementation. No permanent worker/queue/server is assumed for three
files. Stream completed R2 bytes through SHA-256, compare independently calculated
source bytes/hash, validate identity before/after verification, detect MIME and
run bounded probing. Record unsupported streams rather than transforming them.

Network/hash/probe work occurs outside database transactions. Interrupted
verification can restart without re-uploading. Failed objects/journals remain
private and recoverable. `HEAD` metadata, client assertions and multipart ETag
alone cannot establish successful verification.

### 4. Original playback acceptance

Byte-range H.264/AAC playback is plausible with the existing front-loaded metadata,
but 4K profile/level compatibility and sustained ~100–103 Mbps plus headroom make
smooth mobile playback uncertain. The current 60-second signed download capability
also needs long-play, pause and later-seek testing; do not silently lengthen it.
First establish whether subsequent browser ranges reauthorize through the stable
application URL. If not, implement explicit renewal/recovery preserving position,
or seek separate approval for a different delivery design.

Keep draft/version media denied anonymously. Only currently published main-document
references authorize new public capabilities. Unpublishing stops new capabilities;
existing bearer links remain usable only until expiry. Test initial/tail/suffix/
invalid ranges, seeking after expiry, long pauses, expired admin sessions, and
desktop/mobile codec compatibility.

## Acceptance and recovery gates

- Agree an explicit byte ceiling covering the largest file, operator-first scope,
  execution location, authority and playback targets before implementation.
- Test interruption, expired signatures, changed source, missing/duplicate parts,
  pagination, mismatched checksums, uncertain completion and registration crash/retry.
- Test cross-site/non-admin denial, forged verification, arbitrary bucket/key,
  ordinary receipt bypass, duplicate registration and draft/history privacy.
- Rehearse real isolated Postgres migration/concurrency; run lint, typecheck,
  CMS/storage tests and enabled/disabled builds.
- Owner approval covered real R2/Vercel acceptance with the supplied masters;
  both **>5 GiB** cuts passed. A small fixture alone does not establish support.
- Preserve local originals and compare complete source/read-back hashes.

Rollback disables new imports but retains compatible reads, schema, journals and
originals. Prefer forward fixes; do not delete originals or use a destructive down
migration to roll back software. Unpublish only specifically approved content.
The legacy-only `scripts/cms/backup-native.py` is not a backup plan for this model.

## Storage and delivery impact

The supplied masters total ~16.21 GB decimal. Budget retained storage, incomplete
multipart parts, request counts, full verification reads, retries and viewer bytes.
One full film play can approach 7.6–7.8 GB. Check current R2 pricing and terms;
private signed delivery may have limited cache reuse. Adaptive or smaller derived
renditions remain an optional, separately approved follow-up, not a requirement
imposed on the original-quality request.
