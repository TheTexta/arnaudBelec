# Payload + BlockNote: implementation and cutover

## Status and scope

Implemented and locally verified on 2026-10-31. The owner subsequently approved
committing and deploying the source with Payload **disabled**. Production CMS
activation, database migration/import and network changes remain separately gated.
Native administration is staged at `/cms`, gated by `ARNAUD_CMS_ENABLED=true`.
The deployed custom `/admin` remains the rollback implementation.

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

## Proposed production changes — approval required

Source-code deployment with Payload disabled was approved on 2026-10-31. There
are **no approved production CMS activation/database/network changes**. Before
cutover, confirm the production database target/backup and approved network path,
then approve the following concrete change set and activation separately:

1. **Connectivity gate:** Payload needs a native Postgres connection from its
   server runtime. Current public Supabase HTTP API access is not sufficient.
   No Vercel-to-Postgres TLS endpoint/private connector has been verified. Do not
   expose port 5432, change Tailscale, firewall/DNS or bypass private networking.
   Select and approve a secure deployment/database connection path first.
2. **Back up/freeze:** capture a recoverable database backup and baseline counts/
   hashes; temporarily stop journal edits during final import. Photographs/media
   remain untouched. Do not use this cutover to retire sources or rotate shared
   credentials.
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
   created directly by the migrator. Verify runtime CRUD and anonymous denial.
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

Database pool maximum is three per application instance. Payload 3.92.1 reserves
one startup client; size the approved pooler/connection budget across Vercel
instances. Native Postgres concurrency, latency/timeouts and production network
acceptance remain explicit gates, not conclusions from PGlite.

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
