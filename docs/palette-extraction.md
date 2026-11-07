# Arnaud MMCQ palettes

## Status and scope

**Deployed and backfilled (2026-11-06 local; verified 2026-11-07 UTC).** Fresh backups cover all
16 photographs (eight R2 and eight Supabase originals). The exact newer production
baseline `dpl_BPRvSrJzRqsBgFEFP47s2QY33hyn` was reconstructed and its 173 files
verified against Vercel source SHA-1; the earlier release is not the current base.
The compatibility migration has committed under the existing `supabase_admin`
role, with all 16 legacy palettes validated and photograph/palette/reservation
rows unchanged. Helper execution is denied to `anon`/`authenticated` and allowed
to `service_role`. The palette application is deployed/promoted as
`dpl_C6pjaSz3JYLw8c56hGsno7uweHZe`; all 188 deployed source files matched the frozen
release, protected smoke checks passed, and 19 live desktop/mobile page checks
passed both before and after the backfill. The pinned run reports `after`.
Independent PostgreSQL comparison through destination column types exactly matches
all 16 new analyses and 112 colours: model `mmcq64-vibrant-oklab-background-v1`,
two phases, 256px, seven genuine colours for each current photograph. The model
still supports shorter palettes for simpler future images. Every full photograph
row, timestamp, saved background and reservation is unchanged.

All 16 originals (84,073,075 bytes) were re-read after apply and matched their
frozen SHA-256, size, ETag, provider and path. Fresh authoritative R2 listing also
matched all eight original identities and upload times. No originals were written,
deleted, moved, or switched providers. Anonymous publication still returns 401;
there were no observed live HTTP/page errors or Vercel runtime errors. A real new
authenticated upload was not performed as part of this palette-only operation.
All owned test containers and the test VM were stopped; Docker context unchanged.
Unrelated working-tree changes remain unreleased and were not committed or pushed.

Resume verification passed: production-mode Webpack build and **48/48** synthetic
browser cases against the refreshed release; palette **21**, admin **14**, storage
**21**, source lint and typecheck. The earlier development-server JSON parsing
failure was not reproduced in `next start`; its precise cause remains unproven.
The lint invocation excludes generated `.local/**` verification output rather than
changing the deployed ESLint configuration. The actual 16-photo PostgreSQL 15
migration rehearsal also passed, including saved ownership/ACL/RLS and exact row
preservation. Exact frozen real-palette apply/replay/rollback was independently
rerun successfully, including the scoped-delete follow-up below.

The resumed original reader uses Storage's credentialed `/storage/v1/object/`
endpoint; this server does not support `/object/authenticated/`. All 16 originals
(84,073,075 bytes) passed a read-only preflight. The ignored local service-role key
was subsequently found stale by PostgREST. With separate owner approval, the
private `with-current-service-key.mjs` wrapper reads only the existing current
server key into a child process; it never displays or persists that key, updates
`.env.local`, rotates credentials, or changes shared infrastructure. Resume commands
must use that wrapper until the local credentials are separately updated.

### Resumed run identity and recovery

Private working artifacts are under `.local/palette-resume-20261106/`; independent
verified copies are under
`/Users/dexteryoung/.local/share/opencode/backups/arnaud-mmcq-resume-20261106/`.
The active complete frozen run is `frozen-run-scoped/`, including its offline
review. The previous `frozen-run-current/` artifact remains unedited but is stale
after the scoped-delete function correction; do not apply it or edit its schema.
Earlier incomplete preparation directories are retained, not resumable runs.

- Compatibility migration source SHA-256:
  `ea0db572979717db79bb1fcb1ba6d20cee330607511c8c978eb27ab53a969318`.
- Scoped-delete follow-up migration `20261106000000` source SHA-256:
  `2ceff9fa1cab6dd7e880ba903302b865fc70fb079b2d62cfe271e7b622a20b81`.
- Full 16-photo pre-migration dump SHA-256:
  `242c9cbaabfee4d4a328a9ec60b023e1afc1a7177459733510a6ae0ad5593d5d`.
- Original identity proof SHA-256:
  `4617c651992f2fa3a291428280453d50e570c29047a6c727e68d82b7e989e8a8`.
- Frozen run SHA-256:
  `acf6a33d08da1d7e03ac301d9ab3296b12ac4a870fa73540b97c8214e1f0cc24`.
- Release source archive SHA-256:
  `627f960280d777a77efcb35fabd2c4a8bf13e0b83ed8e3a034510dc899e58c9d`.
- Application deployment: `dpl_C6pjaSz3JYLw8c56hGsno7uweHZe`,
  `arnaud-belec-ddn5mg1z2-thetextas-projects.vercel.app`.
- Previous application/rollback target: `dpl_BPRvSrJzRqsBgFEFP47s2QY33hyn`,
  `arnaud-belec-bqqar8mk7-thetextas-projects.vercel.app`. Do not roll back to the
  older pre-CMS `dpl_6C3noecjyNv85wrB3LxoSC6Z6vkP` checkpoint.

The first two palette applies returned HTTP 400 / SQLSTATE `21000`, `DELETE
requires a WHERE clause`; pinned verification after each confirmed `before`.
Production's safe-update guard was not present in vanilla local PostgreSQL. The
separate, reviewed follow-up migration changes only the two batch deletes to
explicit predicates over the normalized, verified frozen photograph IDs; it does
not disable the guard, use `WHERE true`, change privileges, alter original media,
or modify the already-applied base migration. Its guarded application preserved
all four tables. Real PostgreSQL concurrency tests passed **16/16** again; the
focused source regression test proves the body changes only those predicates.
The new schema fingerprint required a freshly prepared run, not artifact editing.
All 16 original identities, previews, colours and weights in the new run exactly
match the already visually accepted run; only the schema and new analysis times
differ. The follow-up is a database-only correction after the application release,
and its source/test are backed up alongside that release's original source archive.

From the owning repository, the following is **read-only verification**:

```sh
node .local/palette-resume-20261106/with-current-service-key.mjs verify \
  --run=.local/palette-resume-20261106/frozen-run-scoped \
  --sha256=acf6a33d08da1d7e03ac301d9ab3296b12ac4a870fa73540b97c8214e1f0cc24 \
  --proof=.local/palette-resume-20261106/original-proof.json \
  --proof-sha256=4617c651992f2fa3a291428280453d50e570c29047a6c727e68d82b7e989e8a8
```

Only with separate owner authorization, frozen photo/original changes and a
`verify` result of `after`, replace `verify` with `rollback` and append
`--confirm=arnaudbelec` to restore the exact previous palette rows. Verify `before`
after rollback, then promote the previous application if needed. The compatibility
migration can remain in place: it accepts both models. Never force past `stale`,
edit a frozen artifact, rotate keys, or restore the dump over later uploads.
The pinned Node/Sharp/operator sources must be retained with the run. Recovery
requires fresh original checksum verification and refuses later catalogue/schema
changes. This procedure has been rehearsed locally, not executed in production.

### Paused rollout checkpoint

The following records the earlier pause, superseded only by the resumed rollout
status above. Preserve its stale artifacts as historical evidence.

At the initial pause, the owner-selected up-to-seven/background-aware rollout
aborted at its migration guard because eight photos had been added after the
backup. No migration, deployment or backfill had occurred at that checkpoint;
all original eight rows/palettes were intact. The successful resumed rollout above
uses new full-catalogue artifacts, not that stale checkpoint. Unrelated local
CMS/site/font/orb work was never implicitly approved by this task.

- Private artifacts: `.local/palette-rollout-20261106/`. The pre-migration dump,
  full JSON snapshot and exact production-source manifest also have independently
  verified copies under
  `/Users/dexteryoung/.local/share/opencode/backups/arnaud-mmcq-20261106/`.
- The guard failure and independent read-only outcome are retained in
  `migration-apply-result.json` and `migration-outcome-readonly.json` respectively.
  This was a real catalogue change, not a migration SQL defect. The ledger version
  `20261105000000` and the three new MMCQ helper functions remained absent.
- Production baseline `dpl_6C3noecjyNv85wrB3LxoSC6Z6vkP` was reconstructed and all
  157 source files verified against Vercel source SHA-1. The isolated `release/`
  overlays only palette changes, preserving production `/`, typography, CMS,
  pointer interactions, storage and authorization. It excludes unreleased site,
  font, audio and orb-drag work. No deployment command was run.
- The eight-photo backup and original proof are **stale**, not a snapshot of the
  current catalogue. The original eight use R2; the eight new photographs use
  Supabase. Do not restore the old dump over new uploads or edit the old proof to
  bypass its guard. No frozen backfill run was prepared or applied.
- Arnaud's sensitive Vercel R2 variables could not be exported; no credential values
  were obtained or displayed and no configuration was changed. A private alternate
  reader binds raw Worker delivery to fresh R2 ETags and recorded original SHA-256
  checksums. Its mocked checks passed, but it currently covers only the original
  eight R2 photos and has not completed an end-to-end preparation.
- Resume requires a newly approved window with photo uploads/edits paused, fresh
  consistent backups and mixed-provider original verification for the full current
  catalogue, correction of the isolated browser harness failure below, migration
  verification, full real-data palette review/rehearsal and independent frozen-run
  backup before deployment/backfill. Never reuse the stale migration wrapper.
- All owned test containers were stopped; the test-only Colima VM started for this
  task was stopped on pause. The existing Docker context was not switched.

The source is adapted from Elliot's deployed `mmcq64-vibrant-oklab-v1`, not its
legacy k-medoids backfill script. Arnaud's model is separately versioned as
**`mmcq64-vibrant-oklab-background-v1`** because its pixel population and maximum
swatch count differ. No cross-repository package or shared authorization change
is introduced; Elliot's code and data are unchanged.

## Extraction and representation

- `lib/photographs/analyse-image.mjs` remains the one analyser for CLI import,
  browser sample analysis and original-file backfill payloads.
- Palette samples are auto-oriented, at most **256px** on the longest side, never
  enlarged. Alpha at most 200 is ignored. Original eligibility stays at **120MP /
  500 MiB**; Elliot's special archive input allowance is not copied.
- Background extraction keeps the existing **96px**, outer-8%-edge k-medoids
  method, 0.45 chroma reduction and transparent-edge fallback. Backfills explicitly
  pass the existing saved background and never recompute/write photograph rows.
- Exclude pixels less than **0.08 OKLab distance** from that background. If none
  remain, or only unsupported noise regions remain, retain the original opaque
  population. A flat background plus isolated hot pixels must not promote those
  hot pixels through the tiny-image fallback.
- The deterministic five-bit/channel modified median cut splits by population
  toward 48 boxes, then population × box volume toward **64 candidates**. It stops
  when occupied boxes cannot split. Representatives are sampled RGB values nearest
  each region's population-weighted OKLab mean, not synthetic named colour roles.
- Regions below `max(3 pixels, ceil(0.001 × eligible pixels))` are rejected; tiny
  samples retain their most-supported real candidate. Greedy selection balances
  chroma, exposure, support, coverage and separation. Select **1–7** actual colours,
  with minimum pairwise OKLab distance **0.055**. No duplicate/zero-weight padding.
- Selection scores establish **rank**, not weight. Weights assign the complete
  background-filtered population to nearest selected swatches, sum to one and
  serialize to six decimals. The existing `algorithm_iterations` stores **2
  quantisation phases**, not k-means iterations. `palette_size` is the actual count.
- RGB/hex, rank and **CIELAB** (`lab_l/a/b`) remain in Arnaud's existing tables.
  OKLab is internal to extraction; its coordinates must not enter CIELAB fields.

The browser now makes a 256px PNG sample, bounded at 300,000 bytes (including an
incompressible RGBA fixture). The publish handler still accepts dimension-correct
**96px samples from already-open clients**, records `sample_longest_side=96` for
those clients, and never enlarges their data. This preserves tickets/retries
during deployment. Browser canvas resampling and Sharp original resampling can
produce slightly different sampled RGBs: a browser sample is not proof of an
exact original-file backfill. Original uploads still bypass Vercel.

## Consumers and compatibility migration

`supabase/migrations/20261105000000_add_arnaud_mmcq_palettes.sql` is additive and
must be approved/applied **before** the new analyser is deployed. It preserves
legacy seven-colour/10-iteration/96px publication while accepting new 1–7-colour,
two-phase palettes. Both Supabase publication and verified R2 publication share
validation and store the supplied analysis settings rather than hardcoded legacy
values. Validate count, contiguous unique ranks, RGB/hex, coordinate ranges and
normalized population weights. New-model colours must have distinct hexes and
positive weights; legacy padded colours remain readable and writable.

Existing tables, RPC signatures, catalogue publication state, service-only write
access, RLS and media reservations remain intact. The migration adds service-only
validation/snapshot/backfill functions; browser `anon`/`authenticated` roles cannot
execute them. Existing background replacement avoids even a same-value photograph
UPDATE, so unchanged backgrounds do not fire `updated_at` triggers.

Archive/detail views render only actual swatches; missing palettes get no invented
colours. Single-colour gradient sizing has an explicit finite 100vw baseline.
The fixed seven-slot shader capacity and seven rank-to-chord mappings remain;
shorter palettes use only their available ranks. Existing orb movement, drag,
selection stacking, sound opt-in, WebGL/CSS fallback and reduced motion are kept.

Full-palette matching extends the current optimal assignment to unequal sizes:
every colour in both palettes participates, with reuse only on the smaller side.
Equal sizes retain one-to-one assignment. Distances remain unweighted CIELAB RMS;
single-swatch nearest matching, threshold 20, monochrome separation and minimum
five eligible matches remain. Curated Colour/Black & white membership is unchanged.

## Guarded original-file comparison and backfill

`npm run photos:reanalyze` now defaults to help. It does not load credentials,
request originals or write production automatically. The old bare-command writer
and `--dry-run` syntax are deliberately retired.

Explicit commands use the existing server-only Supabase environment (`SUPABASE_URL`
or `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); R2 reads use existing
Arnaud-scoped `R2_*` credentials. No new database password or service credential is
introduced. Never put credentials in arguments, artifacts, logs or `NEXT_PUBLIC_*`.

Use a **new private run directory**, e.g. under ignored `.local/`. Its parent must
already exist. Preparation refuses an existing directory; it does not resume,
overwrite artifacts or skip failed photographs. Interrupted preparation requires
a new run. Files are private (600), the run directory is 700, and completed files
are fsynced and atomically published without replacement.

```bash
npm run photos:reanalyze

# Read-only remote preparation; writes local private review artifacts only.
# Use only after the separately approved compatibility migration is applied.
npm run photos:reanalyze -- prepare --run=.local/arnaud-mmcq-REVIEWED-RUN

# Substitute the independently recorded SHA printed by prepare, not a new hash
# calculated after editing a run. Back up the complete run before any apply.
npm run photos:reanalyze -- verify --run=.local/arnaud-mmcq-REVIEWED-RUN --sha256=RECORDED_SHA256

# Separate owner approval is required for each production mutation.
npm run photos:reanalyze -- apply --run=.local/arnaud-mmcq-REVIEWED-RUN --sha256=RECORDED_SHA256 --confirm=arnaudbelec
npm run photos:reanalyze -- verify --run=.local/arnaud-mmcq-REVIEWED-RUN --sha256=RECORDED_SHA256

npm run photos:reanalyze -- rollback --run=.local/arnaud-mmcq-REVIEWED-RUN --sha256=RECORDED_SHA256 --confirm=arnaudbelec
npm run photos:reanalyze -- verify --run=.local/arnaud-mmcq-REVIEWED-RUN --sha256=RECORDED_SHA256
```

Preparation obtains all rows from the three Arnaud tables in a protected snapshot,
without REST pagination limits. It reads **original objects**, not public resized
derivatives. R2 HEAD/conditional GET/second HEAD guard ETag and size; both providers'
downloaded bytes are bounded and SHA-256 hashed. A source identity binds provider,
path, ETag (when available), size and actual checksum. Existing R2 objects need
not carry Elliot-specific SHA metadata. Nothing writes to either storage provider.

The run contains `before.json`, immutable `run.json`, and `REVIEW.html` with embedded
320px local previews plus old/new swatches and population shares. No originals are
retained. `run.json` includes the complete before/desired rows, original identities,
Node/Sharp versions and analyser/operator source hashes. Independently save its
printed SHA-256 and back up the complete private run. Checksums detect accidental
or observed changes; they do not protect against an actor replacing both files
and independently held pins. The previews contain local image content: keep them
private and outside source control.

Apply first classifies the normalized database as **before / after / stale**.
Exact after is an idempotent no-write replay. Before writing, require the pinned
runtime/source and re-download/re-hash **every** original. Schema, grants, RLS,
policies, functions and full typed rows are checked under fixed-order locks:
`SHARE` on photographs, then `SHARE ROW EXCLUSIVE` on both palette tables.
READ COMMITTED is mandatory; other isolation levels are refused so a writer
committing during the lock wait cannot hide behind an old snapshot. Lock timeout
is five seconds; operator HTTP timeout is 180 seconds. The function requests a
60-second statement timeout; confirm the outer PostgREST statement timeout for
production as in-statement settings alone are not an independent deadline.
Storage IO never holds database locks. Public reads remain possible.

The write function accepts only a palette-only transition: full photographs and
the schema fingerprint must remain identical. Delete/insert only
`arnaud_photo_palette_analyses` and `arnaud_photo_palette_colours`, validate exact
target rows, then commit once. User triggers/rules, generated/identity palette
columns, nonordinary tables and inbound palette foreign keys are refused, rather
than risking unexpected cascades. No original, photograph timestamp/text/order,
CMS/journal content, reservation or other project's palette is written.

Rollback reverses the same frozen snapshots, restoring exact previous palette
rows/timestamps and absent analyses in one transaction. Any later text, photo,
palette, original identity or schema change blocks transition and requires a
separately reviewed recovery. Keep the pinned application/operator checkout and
Node/Sharp runtime available. Never edit the run to bypass a stale refusal.

**A timeout/disconnect may occur after commit.** Do not retry automatically: run
`verify` with the original pin. `after` means new palettes, `before` means original
palettes, and `stale` means stop. `verify` performs no public DML/table-write locks;
it returns exit code 2 for stale. Restore palettes before rolling an application
back to code that requires exactly seven. Do not restore an old photograph dump
over later catalogue edits.

Original verification cannot lock storage against an external change immediately
after the check. Freeze original mutations, uploads, deletions and admin photo
edits throughout the operator window. PostgREST snapshots do not replace a full
database backup. Application deployment and final page refresh are separate steps;
public catalogue reads use `no-store`, not Elliot's persistent palette cache epoch.

## Verification and release procedure

Offline coverage is included in existing commands:

```bash
npm run test:palette
npm run test:admin
npm run test:storage
npm run test:site
npm run test:cms
npm run test:blog
npm run lint
npm run typecheck

# No .env loading or provider access; isolated output, synthetic catalogue only.
node scripts/verify-palette-browser.mjs --build
node scripts/verify-palette-browser.mjs
```

The browser runner needs local Chrome and Playwright; `PLAYWRIGHT_MODULE` may point
to an installed module. It owns/stops its loopback fixture and child Next process,
uses separate ignored build/dev output, blocks external sockets/requests and
protects tracked/generated configuration. Its Webpack build intentionally skips
Next's config-writing TypeScript setup; the separate `typecheck` is required.

Local checks passed: palette **21**, admin **14**, photograph/storage **32**, site
**35**, CMS **42**, blog **3**, lint and TypeScript. The isolated synthetic production
Webpack build passed. **48** browser cases passed for zero/one/two/seven swatches,
archive/detail, 390/1440px, WebGL/CSS fallback/reduced motion, keyboard selection,
rank-zero chord events, nonempty matching and no overflow/runtime errors. Evidence
is under `.local/palette-validation/`; synthetic images are not real-catalogue
palette acceptance. An independent read-only source review found no material issue.

These earlier checks cover the main working tree, not the isolated production
baseline. For the isolated release, lint, typecheck, palette **21**, admin **14**,
storage **21** and the synthetic production Webpack build passed at the initial
pause. That checkpoint's browser run failed HTTP 500 with
`SyntaxError: Unexpected end of JSON input`. Its precise development-server cause
remains unproven. The successful resumed **48-case production-mode** verification
above used the newer exact release and `next start`, with no HTTP or page errors;
it did not suppress or rely on the earlier failed run.

The SQL checks run locally in PGlite, exercising migrated grants, both provider
publication paths, actual counts, atomic apply/rollback/replays, preserved full
photograph rows, stale text/schema refusal, wrong isolation, inbound-FK refusal
and injected insertion failure. On 2026-11-06 the new local-only
`scripts/test-mmcq-postgres.mjs` passed **16/16** real PostgreSQL 15 tests, independently
rerun after review, including multi-session locks, racing apply, deadlock avoidance,
exact rollback and the outer statement timeout. It requires the explicit test-only
Docker socket and owns only a random network-isolated container. The tested migration
SHA-256 is `ea0db572979717db79bb1fcb1ba6d20cee330607511c8c978eb27ab53a969318`.
The actual 16-photo frozen apply/verify/replay/reverse rollback also passed, with
only the local schema fingerprint substituted in memory, and no production rollback
or frozen-artifact edits. Final live checks compare all 16 detail palettes to the
active run plus mobile archive/detail and keyboard matching, totaling 19 pages per
before/after pass. Destination `real` columns are compared through their native
types, not by requiring unrounded analyser doubles to equal PostgreSQL JSON numbers.

Recommended release order, each mutation separately approved:

1. Review the isolated diff; finish the PostgreSQL 15 concurrency/outer-timeout
   rehearsal and verify live schema/privileges without changing data.
2. Approve/apply the compatibility migration. Verify legacy upload compatibility.
3. Approve/deploy the palette application, without implicitly shipping unrelated
   local CMS/site/font changes. Stored palettes remain unchanged.
4. Approve read-only original preparation, inspect every current photograph in
   `REVIEW.html`, and independently back up/pin the run.
5. Approve palette-only apply; verify exact rows, original identities, unchanged
   photo metadata and fresh public pages. Refresh already-open clients.

No step above is authorized merely by the local implementation or passing tests.
