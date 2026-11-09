# Page customization rollout — 2026-11-09

## Authorization and scope

The owner requested **commit + push all local changes**, including the existing
Adobe intake operators/documentation. Read-only inspection established that Vercel
automatically deploys production-linked `main`. After being told the new code
requires an unapplied migration, the owner explicitly instructed: **“no apply the
database migration then.”** This authorizes the Arnaud-only migration followed by
the main push and its application deployment, not a deployment guard/config change.

No existing content is published, recoloured or converted to YouTube by this
rollout. Newsletter remains disabled. No Auth session, permission, shared service,
storage object, original master/variant, domain or environment configuration is
changed. The included intake tools are committed, not executed.

## Verified baseline and migration

- Fresh production baseline: `dpl_JEHdp1pQgfMGGaxsZrBAQVQorwdN`, already READY from
  `58002e45e9d271ee4eae778c10d489ae8fd7b94c`. This supersedes the older manually
  deployed baseline for application rollback decisions.
- Existing database: 34 native tables, nine public Arnaud tables, seven migration
  ledger entries, 71 Media records, three raw import journals and 94 photographs.
- Complete native-schema backup SHA-256:
  `d80ad9d31aad411efce6e52e377a08327c9b6b307c39a9c5f4a5aa8117099c1c`.
  All 34 tables restored and matched on the exact current production PostgreSQL
  image, in a labelled, memory-only container with no network or published ports.
- Rehearsal preserved all 33 native content tables, existing owners, ACLs,
  constraints/indexes and default privileges. The two new order tables have runtime
  DML; browser/service roles have none. `media_imports` stays denied to runtime,
  browser and service roles. No role bootstrap or broad regrant ran.
- Applied only `20261109_120000_page_customization`, source SHA-256
  `fd3a3343f42e3cf967b44ffe0506ed73fdf130b6e98cd212ab9fa05744d36d82`, through
  Payload's installed migration CLI and the existing migrator → owner identity
  over a loopback-only SSH maintenance tunnel. Every connection had a five-second
  lock timeout, 60-second statement timeout and 20-second idle-transaction timeout.
  Dotenv/provider loading was suppressed; the runtime gateway was not used for DDL.
- SQL and its ledger entry committed atomically. Payload 3.92.1 derives its next
  batch from the name-sorted latest entry, not `MAX(batch)`. The pre-existing raw
  import entry has batch 4 while the earlier-named expansion pair has batch 5;
  this migration consequently records batch 5. The exact-runner rehearsal covered
  that behavior. Existing ledger entries were not rewritten.
- Immediate pre-migration backup SHA-256:
  `29df62c0cf5abf75f0ff4da25500031621003c163ee01da57d88a94fc4d739ec`.
- Production read-back matched all **42 existing native/public content tables**
  using their original column sets. Owners, ACLs, role flags, default privileges,
  prior indexes/constraints, all 71 Media, three import journals, drafts, versions
  and the 94-photo catalogue are preserved. New Video source fields are null, not
  a default that disables legacy films. The two new tables are empty.
- Newsletter subscribers/deliveries/recipients remain zero; its public endpoint
  still returns 503. No Site settings snapshot was created or published.
- Before push, the unchanged old application passed seven forward-read checks:
  `/`, `/photos`, `/video`, `/fashion`, `/blog`, Circle of Fashion and `/cms/login`.

## Source and deployment verification

The implementation passed lint, TypeScript, 182 application tests, clean final
CMS-enabled/disabled production builds, 49 existing full-site browser checks,
14 focused integration checks, and standalone mocked YouTube SSR/12-scenario
coverage. The additional preparation/upload/publication operator suite passed
32 tests. Independent migration review found no SQL blocker.

The release sequence is verified backup/rehearsal → migration/preservation →
commit all non-ignored source → push `main` → verify the resulting production
deployment and public read-back. Deployment IDs, the pushed commit and final
read-back/cleanup receipts are retained under ignored
`.local/page-customization-rollout-20261109/`, not in credential-bearing source.
Private backups and operator credentials must remain excluded from Git.

One pre-existing Vercel `/photos.rsc` `client_idle_timeout` event was present in the
baseline log window. It is not evidence of this migration failing; no gateway or
shared-service tuning is included. Compare new-release logs separately.

## Recovery and remaining acceptance

Keep the additive schema, historical versions, import journals and originals.
Do not run down migrations or restore production data merely to roll back the
application. The old release's forward reads passed before push. After later
editorial YouTube changes, an older application is not playback-equivalent.

Real YouTube provider playback, physical Safari/iOS and deliberate use/publication
of new palettes/YouTube selections remain separate acceptance/editorial actions.
Local tests use synthetic content and mock YouTube transport. Existing long-title
mobile CMS breadcrumb overflow is documented in `page-customization.md`; the new
colour controls fit without restyling native chrome.
