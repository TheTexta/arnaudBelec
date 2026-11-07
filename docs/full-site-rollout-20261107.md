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

No production schema change or full-site promotion is claimed by these rehearsal
results. Private evidence is retained under ignored `.local/full-rollout-20261107/`.

## Recovery boundary

Preserve additive schema, historical versions, all original Media and the private
raw import journal. Do not rerun role bootstrap or broadly regrant existing tables:
the raw journal must remain denied to runtime/browser/service roles. Application
rollback is separate from data rollback; do not run destructive down migrations.
Never use the old pre-palette video stage as a production rollback target.

Safari/physical iOS and continuous full-length 4K playback are not certified by
synthetic viewport checks. Existing real three-master Chrome playback/expiry
evidence is retained in `original-video-support-plan.md`.
