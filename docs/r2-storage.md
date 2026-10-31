# Arnaud R2 storage and staged rollout

## Status and ownership

The owner approved the Arnaud rollout, including production changes, on
2026-10-15 (UTC). Application/SQL/Worker deployment and the eight-photo catalogue
cutover are complete. Admin configuration and authenticated R2 app uploads were
initially deferred. Admin access is now configured; journal upload activation is
recorded below and in `docs/blog-implementation.md`.
No Supabase media deletion is included. Supabase retains Postgres/Auth; Vercel
retains the app. Authorization remains the existing Arnaud server UUID allowlist.

Application, site SQL, CORS and migration tooling belong in this repository.
The shared `dextery-assets` Worker belongs in `../dextery-infrastructure`.
Never publish from historical bur1alrites Worker configuration.

### Journal upload activation — 2026-10-31

The owner approved enabling journal media uploads, leaving new photograph uploads
on Supabase. Staging CORS now permits PUT, GET and HEAD from the exact production
origin, preserving Content-Type, exposed ETag and the 3600-second lifetime. The
updated policy is applied/read back and recorded in `deploy/r2/staging-cors.json`.
Both R2 buckets still have r2.dev disabled and no custom domains. This does not
alter shared Worker routes, bindings, published originals or any other project.

The owner chose to replace the temporarily shared R2 keys directly in Arnaud's
Vercel Production environment with an Object Read & Write credential for exactly
`arnaudbelec` and `arnaudbelec-staging`. The owner has confirmed these values are
saved and bucket-scoped; scope is owner-reported. The journal upload flag is live
in deployment `dpl_7PC4yiArE1uY1Tn1RbS41i11xXfj`. Real private PNG/MP4/WAV uploads,
autosave/preview, SHA-256 read-back, range requests and anonymous denial passed
through the owner's personally signed-in browser on 2026-10-31. See the journal
runbook for the receipt and deployment source fingerprint.
`ARNAUD_UPLOAD_STORAGE` remains `supabase`; the journal flag is independent.
Existing Supabase copies and all recovery/staging objects are retained. The owner
approved only a clearly labeled private test draft, not publication or deletion.
That draft and three staging originals (35,044 bytes total) are retained. Nothing
was published or deleted. This does not prove the journal's published-bucket write
path, public publish/unpublish flow, or worst-case timing. Photograph R2 uploads
and their separate 500 MiB acceptance gate remain deferred.

### Rollout checkpoint — 2026-10-15 UTC

- Created empty Standard/ENAM buckets `arnaudbelec` and `arnaudbelec-staging`.
  Verified both have r2.dev disabled, no custom domains and no objects.
- Applied and read back staging-only CORS matching
  `deploy/r2/staging-cors.json`: exact production origin
  `https://arnaud-belec.vercel.app`, PUT, Content-Type, exposed ETag, 3600 seconds.
  Existing default lifecycle on both buckets already aborts incomplete multipart
  uploads after seven days; no lifecycle change or completed-object expiry added.
- Production has eight R2 catalogue rows and eight checksum-verified published
  originals totaling 13,990,797 bytes. All 16 Supabase objects (27,981,594 bytes,
  including eight retained root copies) remain intact. IDs, filenames, metadata,
  backgrounds, analyses and all palette rows were compared before/after cutover
  and are unchanged; only provider and automatic update timestamps changed.
- Applied `20261016000000_add_arnaud_r2_storage.sql` and recorded its source in
  `supabase_migrations.schema_migrations` in one transaction using the existing
  database administration role. Verified journal RLS, no anon/authenticated
  journal access or R2 RPC execution, and service-role access. The live legacy
  functions already accepted background-v2 despite the historical ledger gap;
  no old migrations were replayed. Pre-migration tables/function definitions,
  before/after metadata and the checksum manifest are retained under `.local/`.
- Local lint, typecheck, seven palette tests, 12 admin tests, 13 storage tests
  (including isolated SQL checks), and production build passed. Shared Worker:
  57 tests and dry-run passed. These are not live upload acceptance results.
- With explicit owner approval, temporarily reused Elliot's working Supabase
  credentials and existing broader R2 credential without changing its scope or
  modifying Elliot. Configured only Arnaud's Vercel Production environment; no
  credential values were logged or added to source. Replace the temporary R2
  credential with an Arnaud-only credential before considering least-privilege
  provisioning complete. Local operations loaded credentials in child-process
  memory from Elliot's ignored environment; Arnaud's original local keys were
  rejected and were not used for migration.
- Compatible app deployment `dpl_Em7DtbL8TtCGDAvwVVTknwbfmvSx` is READY and
  aliased to `https://arnaud-belec.vercel.app`. Worker version
  `05101250-19be-4f94-833a-4fdfa2f1db53` serves 100%; the previous version
  `f2ae5708-3229-40b8-95f3-aa7bf248db51` is retained for rollback. Added only
  `images.dextery.dev/arnaudbelec/*`; existing routes/domain attachments remain.
- All eight public originals passed streamed SHA-256, HEAD, GET, range and ETag
  checks. All eight image transforms, the largest original through Next Image
  at width 3840, the home page and all eight detail pages passed. Private/encoded
  noncanonical paths returned 404 on both hosts. Existing Elliot, bur1alrites and
  Photo Graph media samples retained their ETags/sizes after the Worker release.
- A live private staging smoke test passed multipart create, presigned part URL,
  browser-origin CORS preflight/PUT/exposed ETag, part listing, completion,
  checksum and cleanup. Its temporary object was never published or catalogued.
  Staging and the upload journal are empty. This is **not** an authenticated
  app publication or worst-case 500 MiB timing test.
- **Deferred by owner:** configure Arnaud admins later. The portfolio allowlist
  is a non-readable Vercel Secret and could not be copied; no admin UUIDs were
  inferred and no cross-site access was granted. All four live admin endpoints
  fail closed with 503 while unconfigured. `ARNAUD_UPLOAD_STORAGE=supabase`
  remains set; do not enable R2 app writes until authenticated publication,
  recovery and runtime acceptance pass with the intended admin.
- Deployed the reviewed working tree through Vercel CLI. The owner subsequently
  requested committing and pushing the rollout in both owning repositories;
  future Git deployments must retain this implementation. Local credentials,
  backups and manifests are excluded from Git. No Supabase deletion was performed.

Remaining photograph rollout: complete authenticated photo-upload/recovery/runtime
acceptance before enabling R2 photo uploads. Admin access is now configured and
the owner reports replacing the shared credential, as recorded above. Retain
Supabase originals and the deployed provider SQL. Journal uploads are independently
enabled and privately accepted; this does not close the photograph rollout gate.

## Storage contract

| Resource | Access and purpose |
| --- | --- |
| R2 `arnaudbelec` | Published originals, shared Worker binding `ARNAUD_BELEC` only |
| R2 `arnaudbelec-staging` | Private resumable uploads/recovery; never Worker-bound |
| Supabase `arnaudbelec` | Legacy originals, retained throughout rollback period |

Disable r2.dev and direct bucket custom domains on both R2 buckets. Start with
Standard storage and choose the account-appropriate location hint. No new media
hostname is needed. Use only canonical lowercase `uploads/<uuid>.(jpg|png|webp)`
keys, preserve original bytes and use immutable UUIDs for new objects. Do not
overwrite published objects. Supabase catalogue rows select their own provider;
old rows/schema default to Supabase. Page URLs, IDs, filenames, metadata,
background colours and seven-colour palette algorithms are unchanged.

Published original URLs are `https://media.dextery.dev/arnaudbelec/<key>`.
The shared Worker also offers `https://images.dextery.dev/arnaudbelec/<key>`
with its bounded `width`, `quality`, `format=auto` transforms. The app continues
to use Next Image's existing optimizer against original URLs, rather than
introducing a second image-loader pipeline in this migration. Keep this working
for the largest catalogue original; do not assume Cloudflare transforms can
process every 500 MiB/120-million-pixel upload. Oversized-source optimization
requires separate sizing/derived-source work if live verification fails.

The empty-catalogue fallback is still the legacy Supabase listing, not R2
enumeration. Root/unreferenced/pending legacy objects are inventoried, not
automatically published, copied or deleted. Static site assets and future
video/audio/blog/transcoding workflows are outside this photograph migration.

## Provisioning checklist (approval required)

1. Inventory live catalogue rows, all legacy objects and sizes, existing Worker
   version/routes/bindings, production origins and effective SQL grants/RLS.
2. Provision the two empty buckets, with public access disabled. Create R2 S3
   Object Read & Write credentials scoped to exactly these buckets. Test both
   reads and writes; a token merely existing does not prove its bucket scope.
3. On staging only, configure the S3 CORS policy in
   `deploy/r2/staging-cors.json`. Reconfirm the actual production origin first.
   For local testing add exact `http://localhost:3000` only if needed; list
   approved preview origins explicitly. No wildcard Vercel origins. Requests
   upload directly to the R2 S3 endpoint, not the delivery custom domains.
   API signing and auth—not CORS—provide authorization.
4. Review/apply `deploy/r2/staging-lifecycle.json` (S3 lifecycle format), merging
   deliberately with existing rules: incomplete multipart uploads abort after
   seven days. Do not expire completed staging objects automatically until a
   recovery window and reconciliation procedure are approved. Never expire
   published originals. SQL reservations/tickets currently last 24 hours.
5. Apply `supabase/migrations/20261016000000_add_arnaud_r2_storage.sql` after all
   existing Arnaud migrations. Reconcile deployed function definitions first.
   It adds a per-photo provider and server-only journal, retains the legacy
   RPC signature and Storage existence check, and corrects the preceding
   migration's extra UUID group in its path regex. New RPCs are service-role
   only; the recovery table has RLS and no browser-role policies or grants.
6. Set the server-only R2 variables listed in `.env.example` locally and in the
   appropriate Vercel environment. Keep `ARNAUD_UPLOAD_STORAGE=supabase`.
   Deploy the backward-compatible app before switching any records.
7. Separately approve/release the shared Worker published bucket binding and
   `/arnaudbelec/` route; never bind staging or change existing bucket-domain
   attachments. Preserve Elliot, bur1alrites and Photo Graph compatibility.

## Migration commands

These commands load `.env.local`. They may read production even when not writing.
Inspect inventories and get separate authorization before write commands.
Do not run concurrent migration processes against the same manifest/bucket.

```sh
# Read-only, paginated catalogue + recursive legacy object inventory.
npm run photos:migrate-r2

# Explicitly authorized copy: published catalogue references only.
# Resumes from an atomically written local manifest, never overwrites R2 keys.
npm run photos:migrate-r2 -- --copy --manifest .local/arnaud-r2.json --confirm-production

# Fresh source and destination SHA-256/size/content-type readback; no remote writes.
npm run photos:migrate-r2 -- --verify --manifest .local/arnaud-r2.json

# With legacy writes frozen and final approval: verify ALL bytes again, reconcile
# catalogue identities, then conditionally switch providers. No objects deleted.
npm run photos:migrate-r2 -- --cutover --manifest .local/arnaud-r2.json --confirm-production
```

Use the same manifest/source scope on retries. An existing manifest hash is not
trusted as current verification. Source drift, a destination mismatch or catalogue
additions/removals/path changes stop migration. Cutover updates are per-row, not
one cross-system transaction: if interrupted, some rows may be R2 and others
Supabase. The app supports both; rerun after investigation to finish. Freeze
legacy writes through final reconciliation because object/database systems
cannot be locked atomically by this tool. Preserve manifests and inventory
evidence outside Git. `.local/` is ignored; never put credentials in manifests.

After cutover and delivery checks, separately approve setting
`ARNAUD_UPLOAD_STORAGE=r2`. This changes new admin and CLI uploads only, never
existing catalogue providers. Import/reanalysis retain their existing commands:

```sh
npm run photos:import -- --dry-run path/to/photo.jpg
npm run photos:import -- path/to/photo.jpg
npm run photos:reanalyze -- --dry-run
```

The R2 CLI importer uses a stable filename+original-bytes identity and journal
so retrying the exact import does not create a new object. Its journal actor is
the first configured `SUPABASE_ADMIN_USER_IDS` UUID; CLI service credentials are
privileged and must only be used by trusted operators. Expired CLI reservations
require explicit operator reconciliation/renewal, not automatic object deletion.

## Admin recovery and publication

Prepare authenticates the existing admin, reserves a unique object, and starts
multipart upload in private staging. Part signing/status authenticates on every
request, verifies the user-bound signed ticket and database reservation, and
issues 15-minute URLs for one 8 MiB part at a time. Completed part numbers/sizes
come from R2, not trusted browser completion claims. Original uploads never
traverse Vercel; the existing 96-pixel sample analysis remains unchanged.

The browser stores its R2 ticket in sessionStorage (scoped to user and file
name/size/lastModified). In the same tab, reselect the same original after reload
to resume its server-listed parts; metadata fields must be reentered. In-memory
retries work when browser storage is unavailable. Signing credentials never
enter the browser. A closed tab/lost ticket leaves the server journal available
to an operator; there is no automatic cross-device recovery UI.

Publication validates the sample/metadata, completes multipart, streams SHA-256
verification of staging and promoted R2 bytes, then atomically commits the
catalogue, palette and journal state in the service-role RPC. SHA-256 readback
consumes original download streams in the server function (not upload proxying)
and may be expensive for large files. `maxDuration=300` is requested, but Vercel
plan/runtime limits and worst-case 500 MiB timings must pass live acceptance
before enabling R2 uploads. Retry resumes completed storage work on timeout;
move verification to a durable background processor if timings are insufficient.

Promotion and SQL are not atomic. A failed/uncertain publication retains staging
and any promoted original; a promoted orphan can be served at its canonical UUID
URL but is not enumerated in the catalogue. Do not treat the published bucket as
an authorization boundary for drafts. On retries, never overwrite mismatched
existing originals or remove potentially published bytes. SQL locks the journal
row so simultaneous publication calls commit once. Only a confirmed successful
publication attempts staging cleanup. Cleanup failure is nonfatal and requires
later reconciliation. Never blanket-delete old journal objects: compare the
catalogue, journal, both buckets, active reservations and checksums first.

## Verification and rollback gates

Local: `npm run lint`, `npm run typecheck`, `npm run test:palette`,
`npm run test:admin`, `npm run test:storage`, `npm run build`.
Storage tests run all migrations against isolated in-memory Postgres (PGlite),
including grants/RLS, legacy publication, R2 verification gates and RPC retries.
They do not establish effective policy state in production or real R2 behavior.
Shared infrastructure: `npm test` and `npm run assets:check` (never publish).

Live, after specific approval: verify original hashes, GET/HEAD/range/ETag,
transforms and Next Image at largest sizes, private/encoded-path denials,
real authenticated upload, interruption/resume/duplicate/expired ticket paths,
palette parity, CLI provider-aware reads, empty staging after success and all
existing projects' image/media routes. Confirm legacy originals remain intact.

Before R2-only uploads: switching verified migrated rows back to `supabase`
and disabling R2 uploads can restore legacy delivery while retaining R2 copies.
After R2-only uploads: first reverse-copy and checksum-verify EVERY R2-only
original into canonical Supabase Storage, then switch its provider. Retain
the SQL provider/journal migration and Worker until all R2 rows/consumers are
accounted for. No down migration, destructive cleanup or automated rollback
is supplied. Restore from independent backups if both providers lose originals.
