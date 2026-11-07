# Full-site rollout — 2026-11-07 UTC

## Approval and boundaries

The owner requested committing **all local changes and deploying**, explicitly
confirmed P22 Cezanne Pro web-use licensing, and approved the pending Arnaud-only
site-expansion/homepage migrations after fresh backup and populated-data rehearsal.

This rollout includes the homepage at `/`, photography at `/photos`, the full
public shell, native Site settings, current font/readability, optional sound and
garment-viewer code, and all completed palette/video/intake work. It does not
publish private projects/settings, enable newsletter delivery, send email, purchase
or configure a domain, change shared authorization, import additional prepared
Adobe content, delete originals, or deploy repository infrastructure files.
Ignored credentials and private `.local/` operational evidence are excluded.

## Verification before release

- Lint and TypeScript passed.
- CMS 57, site 40, media 3, palette 21, admin 14, blog 3 and storage 33 tests passed;
  both portfolio/fashion preparation-tool test files passed.
- Independent synthetic Chrome review passed 49 full-site, ten homepage/CMS and
  seven anonymous API-boundary cases. The earlier Journal navigation abort did
  not reproduce. Fixture-owned processes were stopped afterward.
- Independent migration review found no blocker. Installed Payload chooses pending
  migrations by name, so the already-recorded later raw-import migration does not
  skip the two older pending migrations. Fourteen populated-model/migration checks
  and 16 newsletter checks passed in isolated synthetic databases.

Production backup/rehearsal, build, commit, migration, deployment and final read-back
receipts are recorded below as those gates complete. Newsletter must remain
`ARNAUD_NEWSLETTER_ENABLED=false`. Preserve existing publication states: the
separately approved Circle of Fashion page is public; both Video projects and the
original Fashion selection remain private drafts.

### Backup, rehearsal and builds

- Fresh full native-schema backup SHA-256:
  `ba456e8c13e952b83c1a7d9d121a2730e14c073b62de41a78b31f58e463a1a82`.
  All 21 native table fingerprints matched its isolated PostgreSQL 15.8 restore.
- Rehearsed both pending migrations in order, each with its ledger update in the
  same transaction. All 20 pre-existing content tables were byte-equivalent;
  all 33 Media, three original-import records, old indexes and constraints survived.
  Thirteen new tables have runtime DML and no browser/service-role DML. The raw
  import journal remains denied to runtime/browser/service roles.
- Migration source SHA-256: expansion
  `64ad1fd121f5a2915c2b15f4dc5be8f2f7599990495e6e1b5ec34679c2e96fb8`;
  homepage `855006d3e22bb7cdad1756f2eb64f0960c450c41121dbf5dd8032808699cdedc`.
- Isolated enabled/disabled production Webpack builds passed; CMS-disabled
  production routes failed closed. No dotenv or production data was used for them.
- Fresh live rollback/application baseline is the Circle of Fashion release
  `dpl_9ncY5tyxrH4aJ27VkfTFHR9q1pWZ`, not its older video-only predecessor.

The rehearsal itself made no production change. The separately approved real
application below followed those checks. Private evidence is retained under ignored
`.local/full-rollout-20261107/`.

## Production migration and deployment

- Code commit: **`dcd240ee9d01cc27d86e1f993b6aeb7dddb1b61a`**, all 245 changed paths.
  No ignored `.env`, `.local`, `.vercel` or private operational artifacts were
  committed. The complete 306-file Git archive SHA-256 is
  `92375599765d644e9c75839f5b30f5fdff9b0fa3a3f5f1d8836cc8fd36fe58f7`.
- Applied only `20261104_120000_site_expansion` and `20261105_120000_homepage`
  through the existing migrator→owner identity using Payload's real CLI. The later
  raw-import ledger entry survived. All 20 existing native content tables remained
  byte-equivalent; all 13 new tables were empty with correct owners/grants. The
  raw import journal remains private. Immediate backup SHA-256:
  `ad254f684c30119378a3f5d4245c31621460de7c1dd001ba7421f57c6b513354`.
- The old Circle release passed public/anonymous forward reads against the new
  schema before deployment. No existing content, publication or original changed.
- Added and read-back verified only production `ARNAUD_NEWSLETTER_ENABLED=false`.
  No provider, other site variable, domain, shared service or gateway was changed.
- Deployment **`dpl_56SgFgNQeU6qGcru4J9N37QjEVFv`** is live at
  <https://arnaud-belec.vercel.app>. All 299 uploaded source SHA-1s matched the
  committed export. The other seven Git files were excluded by the existing
  ignore rules (design metadata, `.env.example`, `.gitignore`), not deployed secrets.
- Stage HTTP and 24 real-content route/viewport checks passed at 390/1440px:
  actual P22 glyphs, live homepage fluid/reduced-motion rendering, all ten Circle
  images decoded, sound off by default, native CMS/settings and all three private
  4K masters decoded at both widths. Captures were inspected. CMS testing blocked
  non-GET browser requests, so no autosave/publication/editorial mutation occurred.
- Promotion checked production still pointed to the freshly verified Circle
  baseline before switching. Canonical HTTP read-back passed: homepage `/`, archive
  `/photos`, existing photo/Journal links, Circle and CMS work; only 11 currently
  published Media are anonymous, all 33 are readable to the existing admin; draft
  projects and all three masters remain denied anonymously. Authorized ranges
  succeed with unchanged 60-second capabilities. Newsletter requests return 503
  before database/provider work; no email or subscriber/delivery record was created.

## Completion

- Canonical production browser acceptance also passed all 24 route/viewport cases,
  including real P22 glyphs, homepage fluid/reduced motion, Circle's ten images,
  CMS/settings and decoded playback of all three private 4K masters at both widths.
  No page exceptions or overflow; non-GET browser requests remained blocked.
- Final read-only comparison matched all 29 pre-existing native/public content
  tables in this rollout's baseline, including all 33 then-existing Media, all
  three import journals, prior drafts/history, photographs and palettes. The only
  native ledger additions are the approved pair. Newsletter tables remained empty,
  no Site settings were published, and role flags/raw-journal denial were intact.
- Only the explicitly approved temporary acceptance session was revoked; all 18
  previous sessions survived. Its token artifact was deleted. The labelled,
  image-verified, network-none/no-ports restore container was removed and only the
  owned maintenance tunnel stopped. No production service, volume, original or
  shared infrastructure was removed or reconfigured.
- No runtime error/fatal entries were found for the deployed release during the
  scoped post-release log check. Safari/physical iOS remain untested.
- Concurrent Adobe-intake changes arrived after the original commit/deployment;
  the owner explicitly requested including those scripts in an additional reviewed
  commit. Their private import/publication record is separate in
  `adobe-portfolio-intake.md`, not an effect of this application rollout. In
  particular, the 33-Media preservation result above is this rollout's timestamped
  baseline, not a claim that subsequent authorized imports cannot add records.
- The additional operator/documentation snapshot passed lint, TypeScript and all
  30 parser/preparation/replay tests, plus an independent read-only safety review.
  It changes no application runtime files and was not executed as part of release
  verification. Committing it does not authorize additional Auth/import/publication
  operations or claim a second application deployment.

Local commits are not pushed to the remote by this task. Production source and
acceptance receipts remain under ignored `.local/full-rollout-20261107/`.

## Recovery boundary

Preserve additive schema, historical versions, all original Media and the private
raw import journal. Do not rerun role bootstrap or broadly regrant existing tables:
the raw journal must remain denied to runtime/browser/service roles. Application
rollback is separate from data rollback; do not run destructive down migrations.
Never use the old pre-palette video stage as a production rollback target.

Safari/physical iOS and continuous full-length 4K playback are not certified by
synthetic viewport checks. Existing real three-master Chrome playback/expiry
evidence is retained in `original-video-support-plan.md`.
