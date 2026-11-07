# Circle of Fashion — extraction, layout and production rollout

**Live:** <https://arnaud-belec.vercel.app/fashion/circle-of-fashion>.
The owner-approved import, publication and scoped layout release completed on
2026-11-06 (promotion at `2026-11-07T02:30:09Z` UTC). The production record below
supersedes the earlier local-only gates; it does not approve the rest of main.

The Fashion detail renderer borrows the centred **672px** reading column from
Dexter's portfolio writeups, retaining Arnaud's existing font, colours, navigation
and atmosphere. The exact introduction precedes the first photograph. Cover and
gallery images use one column at their natural aspect ratios without a height cap
or cropping. Video keeps its existing wide layout and two-column desktop gallery.
Native CMS drafts, private preview and published-only reads are unchanged.

## Extracted content

Source: <https://arnaudnaudbel.myportfolio.com/copie-de-sewing>.

> Circle of Fashion, McGill University, Runway Fall 2025. Designed in collaboration with Sophie Miretsky.

Only this series' **10 JPEGs**, in source order, are included. The five PHASSION
images belong to another series. The highest renditions advertised for Circle of
Fashion are **1920 × 3416**; these are Adobe's published renditions, not a claim of
camera-original quality. Downloaded JPEG bytes are not recompressed or modified.

```sh
node scripts/fashion/extract-circle-of-fashion.mjs .local/circle-of-fashion-NEW-DIRECTORY
node --test scripts/fashion/extract-circle-of-fashion.test.mjs
```

The extractor makes public GETs only, never loads `.env`, refuses an existing
output directory and stops if source copy, image membership or order changes.
It writes ten images, `source-text.txt` and `manifest.json` with source URLs,
dimensions, byte counts, SHA-256, alt text and the proposed project fields.

The 2026-11-06 extraction is in ignored `.local/circle-of-fashion-20261106/`:
**27,754,120 bytes** across ten fully decoded JPEGs. The proposed slug is
`circle-of-fashion`, year `2025`, with the exact source text as its excerpt.
The first image maps to the cover; the other nine map to the gallery in order.
The extraction bundle is the original **draft import mapping**. Actual native
Media IDs and the new project's publication receipts are recorded separately in
ignored `.local/fashion-production-20261106/`.

## Local preview and checks

```sh
./node_modules/.bin/tsx scripts/cms/site-expansion-fixture.ts --fashion-manifest .local/circle-of-fashion-20261106/manifest.json
# In another terminal, with Playwright already available:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/fashion/verify-browser.mjs
npm run test:site
npm run lint
npm run typecheck
```

The fixture verifies local hashes/dimensions, creates an isolated memory-only CMS
project and serves local image bytes from its loopback stub. The browser uses
those bytes with the actual Next routes/components; all outside requests are
blocked. Its local published row is disposable test state, not a production
publication. Without the option, the existing fixture stays synthetic. Screenshots
and check results go to ignored `.local/fashion-browser/`.

## Original local-only boundary

No live Media or Fashion records, storage objects, schema, configuration or
deployment are changed by extraction/local preview alone. A live import must use the
existing authenticated native Media upload/verification workflow, then create a
**new** Fashion draft using the manifest fields and actual returned Media IDs.
Do not overwrite **Fashion — portfolio selection** or bypass verification hooks.
Review the new private preview before separately approving publication. These
separate approvals were subsequently given for Circle of Fashion only.

The scoped production release differs from the local main checkout. Do not
deploy all of main for this layout: see `portfolio-intake-20261106.md` for the
remaining migration/visual gates, including the existing P22 web-licence gate.

## Historical local verification record — 2026-11-06

The implementation owner reports a fresh **10/10** SHA-256 and byte-count
reverification of the downloaded JPEGs: **27,754,120 bytes**, each
**1920 × 3416**, the highest Adobe rendition advertised by the source. This does
not establish camera-original quality. Exact source URLs, order, byte counts and
hashes remain in the ignored manifest alongside `source-text.txt`, ten JPEGs and
the local `contact-sheet.png`; nothing is a new shipping raster or generated
design asset. The manifest proposes a new draft, first image as cover and nine
remaining images as gallery; PHASSION and the existing private Fashion selection
remain excluded.

The finish documenter read the manifest/source text, renderer, scoped CSS,
incumbent `DESIGN.md`/sidecar and portfolio structural reference, then opened all
four mobile/desktop viewport/full-page screenshots and read
`.local/fashion-browser/result.json`. The **13 passing browser checks** cover
copy once, source ordering, ten images, dimensions/natural ratios, no overflow,
centred single-column layout/gutters, actual P22 glyphs, focus/back navigation,
private/unknown 404s, Video's unchanged two-column desktop layout/controls and
an image failure triggered after hydration while mounted with its original-file
link retained. Measured Fashion widths are (350px) at (390px) and (672px) at
(1440px). These are actual local routes with ephemeral CMS/local-file content,
not evidence of live CMS ingestion or production asset delivery.

Completed checks reported by the implementation owner (not rerun by this
documentation-only pass):

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test:site` — 40 tests passed, including five new renderer tests.
- `node --test scripts/fashion/extract-circle-of-fashion.test.mjs` — four tests
  passed: three parser cases and the existing-destination/no-overwrite case.
- Isolated production Webpack build, CMS disabled — passed, with no dotenv,
  nonlocal network blocked and a separate `.local` output.
- `git diff --check` — passed.
- Second isolated production Webpack build, CMS and site expansion enabled —
  passed compilation, TypeScript, all 16 static pages and tracing. The initial
  attempt lacked a dummy `ARNAUD_CMS_ORIGIN` in the ignored verification preloader;
  setting it to `http://127.0.0.1:1` corrected test-harness configuration only,
  with no application source change, dotenv loading or production access.

The mechanical detector ran once: eight pre-existing CSS colour/type-ramp
advisories only, with no new colour/type values from this extension. An independent
fresh read-only finish reviewer returned **SHIP**, no blocking findings, limited
to the supplied local implementation/screenshots; it reran the three parser
tests and inspected the other reported checks. The surface comparison and scope
are recorded in `.impeccable/surfaces/fashion-projects.md`. Existing `DESIGN.md`
and `.impeccable/design.json` were preserved, not regenerated.

No documentation blocker was found for this scoped local record. That verdict
does not approve the whole dirty checkout, production import, storage writes,
publication, migration or deployment. Existing draft/publication/private-preview
loaders remain the authority; the optional local fixture does not authorize live
publication. The separate approval, font web-licence and main/category-only
release gates were not approvals. The later production rollout below keeps the
pending P22/homepage and wider expansion out of production.

## Approved production rollout — 2026-11-06

### Content and publication

- Imported all ten unchanged JPEGs through native authenticated Media signing,
  direct upload, receipt registration and server-side byte verification. All ten
  private and subsequent anonymous public read-backs matched source SHA-256 and
  byte counts. Each remains **1920 × 3416**; total **27,754,120 bytes**.
- Created new Fashion project `9a007761-0a29-4dbc-9365-b89fd102e77c`, slug
  `circle-of-fashion`. Its first image is the cover and the other nine are ordered
  gallery items. The exact source introduction is the excerpt; no PHASSION assets
  or invented project text were added.
- Native private preview passed at revision **1**. Its approval was bound to the
  project ID, edit revision, full planned-field digest and release-manifest hash.
  Native publication then completed at revision **2**; no hardcoded public data,
  verification bypass or schema change was introduced.
- A fresh pre-publication snapshot and post-promotion comparisons confirm all
  prior **2 posts, 2 Video projects, 1 Fashion project and 23 Media records** are
  unchanged. Prior media privacy is unchanged; the existing Fashion selection and
  Video drafts remain private. Read-only SQL confirmed exactly ten stored native
  publication-media references; REST intentionally omits this hidden field.

### Exact application scope

Promoted deployment **`dpl_9ncY5tyxrH4aJ27VkfTFHR9q1pWZ`** from the isolated
`.local/fashion-production-20261106/release-9bc/`, based on the freshly verified
then-current production **`dpl_9BCvNXNg1nmLSUyppiuJvUoQcoen`**. Guards stopped
earlier attempts when other deployments landed; no newer release was overwritten.

All **203 deployed source SHA-1s** matched the frozen release: **198 existing
files unchanged**, four modified files and one added stylesheet:

- `components/projects/Projects.tsx`
- `components/cms/ProjectPreview.tsx`
- `app/(website)/fashion/[slug]/page.tsx`
- `readme.md`
- Added `components/projects/fashion.css`.

This release retains live **Jost/Nunito Sans and black/tan styling**, the existing
MMCQ palette rollout and the latest original-video/retry support. The earlier
local P22/pastel previews are not the deployed visual identity. Homepage,
newsletter, pending font work and broader main-checkout changes remain excluded.
The Fashion column is category-scoped; the more specific
`.journal-article.journal-article--fashion` selector prevents the desktop CMS
stylesheet from restoring the old 880px width.

### Gateway correction, independently applied

Private staged image requests exposed the existing Arnaud gateway's 30-client
admission limit (`max_client_conn`), not corrupt image bytes. With separate owner
approval, only four PgBouncer frontend-client limits changed **30 → 120**.
PostgreSQL backends remain capped at **six**, reserve remains **zero**, and the
per-source Traefik limit remains **30**. No shared database settings, grants,
passwords, TLS, routing, ports, image or resource limits changed.

Applied the canonical `deploy/cms/gateway/pgbouncer.ini` using an exact old-hash
guard, private backup, atomic replacement and SIGHUP of the one named Arnaud
pooler. PID/start time and authentication-file hashes stayed unchanged; no service
restart occurred. The host backup is
`/home/dextery/.local/share/arnaud-cms-gateway/pgbouncer.ini.before-fashion-20261106`.
This is independent of Vercel: the frozen application archive retains its baseline
infrastructure files; the owning repository's gateway config is the active source.

Verification held **36 unauthenticated SCRAM challenges** concurrently; this is
admission evidence, not a 36-query authenticated load test. Forbidden identities,
direct database access and the pooler console were denied. Three gateway config
tests passed. After promotion the gateway was healthy, runtime backend sessions
were **2 ≤ 6**, memory was **1.023 MiB / 128 MiB**, and live config/auth hashes
still matched the approved correction. See
[`../deploy/cms/gateway/README.md`](../deploy/cms/gateway/README.md).

### Acceptance and cleanup

- Scoped release lint and typecheck passed; the staged production build was
  **READY**, and 36 CMS tests passed. Three gateway boundary tests also passed.
- Private preview, staged anonymous page and final canonical page passed in Chrome
  at **390px and 1440px**: exact introduction once, ten ordered decoded images,
  natural uncropped ratios, centered **350px/672px** columns, real Jost/Nunito
  glyphs, visible keyboard focus, no overflow/page errors and Fashion-index return.
- Independent read-only review opened all four staged public screenshots and
  returned **SHIP**, with the earlier desktop-width finding resolved.
- Canonical alias matched the promoted deployment before and after final HTTP
  acceptance. `/`, `/blog`, `/video`, `/fashion` and the new project returned 200;
  existing draft/unknown project routes returned 404, anonymous identity returned
  401 and the private-preview browser reached `/cms/login` without draft content.
  The admin shell can stream that login transition with HTTP 200, so acceptance
  checks the browser destination rather than assuming an HTTP redirect status.
- Final anonymous downloads of all ten originals again matched source hashes and
  sizes. The current deployment's queried error/fatal runtime-log window
  (`2026-11-07T02:17:56Z`–`02:32:56Z`) returned no entries; this is a bounded check,
  not a guarantee about future traffic.
- Revoked only this task's temporary existing-admin session at
  `2026-11-07T02:32:34Z`; other sessions survived, and its token artifact was removed
  and independently checked absent. No account or permission changes were made.

Receipts, source hashes and screenshots remain ignored under
`.local/fashion-production-20261106/`. The earlier unpromoted staging attempt is
retained separately. **No commit or push was made.** This is not a whole-site
accessibility audit or physical-device/Safari acceptance. Application rollback
does not undo CMS publication: the prior 9BC deployment would restore the old
layout while Circle of Fashion remains published. Content changes require their
own native CMS action and authorization; do not rerun import or publication.
