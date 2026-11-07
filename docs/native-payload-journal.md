# Native Payload journal

## Status

**Scoped category follow-up (2026-11-06):** production now runs
`dpl_BPRvSrJzRqsBgFEFP47s2QY33hyn`, built from the exact native release below plus
Video/Fashion only. Both existing Journal posts, their four versions and original
Media item are unchanged. The category-only migration is applied; 19 new verified
private images and three private project drafts were added, with no project
publication or master-video upload. Full homepage/settings/newsletter/font/palette
changes remain separate. See [`portfolio-intake-20261106.md`](portfolio-intake-20261106.md)
for the backup, migration, source and verification receipts. The following native
Journal release history remains valid as its preserved baseline.

**Deployed on 2026-11-03** at `https://arnaud-belec.vercel.app` as
`dpl_6C3noecjyNv85wrB3LxoSC6Z6vkP`. Payload 3.92.1 owns native Lexical documents,
versions, autosave, publication state, upload metadata and the Media library.
The owner-approved old-content reset, native migration, Arnaud-only runtime
credential rotation/dedicated-gateway restart and staging CORS update are complete.
Separately approved signed-in real R2/Vercel upload/playback/publication acceptance
and exact test-fixture cleanup **passed on 2026-11-03**, as recorded below. Empty
legacy-table retirement still needs separate approval. The initial deployment was
not an editorial launch; real user content created afterward remains independent
of the acceptance fixtures.

The owner selected removal of **all existing journal posts**, not only the two
imported posts. The last read-only inventory was three posts, 21 legacy revisions,
11 imported history records, five native versions, five media and no publications.
The execution-time inventory matched these counts; the approved reset removed them.
Photographs, palettes, Auth users and unrelated local work are out of scope.

## Production cutover record — 2026-11-03

- A reviewed source snapshot excluded both local photograph placeholder edits,
  their new helpers/tests, `.impeccable` work and the unrelated README paragraph.
  Source SHA-256: `bf95d9c9d2c8292368b3804dde297d095f05ef24c9e676ec70ff8e167f120ba7`.
  Vercel built it independently with production configuration, initially without
  assigning the canonical domain. No Git commit or push was made.
- A disposable, unpublished native PostgreSQL instance passed the checked-in
  migrations, real non-overridden document-lock reads, concurrent saves (one commit,
  one 409), another author's lock (423), rollback, private restore and native
  Unpublish→Publish. It also passed the exact cutover fence/reactivation SQL.
  The owned instance and both maintenance SSH forwards were removed afterward.
- The old runtime was made NOLOGIN and drained. Both legacy writers' Arnaud-only
  DML/RPC access and native runtime writes were fenced. The existing
  `pause-journal.sql` alone is insufficient because it fences only `service_role`.
  Current cutover sources are `deploy/cms/freeze-native-cutover.sql` and
  `deploy/cms/activate-native-runtime.sql`; capture ACLs before using either.
- The reviewed reset manifest digest was
  `489261ea7fbbafa01cf5b658acbce721f5ad0a9bdfa81c0946d883a3db4cfa95`.
  Reset committed all targeted rows transactionally, then identity-checked cleanup
  removed six `blog/` objects (five staging, one published). No outstanding legacy
  multipart uploads remained. Neither `uploads/` nor `journal-native/` was targeted.
- `20261102_200000_native_journal` ran as `arnaud_cms_owner` through the existing
  private migrator login and was recorded in native migration batch 2. No build
  ran a migration. Imported history was dropped only after the reset emptied it.
- Only `arnaud_cms_runtime` received a new password. PostgreSQL and the dedicated
  gateway use the identical SCRAM verifier; only that gateway application restarted.
  Only the production CMS database URL changed in Vercel. New-credential verified-TLS
  queries passed; the old credential failed authentication (PgBouncer SQLSTATE 08P01).
  Runtime was re-enabled with native grants only. Legacy runtime/service-role writes
  remain denied, as do runtime photograph mutations and shared Auth reads.
- Only `arnaudbelec-staging` CORS changed: the existing exact-origin rule now also
  permits `If-None-Match` and `Range`. The published bucket and shared Worker were
  unchanged. The four-hour cleanup token was bucket-scoped, deleted after cleanup,
  and verified absent through management API 404 and S3 Unauthorized (401).
- Promotion to the canonical domain followed staged anonymous access checks.
  Native post/draft queries return an empty published-only result, versions return
  403, unauthenticated me returns 401, and retired writing/recovery routes deny use.
  The live browser renders the sign-in form. No runtime errors were reported in
  the checked post-promotion window; this is not a guarantee about later traffic.
- Final database read-back found zero old or native posts, versions and media.
  Full-row hashes for all eight photographs, eight analyses, 56 palette colours and
  photograph upload reservations matched the pre-cutover snapshot. CMS identity
  rows and all shared Auth identity IDs matched too. R2 retained exactly the eight
  unchanged photograph object identities, with both legacy journal namespaces empty.
- A transient shared catalogue API 500 occurred during verification; a local
  service JWT also did not match the running shared signing configuration. The
  owner recalled possible API-key work in another session. No shared credentials,
  API configuration, HBA rules or shared-service restarts were changed here. The
  catalogue subsequently returned all eight rows again without a repair by this
  task; final browser read-back showed all eight photographs and nine decoded
  image elements. Do not attribute the transient failure to a verified cause.

Private operational receipts and the exact released-source archive are retained
under ignored `.local/native-cutover-20261103/`. Production credentials remain
private; the prior runtime credential in historical receipts is no longer valid.
Historical local exports/backups and normal shared backup/WAL retention were not
purged. Empty legacy tables/RPCs remain fenced pending separate retirement approval.
No production acceptance content or Auth session was created during that initial
cutover. The subsequently approved live acceptance is recorded separately below.

## Live production acceptance and cleanup — 2026-11-03

The owner separately approved a temporary session for the existing Arnaud admin,
synthetic uploads including the 100 MiB boundary, brief publication of
**“CMS acceptance test — temporary”**, unpublication and removal of only those
fixtures. One real user draft and one real Media item already existed at the
acceptance baseline; neither was a test fixture. No password, account, allowlist,
shared-service configuration or application deployment changed for these tests.

Verified against the deployed native release:

- A real browser uploaded PNG through native Media without a manual parent-post
  Save. Selecting the media subsequently autosaved its parent reference.
- Real MP4/WAV and a **104857600-byte WAV** used native Vercel signing, direct R2
  PUT and Payload creation. Server SHA-256 and full downloaded-byte hashes matched.
  Signing **104857601 bytes** was denied with 400. This proves the maximum-size
  path for the tested WAV, not exhaustive boundary coverage of every format.
- Unpublished originals denied anonymous access. Authorized reads returned
  private/no-store 60-second redirects; HTTP 206 ranges and exact-origin CORS
  passed. All four actual download capabilities later expired with denial while
  a fresh authorized read still worked, before any original was deleted.
- Immutable PUT retry returned 412, receipt replay returned 400, forged
  verification/storage metadata could not relabel the original, and a cross-origin
  cookie signing request returned 403.
- Native Publish rendered public image/video/audio, including actual video/audio
  playback. Private browser autosave and restore-as-draft did not replace live
  content. Stock Unpublish withdrew the post and new anonymous media capabilities;
  subsequent Publish kept the form revision usable and first-publication date
  stable. The unreferenced maximum-size original remained private throughout.
- Desktop/mobile editor checks at 1280px/390px reported no client runtime errors.
  The initial restore test had assumed a wrapped REST response; installed 3.92.1
  returns the document directly. The harness was corrected and the lifecycle
  rerun passed; no application fix or redeployment was required.
- Secure HttpOnly host-cookie refresh passed. Native logout revoked only the
  temporary session, cleared its cookies and preserved other sessions. All test
  browser contexts were closed and the test post was finally unpublished (404).

Cleanup used the original reviewed plan digest
`2b2c2b20c70b2aa4cdf9ecc0a2493cac98da9f43b9cc773018e807ef5051e936`,
not the old all-journal reset. It bound exact IDs/full-row hashes, filenames,
upload identities, object sizes, SHA-256 and ETags. Guards rejected non-test and
orphan-version media references and mixed-document/global locks. The first apply
was refused before deletion because the diagnostic `postgres` role lacked row-lock
and deletion privileges. Rollback-only validation then passed through the existing
Arnaud migrator/owner maintenance identity, without changing grants or weakening
guards. The original row snapshot still matched; the plan was not regenerated.

The successful transaction removed exactly **one test post, 13 versions and four
Media rows**. Conditional, identity-reverified deletion removed exactly **four
`journal-native/<upload UUID>/<filename>` originals** from private staging. Read-back
confirmed their absence, the existing user's draft/media row hashes and non-test
object identity unchanged, and all photograph/analysis/palette/reservation rows,
CMS identities and shared Auth identity IDs preserved. Later real editorial edits
were observed and left untouched: an empty journal is not the cleanup criterion.
Final public smoke checks passed for photography, login/journal routes, anonymous
published-only reads, private-version denial and retired-route denial; all eight
photograph originals returned 200 and the temporary post remained 404.

The staging-only acceptance cleanup token was revoked and verified absent through
management API 404 and S3 denial (401). This run's generated session, R2 credential
and signed-capability files were then removed. Non-secret evidence, the exact plan,
committed cleanup journal, before/after preservation hashes and revocation receipts
remain under ignored `.local/native-live-acceptance-20261103/`. Do not blindly rerun
its one-shot cleanup after commit or use it for user content. Empty legacy-table
retirement and historical local-export/backup purging were not authorized or run.

## Admin appearance — source update, 2026-11-04

The native admin uses black/white/neutral-grey surfaces and square controls,
following the Dexter/Elliot admin direction rather than the public journal's tan
palette. Payload's native **Automatic / Light / Dark** account setting is enabled.
Automatic is the default and tracks OS changes while open; manual choices persist
in the native `payload-theme` cookie. No second theme context or preference store
is introduced. As in native Payload, without a saved cookie the server uses its
fallback theme until the browser resolves Automatic during mounting.
A small native theme adapter also initialises signed-out screens because
Payload 3.92.1 strips `admin.theme` from its unauthenticated client configuration
and lacks an OS-change
listener. Its supported runtime `setTheme("auto")` is missing from that version's
public TypeScript union; the narrow annotated call is intentional.

The overrides live in `components/cms/cms.css` under the CMS root class and cover
login/logout, native views/drawers/dialogs and embedded photograph controls. Public
photography, `/blog`, the article-preview canvas, the CMS-disabled photography
admin and all authentication/publication/upload behavior remain unchanged.

For local verification, start `npx tsx scripts/cms/post-lifecycle-fixture.ts`, then
run `node scripts/cms/verify-theme-browser.mjs` (set `PLAYWRIGHT_MODULE` if needed).
`CMS_THEME_EVIDENCE` optionally saves captures/results in an ignored directory.
The verifier only accepts the loopback memory-only fixture and blocks external
browser requests. It checks both viewport sizes, live OS changes, remembered native
overrides, keyboard focus, editor/media/photograph views and unchanged previews.
Like the lifecycle fixture, its local PATCH requests bypass the second-connection
document-lock read that PGlite cannot emulate; real native locking is not inferred
from these visual checks. The theme change needs an application release to appear
in production; the earlier production acceptance above does not verify new CSS.

Local verification passed on 2026-11-04: lint, typecheck, all 58 CMS/blog/admin/
storage/palette tests, CMS-enabled and CMS-disabled production builds, all 12
disabled-route checks and the real-browser theme verifier at 1280px/390px. Browser
checks covered both themes, input/placeholder contrast, focus, native override
persistence, live OS changes and unchanged public/private-preview styling, with
no page/runtime/hydration errors. The temporary local fixture was stopped; no
production account, content, infrastructure or deployment changed for this work.

## One native content model

- `arnaud_cms.posts` and native versions are the only authoring/publication authority.
- Body is a native `richText` field using `@payloadcms/richtext-lexical`, not a JSON
  field containing BlockNote. There is no old-content converter because the owner
  selected a clean reset.
- Public loaders use native `draft:false`, published-status constraints and
  `overrideAccess:false`, without inheriting an admin identity. Anonymous draft
  queries are normalized to main-document reads; versions remain admin-only.
- Native restore requests are normalized to `draft=true` **before** Payload REST
  starts. Installed 3.92.1 captures this argument before hooks and its Local API
  wrapper drops the flag, so unsafe Local API restores are rejected. A restore
  creates a private version without replacing the current published document.
- Native form saves carry `editRevision`. A row lock and explicitly decoded numeric
  counter reject stale form replacements, including same-account tabs. Native
  Unpublish is an explicit status-only command against latest saved state; Restore
  explicitly selects history. Neither pretends to carry the browser form token.
  Status-only Unpublish preserves the content revision because it does not replace
  working content; autosave, Publish and Restore advance it. Concurrent status
  commands follow native latest-state semantics, not a claimed stale-command token.
- `NativeUnpublish` wraps the stock action and disables it while writing is unsaved
  or autosaving. Keeping the content token stable for status-only Unpublish lets
  stock 3.92.1 reset from its saved props without making the next edit stale. It
  does not introduce a separate PATCH writer or racing form resets.
- First-publication date and the subsequently immutable slug come from the main
  native row, never a client timestamp or an older restored version.
- The hidden, server-derived native `mediaReferences` relationship is saved in
  each document/version. Only references on currently published **main** documents
  authorize anonymous media. No duplicate public snapshot or media-visibility store.

Supabase continues to own identity and the Arnaud UUID allowlist. The existing
restricted PostgreSQL role, verified TLS gateway and connection budgets remain.
No shared administrator permissions or independent Payload password login is added.

## Private native media

`@payloadcms/storage-s3@3.92.1` connects to R2 from Vercel. The Workers-only R2
adapter is not used. Native uploads are independent Media records, so selecting or
uploading media does not require manually saving its parent post.

**Changed journal semantics:** native originals remain in private
`arnaudbelec-staging/journal-native/...`, even when published. The published R2
bucket and shared Worker are not involved. No file copy/hash/download occurs during
post publication. Photography's `arnaudbelec/uploads/...` and provider are unchanged.
Do not add an age-based lifecycle rule to this namespace or the whole staging bucket:
it now includes retained published originals, drafts and unused recoverable uploads.

1. Native S3 signing verifies the CMS identity and produces a non-overwriting,
   short-lived direct-upload capability and a user/collection-bound receipt.
2. The browser PUT bypasses Vercel's body limit. Supported files are JPG, PNG, WebP,
   MP4, WebM, MP3, Ogg and WAV, up to 100 MiB. Native single-PUT retry is not the old
   multipart-resume protocol; an interrupted transfer may restart the whole file.
3. Payload verifies the receipt and materializes the actual R2 bytes to a temporary
   file **before** opening its create transaction. The Media hook streams that local
   file for SHA-256, strict detected MIME/extension and actual-size checks. It does
   not hash an empty `req.file.data` buffer or download R2 again inside the hook.
4. Native Media metadata and unique receipt-derived upload identity are persisted.
   The server ignores forged verification/storage/byte-derived metadata. Metadata
   edits are limited to descriptions/captions. Upload original-byte replacement,
   cropping, transformations, duplication and deletion are disabled. A replacement
   means a new Media item; failures retain originals for reconciliation.
5. Native file reads apply collection access first, then issue 60-second signed R2
   redirects. Redirects are `private, no-store`. Expiring URLs are never stored in
   documents. Unpublish blocks new anonymous redirects; previously issued bearer
   URLs can remain valid until expiry. This is not retroactive byte revocation or
   a promise about files already downloaded/cached by a reader.

The checksum is authoritative server read-back hashing, not comparison against a
browser-computed expected SHA. A replayed receipt cannot create a second row sharing
one original; after a lost success response, check the Media library before retrying.
No automatic orphan cleanup is scheduled. Any later cleanup must account for draft,
published and retained-version references and still-valid upload receipts.

Keep `ARNAUD_BLOG_UPLOADS_ENABLED` off on new installations until acceptance.
With storage credentials configured, this flag blocks new upload capabilities
without disabling existing public/private file reads or receipt enforcement.
`deploy/r2/staging-cors.json` requires the exact site origin with PUT/GET/HEAD and
Content-Type, If-None-Match and Range headers. This exact-origin change was applied
and read back during the cutover. Buckets remain private; do not enable r2.dev or
public domains.

## Controlled reset and cutover

**Do not deploy this source against the old populated schema.** Build does not run
migrations. The new migration refuses incompatible content rather than interpreting
BlockNote arrays as Lexical JSON. Existing migrations are retained, not rewritten.
The sequence below documents the completed one-time transition; the reset tooling
expects the old schema and is not a general native-journal reset command.

1. Review the release, temporarily freeze all journal mutations and fence older
   Vercel deployment write paths as well as stale editor tabs. Preserve photography
   and shared Auth. Agree whether a temporary recovery export is retained and its
   explicit deletion/expiry gate; no permanent recovery copy is silently promised.
   Capture exact ACLs, then use `freeze-native-cutover.sql`: runtime NOLOGIN/drain
   plus effective privilege checks across both stores. Rotate only Arnaud's runtime
   password and the dedicated gateway's identical SCRAM verifier, stage the new URL
   only for the new deployment, and restart that gateway to drain old clients.
   Before `activate-native-runtime.sql`, verify the native migration and gateway
   restart; afterward verify new-credential access and old-credential denial.
   Never restore legacy mutation grants or give stale releases the new URL.
2. Supply operator-only credentials through the shell, never command arguments or
   source: `ARNAUD_JOURNAL_RESET_DATABASE_URL` (maintenance privileges, not the runtime
   role), `ARNAUD_JOURNAL_RESET_R2_ENDPOINT`,
   `ARNAUD_JOURNAL_RESET_R2_ACCESS_KEY_ID`,
   `ARNAUD_JOURNAL_RESET_R2_SECRET_ACCESS_KEY`. The tool never loads `.env` or discovers
   credentials. Use the existing private maintenance path, not a new public port.
3. In an already-created private ignored directory, run:

   ```sh
   npm run cms:reset-journal -- plan --output .local/native-reset/manifest.json
   ```

   This is read-only against DB/R2. It binds full-row hashes, exact IDs, all native
   and imported histories (including orphan versions), registry media, paginated
   `blog/` originals in both fixed site buckets, and multipart uploads. It never
   reports document bodies. Review the manifest and exact digest before approval.
4. With separately confirmed execution, keep the external freeze active, set
   `ARNAUD_JOURNAL_RESET_WRITES_FROZEN=yes`, and run:

   ```sh
   npm run cms:reset-journal -- reset --manifest .local/native-reset/manifest.json --confirm APPROVED_DIGEST
   npm run cms:reset-journal -- clean-media --manifest .local/native-reset/manifest.json --confirm APPROVED_DIGEST
   ```

   Reset locks/rechecks the complete DB snapshot and deletes only manifest-bound
   rows transactionally, explicitly removing versions before posts. Cleanup requires
   a durable committed receipt, rechecks target absence and exact storage identities,
   aborts matching uploads, conditionally deletes only legacy `blog/<uuid>.<ext>`
   objects, and verifies absence. It never targets `uploads/`, `journal-native/`,
   buckets, identities or other sites. Retry uses the retained manifest/journal;
   changed identities fail closed. A crash between DB commit and committed receipt
   requires manual reconciliation; do not forge a receipt to force cleanup.
5. Apply `20261102_200000_native_journal` through the private CMS migrator. It asserts
   the complete old content reset, removes imported-history/legacy fields, and adds
   native Media/reference/revision schema. Preserve the gateway and all CMS roles.
6. Deploy the reviewed app/config and apply reviewed CORS. Accept native lifecycle,
   access/privacy, real image/video/audio upload and range playback, size boundaries,
   retries and native PostgreSQL document-lock/concurrent-writer behavior. Actual
   publication of the acceptance post requires its explicit approval.
7. Only after replacement acceptance, apply operator-only forward migration
   `deploy/cms/migrations/20261102201000_retire_arnaud_blog.sql`. It is intentionally
   separate from ordinary Supabase bootstrap migrations because it depends on
   Payload's schema and explicit retirement approval. It refuses nonempty
   legacy tables or missing native schema, then drops exactly the five old journal
   tables and three RPCs without CASCADE. It does not delete native content.
8. Complete the approved targeted purge/expiry of local exports/backups and retained
   test receipts containing content. Never recursively delete `.local` (it also
   contains credentials and unrelated evidence). Native admin clears only the old
   journal local/session-storage keys when each device reconnects. Shared backups
   and WAL may retain historical data until their normal expiry; do not destroy
   shared recovery systems to claim immediate forensic erasure.

Disabling CMS now leaves photography admin available but **does not restore the old
journal writer**. Retired journal APIs return 410 and old UUID media URLs return
404. Old import/recovery/editor code has been removed. After the reset, reverting
an old Vercel deployment does not recover discarded content and may be incompatible
with native schema; use an explicitly reviewed application/data recovery plan.

## Local verification

`npm run lint`, `npm run typecheck`, `npm run test:cms`, `npm run test:blog`, relevant
photography tests, and enabled/disabled production builds are the checks for this
change. Regenerate types/import maps explicitly after collection configuration changes.

Verified locally on 2026-11-03:

- Lint, typecheck and `git diff --check` passed.
- All 56 tests passed: CMS 19, blog 3, admin 12, storage 15 and palette 7.
- Production builds passed with CMS enabled and disabled, using an unreachable
  synthetic database URL, empty Supabase/R2 credentials and uploads disabled.
  Neither build invoked a migration or used production services.
- `npm run test:cms:disabled` passed all 12 route checks without database
  initialization. Unconfigured `/admin` and `/admin/posts` render only the shared
  auth/setup shell, not an editor; native CMS routes return 404 and the retired
  journal API returns 410.
- Browser lifecycle passed at 1280px and 390px, including native media selection
  before a manual parent Save, private autosave, Unpublish and subsequent Publish.
  Final captures wait for the returned revision and native Published status.
  Ignored evidence is in `.local/cms-native-lifecycle/`.
- Focused independent review of native post/media/restore hooks found no further
  actionable bugs after the metadata-forgery and Unpublish-token corrections.

The subsequent cutover's real native PostgreSQL rehearsal accepted document-lock
and concurrent-writer behavior. Separately approved real signed-in R2 transfers,
Vercel's maximum-size WAV path, signed/range playback and live publication also
passed, as recorded above. Those production results are separate evidence, not
claims inferred from these earlier local-only tests.

CMS integration uses real Payload HTTP receipt verification, pre-transaction byte
materialization and native database rows, with the R2 response mocked. It verifies
positive media publication, private drafts, stale forms, metadata forgery rejection,
restore-as-draft, stock status-only unpublish, shared-media withdrawal and rollback.
Reset/retirement tests use isolated Postgres-compatible PGlite and storage fakes.
The local 100 MiB streaming test alone is not a real Vercel/R2 maximum-size claim;
the separate production acceptance above exercised that path with a real WAV.

For browser lifecycle checks, start `npx tsx scripts/cms/post-lifecycle-fixture.ts`,
then `node scripts/cms/verify-post-lifecycle-browser.mjs` (set `PLAYWRIGHT_MODULE`
to a local Playwright installation if necessary). The fixture overrides real
credentials and uses memory-only local DB/synthetic Auth, with uploads disabled.
It checks native Lexical, media selection without a manual parent Save, public vs
private content, Unpublish and subsequent Publish on desktop/mobile. PGlite cannot
emulate native document-lock reads on a second connection inside a transaction;
the browser fixture explicitly sends `overrideLock=true` while retaining revision
checks. This fixture does not prove native lock concurrency; the separate real
PostgreSQL cutover rehearsal does. Real R2 transfer was verified separately in the
production acceptance above, not by this fixture.
Restart the fixture after collection/config changes; do not depend on HMR pools.
