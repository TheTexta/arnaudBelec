# Payload + BlockNote: implementation and cutover

> **Historical rollout record, not the current implementation guide.** The native
> Lexical/Media replacement is implemented locally; see
> [native-payload-journal.md](native-payload-journal.md). It has not been deployed,
> and the complete journal reset/native migration/legacy retirement have not run
> against production. BlockNote, import and legacy recovery commands below describe
> the old release only; do not rerun them or use its rollback instructions after
> the separately approved reset. Existing private receipts remain historical evidence.

## Status and scope

**Production CMS activated on 2026-11-02** at `/cms`, using reviewed runtime commit
`24ca88f` (following `2ba6a67`) with production-only configuration. Deployment:
`dpl_9iC5rcVkae5CbkE2W6LQLccaLdz5`, canonical site
`https://arnaud-belec.vercel.app`. Unrelated photograph working-tree edits were
excluded; application runtime source was not redesigned for cutover.
The later upload callback correction was deployed as
`dpl_AgCosETdDYaox6J2nKJtjFcrVcSG`. The current initial-draft/publication-feedback
release is `dpl_J9SVWJQ25d3P5JHbZdiZs1VsMYH6`; both scopes are recorded below.

The owner approved migration and **Option 1**: Vercel website/CMS plus a restricted
TLS gateway to existing Coolify PostgreSQL. They later explicitly continued with
an Arnaud-only backup/restore instead of requiring a complete shared-Supabase
restore rehearsal. The scoped native restore passed; full shared disaster recovery
remains unverified, not a blocker silently reintroduced here.

Two drafts, 11 exact legacy revisions and three private media records were
preserved. Nothing was published/deleted. `/admin` now routes to native `/cms`;
`ARNAUD_CMS_ENABLED=false` and the previous guarded deployment remain rollback.
Existing Supabase identity/allowlist, photograph tools/provider and R2 credentials
are unchanged. Final real signed-in CMS/media acceptance remains a human check;
anonymous/security and database checks passed.

- Payload 3.92.1, Next 16.4.3, React 19.3, BlockNote 0.57.
- Node `.nvmrc` is 24.22.1; supported range `^22.23.4 || >=24.22.1`.
- Website and CMS have separate root route groups. Photograph components/styles
  are not redesigned. Navigation between root layouts reloads the document.
- The native JSON field stores validated BlockNote **arrays**, never Lexical or
  serialized JSON strings. Programmatic restores synchronize the mounted editor.
- Native drafts/autosave/versions plus immutable imported legacy history. Imported
  revisions retain source post UUID, revision number, raw snapshot, actor and exact
  source timestamp (`sourceTimestamp`, including sub-millisecond precision).
- Saved posts retain per-user browser recovery copies of unsent writing, using
  the legacy recovery key/shape. Native administration offers recovery of an
  existing pre-cutover browser copy; recovery never publishes automatically.
- Legacy-history recovery and native version restore create private drafts, never
  implicitly republish. A previously published slug remains fixed on recovery.
- Deletion and bulk editing are disabled. The custom Unpublish action includes the
  current recovery version; stock Payload bulk writes omit this concurrency token.

## Authentication and privacy

Supabase alone verifies credentials; no Payload passwords, API keys, registration,
first-user bootstrap, password resets or GraphQL endpoint are exposed. A minimal
`cms-users` identity map uses the existing Supabase UUID. Mapping is provisioned
only after server verification and site allowlist membership, not by email match.

Login, `/me`, refresh, logout and inactivity are bridged to Supabase. Native fetches
use HttpOnly, SameSite=Strict cookies; production uses Secure `__Host-` cookies.
Responses return only safe identity and finite expiry, never access/refresh tokens.
Cookie-authenticated mutations and server functions require the exact configured
origin. Invalid explicit Bearer headers never fall back to cookies. Every request
rechecks `SUPABASE_ADMIN_USER_IDS`; mapping alone does not grant access. Protected
custom views authorize the server principal explicitly. Local API calls made for
users use `overrideAccess: false`.

Existing photograph APIs also accept the verified CMS cookie with exact-origin
write protection. Their bearer behavior, storage provider and upload tickets stay
compatible. The native Photographs view reuses the existing tools without another
login or exposing a Supabase token to the browser.

## Storage and transaction contract

`ARNAUD_CMS_DATABASE_URL` **must reach the same database** as
`public.arnaud_blog_*`. Payload owns only the isolated `arnaud_cms` schema. It is
not another Supabase Auth deployment and is not a shared authorization migration.

The post hook requires Payload's active transaction; it never falls back to a
separate connection. It row-locks the legacy post, checks the form's recovery
version, calls the existing save/publication RPCs, and writes the native document
and versions in that transaction. This retains legacy media FKs, UUID URLs,
revisions and rollback readability. Stock advisory document locking is disabled;
the database-backed optimistic version remains authoritative.

Publishing reuses checksum-verified private R2 promotion, checks media ownership
and types, then atomically commits publication and active media references with
the CMS record. A failed transaction may leave a recovery copy in R2; it never
deletes originals or creates public authorization. Public readers/media continue
using the existing publication tables and anonymous RLS, not Payload `_status`.
Draft saves and restores never withdraw/change a currently live snapshot.

## Isolated local setup

Use Node 24.22.1 (`nvm use`, or `npm exec --yes --package=node@24.22.1 -- <command>`).

1. `npm run cms:db` starts loopback-only PGlite Postgres at `127.0.0.1:55439`, with
   private persistent state under ignored `.local/cms-postgres`. It seeds only the
   legacy **schema**, not production content. It ignores all connection secrets.
2. In another terminal set `ARNAUD_CMS_DATABASE_URL` to
   `postgresql://postgres:postgres@127.0.0.1:55439/postgres` and run
   `npm run cms -- migrate`. This target is local only.
3. `scripts/cms/local-auth-fixture.ts` is a separate loopback-only synthetic auth
   provider on port 55440 for browser acceptance. Never run it in a deployment.
   Its synthetic account is `fixture@example.test` / `local-fixture-only`, UUID
   `32345678-1234-4234-8234-123456789abc`. Set both Supabase URL variables to
   `http://127.0.0.1:55440`, both anon/service key variables to `local-fixture-only`,
   and the admin allowlist to that fixture UUID. This provider implements auth
   only: photograph uploads/private R2 signing still need their real integrations.
4. Set `ARNAUD_CMS_ENABLED=true`, a local-only secret of at least 32 characters,
   `ARNAUD_CMS_ORIGIN=http://localhost:3105`, and `DISABLE_PAYLOAD_HMR=true`; start
   `npm run dev -- --port 3105`. Restart after config edits. This avoids retaining
   adapter pools across Payload config reloads in the lightweight socket fixture.
   Explicitly set `ARNAUD_BLOG_UPLOADS_ENABLED=false`,
   `ARNAUD_UPLOAD_STORAGE=supabase`, and empty `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in this fixture shell so Next does
   not inherit real storage credentials from `.env.local`.
5. Open `/cms`. Do not combine a fixture database with production storage/API
   credentials. No fixture sign-in bypass exists in the application.

`npm run test:cms` uses in-memory databases on random loopback ports, restricted
runtime roles and synthetic auth responses. It does not load production data.
PGlite ignores startup role options, so tests explicitly SET ROLE and assert
`current_user` before testing runtime operations. It is not proof of production
TLS/password connectivity or multi-connection behavior on native PostgreSQL.

Regenerate checked-in artifacts after config changes:

```sh
npm run cms -- generate:types
npm run cms -- generate:importmap
```

Automatic type generation is disabled; schema pushing and automatic database
creation are always disabled. Migrations are explicit, never build/start hooks.
After a disabled production build, run `npm run test:cms:disabled`. It starts a
loopback-only server with an intentionally unreachable local database address,
checks legacy admin and disabled CMS routes (including metadata/version routes),
and rejects any database initialization in server output. Both the page and its
metadata generation are gated before invoking Payload, not just the root layout.

## Import and verification

`npm run cms:import` is a **report-only** transaction: it validates the legacy
documents and returns counts plus a SHA-256 over posts, publications, revisions
and media metadata. It requires an explicit connection string. No credentials,
post text, signed URLs or media bytes are printed. Use `DISABLE_PAYLOAD_HMR=true`
outside Next (included by the script).

`npm run cms:import -- --apply` is an explicitly mutating import. Only run against
an approved target with journal writes frozen. It uses one repeatable-read
transaction, requires empty CMS posts/history, imports published snapshots then
current drafts with unchanged UUIDs, and verifies counts before commit. Original
public tables, media registry, R2 objects and legacy revisions are not modified.
Repeat application to a nonempty target is refused rather than overwriting work.

Native Payload history begins at import; older revisions are in the read-only
Legacy Revisions collection, with **Recover as private draft**. Original legacy
history remains available after rollback. Do not silently renumber it into native
version IDs. Compare report hashes before/after import and verify each public URL,
published date/body, UUID media URL, current draft and exact historical snapshot.

`tsx scripts/cms/verify-import.ts` independently reads back complete drafts,
historical snapshots/authors/exact timestamps and publication bodies, with full
media/publication-media metadata in its digest. Use it during the frozen initial
import, not as a requirement that immutable imported history grow with later native
edits. Its output contains counts/hash only; errors never print private documents.

## Cutover procedure and verification requirements

Source deployment with Payload disabled, CMS migration and Option 1 were approved
in that order. The steps below were completed on 2026-11-02; they remain the
requirements for future reviewed cutovers, not instructions to rerun role creation
or overwrite the now-nonempty import target. Both shared-extension audits passed
against **three real CMS roles**, not just synthetic or absent identities.

1. **Connectivity gate:** Payload needs a native Postgres connection from its
   server runtime. Current public Supabase HTTP API access is not sufficient.
   The verified endpoint is runtime-only PgBouncer behind exact-host STARTTLS on
   existing proxy port 443; PostgreSQL stays unpublished. See
   `deploy/cms/gateway/README.md` for pinned source/config and acceptance. Do not change
   Tailscale, expose 5432/6543, or add router/firewall/public-port changes as a
   workaround. Confirm the dedicated hostname and test verified TLS before use.
2. **Back up/freeze:** capture a recoverable Arnaud journal backup and baseline
   counts/full-row hashes; temporarily stop journal edits during final import.
   `scripts/cms/backup-native.py --confirm-production-read --output <new-private-dir>`
   backs up and restores the five journal tables against the authoritative schema
   on network-isolated native PostgreSQL, requiring full-row equivalence. The owner
   explicitly waived a complete shared-Supabase restore rehearsal for this cutover.
   `deploy/cms/pause-journal.sql` briefly removes only the legacy journal writer's
   mutations; capture exact service-role ACLs and prepare their resume first.
   Photographs/media remain untouched. Do not use this cutover to retire sources
   or rotate shared credentials.
3. **Roles:** database owner applies `deploy/cms/roles.sql` once. It creates only
   `arnaud_cms_owner`, `arnaud_cms_migrator`, `arnaud_cms_runtime`, the isolated
   schema, Arnaud-only legacy grants/RLS policies and default privileges for both
   migration identities. No service-role membership, BYPASSRLS, shared Auth,
   photograph-table or other-project grants. Set unique passwords via the secure
   operator channel, never in SQL/source/logs.
4. **Schema:** with the migrator connection, run the two checked-in Payload
   migrations in order (`20261031_200002_payload_journal`,
   `20261031_202034_history_precision`). The schema is already provisioned by the
   role script; the migrator needs no database-level CREATE permission. Prefer
   `SET ROLE arnaud_cms_owner` for ownership. Default privileges also cover objects
   created directly by the migrator. Set the owner role through connection startup
   `options=-c role=arnaud_cms_owner` for every migrator pool client; a separate psql
   SET ROLE cannot affect the CLI's connections. Verify runtime CRUD and denial.
5. **Import:** report, inspect counts/hash, apply into the empty target, re-report,
   verify all invariants above. No R2 object copy, cleanup or deletion occurs.
6. **Vercel configuration:** use supported Node 24.x. Add server-only
   `ARNAUD_CMS_DATABASE_URL` (runtime role, verified TLS), random `PAYLOAD_SECRET`
   (32+ characters), and exact `ARNAUD_CMS_ORIGIN=https://arnaud-belec.vercel.app`.
   Set `ARNAUD_CMS_ENABLED=true` only for the approved release/environment.
   Preserve all existing Supabase/R2 variables, allowlist and photo storage flag.
   Preview deployments need isolated data and their own exact origin; never give
   arbitrary previews production mutation access.
7. **Deploy/accept:** deploy the reviewed source snapshot only, preserving/excluding
   unrelated user photograph edits as agreed. Verify login/me/refresh/logout/
   inactivity, direct anonymous custom-view/API/version denial, cross-origin denial,
   edit/autosave/reload/restore/conflict, private preview, real scoped R2
   image/video/audio upload and checksum, publish/media/unpublish withdrawal, and
   unchanged photographs. Keep clearly labeled acceptance content private unless
   publication of that exact fixture is separately approved.

Database pool maximum is three per application instance; Payload 3.92.1 reserves
one startup client. The gateway caps ordinary backend sessions at six and clients
at 30 across the single instance. Native concurrent-writer conflict/rollback and
public verified-TLS/prepared-query tests passed; they are not PGlite conclusions.

### Option 1 preflight and shared-permission repairs

Read-only inspection after the owner's selection established:

- Tailscale/SSH reaches the healthy existing PostgreSQL and Supavisor containers.
  Neither publishes a host database port. The host is behind a LAN router.
- Existing Coolify Traefik is 3.7.16, already publishes port 443 and supports
  PostgreSQL STARTTLS with exact `HostSNI` routing and automatic certificates.
  Existing API-host TLS chain/hostname validation passed. This is **not** proof
  of a working CMS database endpoint. No existing Docker-label TCP router was
  found; shared HTTPS compatibility still requires regression checks.
- The dedicated PgBouncer now uses that existing ingress without another router
  port, at `arnaud-cms-db.dextery.dev` (DNS-only CNAME to existing API origin).
  Only the runtime login is accepted publicly; migration access stays over
  Tailscale. Require real node-pg certificate/hostname verification (`verify-full`),
  including negative TLS/plaintext, SNI, username and database-routing tests.
- PostgreSQL has a 100-connection limit; 69 connections were observed across the
  cluster. Start with at most **six aggregate runtime backend connections**,
  accounting for reserve pools and direct/migration clients; do not increase the
  shared server limit. Native and gateway transaction/prepared-query checks passed.
- Before cutover no `arnaud_cms` schema or roles existed. Baseline: two posts,
  11 revisions, three media records and zero publications. No content was read,
  published or deleted during inspection. Recheck counts/hash at cutover.
- Complete shared-Supabase recovery remains unverified; its generic restore hit
  extension-bootstrap dependencies. The owner explicitly continued with a scoped
  Arnaud journal backup/restore instead, which passed full-row native equivalence.
  Do not stop/recreate shared Supabase or equate its volume with a verified backup.

**Separately approved repair: inherited shared privileges.** Catalog inspection
found `PUBLIC USAGE` on schema `net` and `PUBLIC` table privileges (including
SELECT, writes and TRUNCATE) on `net.http_request_queue` and `net._http_response`.
Both are pg_net extension tables, owned by `supabase_admin`, with RLS disabled.
Before the repair, every new CMS identity would inherit these permissions even with the explicit
Arnaud-only grants in `deploy/cms/roles.sql`. PostgreSQL has no per-role DENY that
subtracts `PUBLIC` access. This was an effective-isolation blocker, not evidence
of exploitation or of those tables' contents.

Independent read-only security review agreed that gateway activation must wait.
The owner subsequently approved a targeted hardening operation owned by
`dextery-infrastructure`: inventory role/
function/default-ACL dependencies, preserve verified existing Supabase/project
access with explicit grants, remove the proven inherited exposure, test all CMS
identities and existing consumers, and retain a reversible grant record. Merely
restricting the PgBouncer username or granting only Arnaud tables is insufficient.
This approval covers only the targeted shared pg_net permission fix and its
backup/tests, not unrelated grant changes or shared membership rollout. Its
manual SQL, isolated tests and execution record are owned by
`../dextery-infrastructure/postgres/pg-net/README.md`. Native permission-snapshot
recovery, old-role preservation, new-role denial and rollback tests passed on
2026-11-01. Complete content restore is still blocked by Supabase extension-
bootstrap dependencies; the retained full dump is **not** restore-verified.
On 2026-11-02 the owner explicitly accepted the narrower, verified permission-
recovery gate and approved applying only the permission fix. The exact tested
`harden.sql` committed successfully; an independent post-commit audit confirmed
zero PUBLIC pg_net ACL entries and preserved access for all 29 existing roles.
Snapshots confirmed unrelated/default grants, database ownership, memberships and
net routine definitions unchanged. Shared services and public-project smoke checks
passed; at that permission-only checkpoint `/cms` returned 404 and anonymous admin
session access returned 401.

That permission-only checkpoint did not activate CMS. The owner subsequently
continued the migration without the full shared-restore gate. Actual role auditing
then found eight PUBLIC-executable pgsodium SECURITY DEFINER functions; the owner
explicitly approved the same preserve-existing-access repair. Native tests and
independent review passed before applying only those eight EXECUTE changes.
All 29 old roles retained access; function definitions, memberships, other grants,
keys and extension state were unchanged. No crypto/key function was invoked.
Both infrastructure audits then passed against all three real CMS roles.
See `../dextery-infrastructure/postgres/pgsodium/OPERATIONS.md` for exact source,
native recovery proof, applied hashes and maintenance caveats.

## Production cutover record — 2026-11-02

- Fresh journal-only native restore passed for two posts, 11 revisions, three
  private media records and zero publications/publication-media rows. Full source
  rows SHA-256: `ff086c9a4c03410fcd410dae476c6386a3293d50667a6553f843f981c57c72cd`.
  No Auth credentials, Vault/GraphQL state or unrelated-site data were needed.
- Native PostgreSQL rehearsal passed real owner/migrator login identity, both
  migrations with consistent ownership, restricted-runtime report/apply/readback,
  exact historical timestamps, duplicate-import refusal, concurrent writer
  conflict/rollback, anonymous/DDL denial and fixture-only publish/unpublish.
- Created three independent CMS database roles and owner-owned schema; applied
  both checked-in migrations. No shared service role or Auth identity was created
  or implicitly granted CMS access. Existing photograph tables/provider are intact.
- Built verified PgBouncer 1.26.1; deployed the single pinned Coolify gateway on
  existing 443, without publishing PostgreSQL. All 13 transport/authorization
  groups passed, including wrong password/user/database/console, plaintext,
  hostname/CA/SNI rejection and 24 prepared queries within the backend budget.
- Temporarily paused only legacy journal mutations, capturing its exact ACLs.
  Imported through verified public TLS as runtime, then independently read back
  every draft and legacy revision plus full media metadata. Legacy source rows
  matched the backup before and after import and again after activation. Import
  report hash: `cdb4b2f98246d8d399fad29cb7482211a4b73c502d1ca64a2ad2e31659352534`.
- Added only four production CMS configuration keys in Vercel (URL/secret sensitive,
  exact origin and enabled flag). Other variables, previews and R2 credentials
  were unchanged. Clean runtime source from `24ca88f` passed enabled build, source
  hashes and client-secret scan. No unrelated photograph edits were deployed.
- Deployment `dpl_9iC5rcVkae5CbkE2W6LQLccaLdz5` is READY at the canonical site.
  Exact pre-cutover service-role journal ACLs were restored, lifting the write pause.
  The prior disabled deployment `dpl_GzDY1dwSV2dT362BGxAHkpdcfeTK` remains rollback.
- Browser `/cms` reaches the Supabase sign-in page; anonymous me/drafts/history/
  versions are denied, registration remains unavailable, cross-origin writes are
  denied, and all three private media URLs remain 404 anonymously. Photography
  image decode and public Arnaud/Elliot/bur1alrites/portfolio pages passed. Vercel
  reported no CMS-route runtime errors in the checked post-deploy window.
- No production content was published/deleted and no media was copied or retired.
  Real signed-in session rotation, editing/uploads/private preview via the live
  CMS, and maximum-size media still require human acceptance. Existing legacy
  real-upload evidence is not silently reclassified as new CMS acceptance.

### Retained receipts and backup

Private cutover snapshots, import/readback results, ACL evidence and the released
source archive remain under ignored `.local/cms-migration-20261102/` (directory
0700, sensitive files 0600). They must not be committed or printed. The restart
cleared the original temporary fixture/release directories; those paths are
historical, not durable evidence storage. `activation-source.tar` still matches
the complete recorded release-source hash manifest.

A fresh journal-only backup was therefore restored and verified again on
2026-11-02 into a disposable network-isolated native PostgreSQL instance. Its
dump, full-row snapshots and manifest are retained in
`.local/cms-migration-20261102/journal-backup-final/`. All source rows still matched
the cutover hash above; counts remained two posts, 11 revisions, three media
records and zero publications. The owned fixture was removed without cleanup
errors. No production writes, import, write pause or deployment were repeated.
This is a local five-table journal recovery artifact, not an offsite backup,
native CMS-version archive, media-byte backup or shared-Supabase recovery claim.

## New-post media callback fix — deployed 2026-11-02

A browser regression reproduced media uploads retaining the unsaved post ID after
the initial draft save. BlockNote creates its editor once, so passing replacement
upload/preview callbacks as options did not update that editor. The shared editor
now forwards both callbacks through a current ref without recreating its document
or losing unsaved writing. Attempts before a draft ID exists also report the
save-and-retry instruction in the field's live status rather than only throwing.

`scripts/cms/verify-editor-browser.mjs` exercises the actual editor and file picker
in a loopback-only synthetic page: mount without an ID, write, assign a saved draft
ID, upload an image, resolve/decode it, and verify writing is retained. It passed
at 1280px and 390px; before the fix the upload callback still received no post ID.
It uses the installed esbuild dependency and a local Playwright installation
(`PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs` when needed). It does
not connect to Payload, Supabase or R2 and is not real production-upload acceptance.
Run with `node scripts/cms/verify-editor-browser.mjs` after dependency setup.

The owner explicitly approved deploying the two application-file corrections.
Release `dpl_AgCosETdDYaox6J2nKJtjFcrVcSG` is READY and aliased to
`https://arnaud-belec.vercel.app`. Its reviewed base is the retained `24ca88f`
source archive with only `app/admin/posts/block-editor.tsx` and
`components/cms/BlockNoteField.tsx` replaced. Unrelated photograph edits were
excluded. Source-manifest SHA-256:
`3bbc91140258dbacb6819fb841fe80cf6a8cc7a608208b24c8dab2732cbd397e`.

Lint, typecheck, 10 CMS tests, 23 journal tests, desktop/mobile browser regression,
the local production compilation and Vercel's independent build passed. Live
home/journal/login returned 200; anonymous CMS me returned 401 and posts/history/
versions returned 403. No runtime errors were reported in the checked deployment
window. These checks do not replace a signed-in real R2 upload retry.

This was an application-only correction. No Supabase/R2/database/auth/CORS setting
changed, and no production content was created, published or deleted. The previous
CMS-enabled deployment `dpl_9iC5rcVkae5CbkE2W6LQLccaLdz5` remains the immediate
application rollback. Private source/hash receipts are retained in ignored
`.local/cms-upload-fix-release.json` and `.local/cms-upload-repro/`. No new Git
commit or push was made. This first correction still required an initial manual
save; the follow-up below addresses uploads before that first save.

## Initial-draft and publication feedback follow-up — deployed 2026-11-02

The previous isolated editor regression simulated a saved ID; it did not exercise
Payload's full create screen. Full CMS browser reproduction confirmed that native
autosave only updates existing posts and does not create the first draft. A new
post therefore had no identity for media preparation until a manual save.

The body field now prepares one private draft through Payload's native form
submission when the author opens New post, using both `draft=true` and
`_status=draft`. The editor is enabled only after native creation updates the
identity/edit URL. A guarded initial attempt prevents duplicate submissions;
failure offers an explicit retry instead of repeatedly creating drafts. This
preserves native form state, recovery versions, auth and transactional legacy
synchronization without a second content-creation API or implicit publication.

Custom media transfers now set Payload's upload status, preventing Publish while
bytes are still transferring/verifying, and report completion instead of leaving
the last “Verifying…” message onscreen. Publication content requirements (including
finished media and descriptive photograph captions) return a 400 body validation
error with a visible inline instruction instead of a generic 500. The requirements
and rollback behavior are unchanged; this is not permission to bypass them.

Full local lifecycle regression (two terminals, Node 24.22.1):

```sh
npx tsx scripts/cms/post-lifecycle-fixture.ts
# After the local Next server is ready, in another terminal:
node scripts/cms/verify-post-lifecycle-browser.mjs
```

The fixture owns loopback ports 3107/55440/55443, starts Next with a memory-only
PGlite database and synthetic Auth, and overrides real API/storage credentials.
Stop it with Ctrl+C afterward. The browser check requires local Playwright (set
`PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs` if installed elsewhere),
refuses a non-fixture state endpoint and blocks non-local browser requests. Media
transfer is mocked; native creation/autosave/publication use the real local CMS.
Optional `CMS_LIFECYCLE_EVIDENCE=.local/cms-post-lifecycle-check` retains captures
and a non-secret result receipt outside source control.

Passed at 1280px and 390px: zero manual Save clicks before first upload, one private
draft per create-screen visit, disabled Publish during transfer, completed-upload
feedback, visible missing-caption validation and unchanged saved state after a
rejected publication. Explicit retry after an initial create failure and real
local text publication after autosave also passed. No production content was
created/published/deleted, and no real R2 transfer/promotion was exercised.

The owner explicitly approved deploying the follow-up. Release
`dpl_J9SVWJQ25d3P5JHbZdiZs1VsMYH6` is READY and aliased to the canonical site.
Relative to the preceding deployed source, only `components/cms/BlockNoteField.tsx`
and `lib/cms/posts.ts` changed. Source-manifest SHA-256:
`ab1e9a13fda91262a254c307e463a77a784f3c2277546cfec4b999415b986cc6`.
The prior callback fix remains included; unrelated photograph edits were excluded.

Lint, typecheck, 11 CMS tests, 23 journal tests, full local CMS desktop/mobile
lifecycle regression, production compilation, disabled-CMS runtime checks and
Vercel's build passed. After deployment, home/journal/login returned 200, anonymous
CMS me returned 401 and posts/history/versions returned 403. No errors were
reported in the checked deployment runtime window. All owned local fixture
processes/ports were closed. No database, Supabase, R2, Auth or CORS configuration
changed; no operator production content writes were made.

Private release/hash evidence is retained in `.local/cms-initial-draft-release.json`
and full fixture captures/results in `.local/cms-post-lifecycle-check/`. A live
signed-in R2 upload and media publication still need the author's retry; the
fixture result is not real storage acceptance. Reload existing CMS tabs to receive
the new create flow. Immediate application rollback is the preceding
`dpl_AgCosETdDYaox6J2nKJtjFcrVcSG`; it does not require a schema/ACL reversal.

## Rollback (non-destructive)

Freeze CMS edits, disable `ARNAUD_CMS_ENABLED`, and deploy the verified legacy
release/configuration. New native saves are already in legacy drafts/revisions
and publication tables in the same transactions, so no reverse content copy is
needed. Legacy Auth signs in again; native HttpOnly cookies do not confer access
when the flag is off. Leave `arnaud_cms`, both histories, grants, originals and
all recovery objects intact. Destructive down migrations intentionally throw.

After rollback edits, do **not** re-enable the stale CMS store. Reconcile/import
the changed legacy state with a newly approved plan; the importer refuses a
nonempty target. Neither rollback nor a failed publish authorizes deletion.

## Dependency assessment

DOMPurify is overridden to patched 3.4.17 (Payload's Monaco dependency).
Latest checked audit after installation: 27 findings, 6 low/21 moderate, no high
or critical. Remaining advisories include upstream Payload/deepmerge, Drizzle's
legacy esbuild development tooling and existing ESLint/minimatch tooling. Do not
run `npm audit fix --force`: proposed fixes include incompatible old Payload/
ESLint releases. Reassess before deployment; this is not a clean-audit claim.

## Local verification record (2026-10-31)

- `lint`, `typecheck`, default-off build and an enabled synthetic-CMS production
  build passed on Node 24.22.1.
- Existing checks: 12 admin, 23 blog, 15 storage, 7 palette tests passed.
- `test:cms`: 10 passing tests (including subtests) cover import validation/hash/
  history preservation, restricted-role migration/runtime grants, auth bridge
  expiry/cookies/origin checks, anonymous denial, atomic save/publication rollback,
  optimistic conflicts, native restore and explicit unpublish. Test databases are
  ephemeral and use no production credentials or content.
- Synthetic local browser: sign-in, native create, BlockNote edit/autosave/reload,
  publish then custom unpublish, native version restore and editor synchronization,
  private preview and protected Photographs view passed. Anonymous direct custom
  view redirects to login; anonymous drafts/versions return 403; local Payload
  first-user/password-reset routes return 404.
  Native logout returned to the login view and subsequent `/me` returned 401.
- A legacy-shaped per-user browser recovery copy was offered and restored into
  BlockNote. Autosave committed local recovery version 6 as `draft`, and removed
  the matching browser buffer only after the saved server document matched.
- The CLI's report-only path was also exercised against the isolated local
  fixture (one post, six retained revisions, no media/publication; `applied=false`).
- Desktop (1440) and mobile (390) captures are under ignored
  `.impeccable/review/cms-*.png`. Independent UI review returned **ship** for the
  original five captures and separately for the browser-recovery notice. This is
  local interface approval, not authorization or verification of production.
- Independent security source review found migration-role default grants and
  native Unpublish concurrency-token gaps; both were fixed and re-reviewed as
  resolved. Local implementation/acceptance made no production changes. The later
  approved source deployment leaves CMS activation off and does not run migrations.
- Not exercised by the new CMS: native PostgreSQL multi-connection concurrency,
  production TLS/password connectivity, real Supabase session rotation in this
  release, real scoped R2 promotion via Payload, maximum-size media or live cutover.
  Earlier legacy real-upload acceptance evidence remains in
  `docs/blog-implementation.md`; it is not silently reclassified as CMS acceptance.
