# Portfolio intake — 2026-11-06

This records the **initial image/category release**, not the latest production
state. The owner subsequently approved original-video implementation/upload: all
three masters are now verified private Media attached to their existing drafts.
Current video release `dpl_9BCvNXNg1nmLSUyppiuJvUoQcoen` preserves the independent
MMCQ release. See [`original-video-support-plan.md`](original-video-support-plan.md)
for completed video checks, source provenance, cleanup and Safari/iOS limitations.
Historical counts and the original deferral below describe this initial intake.

## Completed production scope

The owner approved enabling **Video/Fashion only**, publishing eight standalone
photographs, and retaining Fashion/Video material as private drafts. Original-video
support was requested as a **plan**, not an upload or encoding operation. A
temporary session for the existing configured Arnaud admin was separately approved.

Live release: `dpl_BPRvSrJzRqsBgFEFP47s2QY33hyn` at
`https://arnaud-belec.vercel.app`. This is an isolated category-only release,
**not the current main checkout**. Pending homepage, P22 font, MMCQ palette,
newsletter, global-settings and other visual changes were not deployed.
The live photography archive remains at `/`; existing photograph URLs survive.
Video/Fashion use minimal Journal-styled index/detail pages and remain empty
publicly because their projects are drafts.

## Imported material

Source: `/Volumes/A044/arnaud portfolio`. No source file was modified, compressed,
remuxed, renamed or deleted. The AppleDouble `._...` sidecar was excluded.

| Destination | Imported | Publication |
| --- | ---: | --- |
| Photography | 8 originals | Public; catalogue now 16 |
| Fashion | 11 image originals | One private working-selection draft |
| Video | 7 film stills + 1 poster | Private `To Hang by a Thread` draft, year 2025 |
| Video | `Lullaby - 1min Visualizer` draft | Private title-only placeholder; no film uploaded |

The Fashion working title is **Fashion — portfolio selection**, not an asserted
collection name or credit. Its first image is the cover; the other ten form its
gallery. The film poster is the Video cover, with seven ordered `C0240...` stills
in its gallery. No credits or meanings for OVES/VOSF were invented. Review/edit
these projects under `/cms/collections/fashion-projects` and
`/cms/collections/videos`; private previews use `/cms/project-preview`.

New public photograph filenames:

```text
000022960007.jpg
000022960030.jpg
AA017.jpg
AA025.png
DSC02897.jpg
DSC02917.jpg
DSC02930.jpg
will in living.png
```

The eight supplied `Still 2026-05-02 ...` concert images were skipped: downloaded
published originals match their source SHA-256 and byte counts exactly. No existing
photograph or palette row was updated. Photograph imports used the exact released
`oklab-kmedoids-chroma-background-v2` analyser, seven colours and 96px samples;
the pending MMCQ migration/analyser was not used. The upload provider remains
**Supabase** for the eight new photographs; the prior eight still deliver from R2.

All 19 project images used the deployed native Media signing/direct-upload/receipt
workflow. Server verification and full authorized original read-back matched each
supplied SHA-256/byte count. They remain physically private in
`arnaudbelec-staging/journal-native/`, with no public promotion or manual verified
metadata injection. Existing native Media rose from one to 20 items.

## Release and migration provenance

- Baseline: exact live native-CMS archive, SHA-256
  `420b6d3a08bb23625fabec639f019c0252cd3c98378fce54bf3f647d4361929c`.
- Category source archive: 174 files, SHA-256
  `d446e9c29d6d43e7bf597b2bfe254b69bd5e538525d55c9a3b70d0bc81ae691e`.
  Compared with baseline: 149 identical, nine modified, 16 added, no deletions.
- Vercel dry run matched every deployable source hash: 173 files, with `.gitignore`
  omitted by Vercel and an empty directory additionally listed.
- Applied only `20261104_110000_portfolio_categories`: eight category/version/
  relation tables and two nullable shared-lock relationships. Migration TS SHA-256
  `5816268c847c104ea32b0cfedefa9fcf6c5f679bed4410516c9a8e3ab33c5613`.
- Existing `arnaud_cms_migrator` connected through private loopback-only SSH
  forwarding and assumed `arnaud_cms_owner`; the runtime gateway was not used for
  DDL or reconfigured. Runtime DML grants passed; `anon`/`authenticated` DML remained
  denied. No shared identity/authorization migration occurred.
- Production `ARNAUD_SITE_EXPANSION_ENABLED=true` enables this release's two
  collections. **It does not establish readiness for deploying main's full model.**
  Main still requires the remaining expansion and homepage migrations, separate
  approval and its other release gates.
- Main's still-unapplied `20261104_120000_site_expansion.ts` is now the remaining
  category-snapshot → frozen original-expansion-snapshot diff. The original full
  JSON snapshot and later homepage migration remain unchanged. Ordered migration
  fixtures/tests now include the category checkpoint. The schema-only generator
  accepts an optional output path and never overwrites snapshots/SQL implicitly.

The scoped release was built from its isolated worktree, staged without switching
the production alias, read back, then promoted. Existing automation protection
bypass was reused for staged inspection; no bypass was created and protection was
not disabled. No Git commit or push was performed.

## Preservation and acceptance

- Native-content backup restored successfully into network-disabled, memory-only
  PostgreSQL 15.8 using the production image. All 12 original native table
  fingerprints matched. The actual category migration then preserved every old
  native row/column value in that restored data.
- A fresh native backup was captured immediately before production migration.
  The initial combined dump command's table selectors excluded native schema
  objects; this was detected by restore verification before migration and corrected
  with a separate full native-schema dump. Do not treat the original public-table
  dump as a native backup.
- Production preservation comparison passed for all eight prior photograph rows,
  all eight analyses, 56 palette rows, both Journal posts, four versions, the
  original Media item, CMS identity, preferences and locks.
- Final catalogue: 16 photographs, 16 legacy-compatible analyses, 112 palette rows.
  Native content: two unchanged Journal posts, 20 Media items, two private Video
  projects and one private Fashion project. No project was published; all film
  fields remain null. No settings/newsletter tables or their migrations appeared.
- Every new public photo passed full original-byte read-back. Every private image
  passed server hash/size verification, full authorized original read-back and
  anonymous denial. Private project detail URLs returned 404 anonymously; anonymous
  `draft=true` requests did not expose drafts.
- Scoped source: lint/typecheck, 60 automated tests, enabled/disabled Webpack
  builds and disabled-route checks passed; independent review passed 13 focused
  security/lifecycle tests with no blocking findings.
- Main migration reconciliation: lint/typecheck, 43 CMS tests, 35 site tests and
  both isolated production-build modes passed. The final populated-checkpoint and
  newsletter migration subset passed 20 tests, including preserving category draft
  rows, history and links through the remaining expansion.
- Real production browser acceptance passed 30 route/preview checks at 390px and
  1440px with no page exceptions/overflow; every one of the 19 private images
  decoded in its authenticated preview at both widths. Captures were inspected.
  No original-video upload or playback acceptance is claimed.
- The temporary import session was revoked with **local scope only**; Auth
  read-back confirmed its removal and preservation of all 16 prior sessions. Its
  newly created token artifact was removed. No email/password/permission changes
  were made, and no email was sent.
- Final anonymous read-back still exposes zero projects (including `draft=true`)
  and only the original published Journal Media reference. All 35 source images
  were rehashed unchanged; the three video byte counts were rechecked, without
  claiming full video hashes. The owned ephemeral restore container and loopback
  SSH tunnel were removed/stopped; no production service or volume was removed.

Private operational receipts/backups/contact sheets are retained under the ignored
`.local/portfolio-intake-20261106-1794003789145/`; no bearer token or signed URL is
required in this document. Source/release manifests remain in the isolated
`arnaud-content-intake-release` worktree for reproducibility and review.

## Originally deferred masters — subsequently completed

No MP4 was transferred by this initial image intake. Subsequent explicit owner
approval enabled the operator-first original-quality path and all three uploads,
including both >5 GiB cuts. They remain unchanged on the supplied drive and private
in R2; the normal 100 MiB native uploader remains unchanged. See
[`original-video-support-plan.md`](original-video-support-plan.md) for completion.

Rollback of the category software must preserve the additive schema, project
drafts and private originals. Disabling categories can gate new access; it does not
authorize deleting data or reversing the separately approved photograph publication.
