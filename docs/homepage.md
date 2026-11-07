# Homepage: fluid scene and Payload settings

**Full-rollout follow-up:** the owner has now explicitly approved the complete
checkout deployment and both additive migrations after backup/rehearsal. See
[`full-site-rollout-20261107.md`](full-site-rollout-20261107.md) for the approval,
verification and actual production outcome. The local-only boundary below records
the original implementation stage, not a revocation of that later approval.

## Status and scope

Local application source only. No production migration, publication, storage
mutation or deployment is authorized by this change. The homepage builds on the
existing local public site expansion. Photography, Journal, Video/Fashion detail
pages and the native CMS theme remain independent.

## Editing

Open **Payload → Site settings → Homepage**. Four fixed slots keep the real section
destinations (`/photos`, `/blog`, `/video`, `/fashion`); they do not become arbitrary
external links or point to the preview image's individual detail page.

Each slot has three source choices:

- **Text link only:** keep its section label without an image. Old inactive choices
  may remain in the editor, but do not authorize Media access or public display.
- **Published photograph:** choose a catalogue thumbnail, never enter a UUID or
  file URL. Publication verifies that the photograph still exists and has alt text.
- **Media library:** choose/upload a verified image using the existing native upload
  workflow. Image MIME type and alt text are checked at publication. Originals
  remain immutable; replacing an original means selecting a new Media item.

The palette has three six-digit hex fields, each with a colour picker:

| Role | Initial value |
| --- | --- |
| Fluid colour A | `#ff278f` |
| Fluid colour B | `#ffe52f` |
| Background / filler | `#c8e6ff` |

Palette roles drive both the shader and CSS fallback. Labels/name/intro use the
solid filler with automatically selected black/white text for contrast, rather
than depending on the pigment passing behind them. Invalid CSS strings are never
interpolated into the public background.

Native private drafts, autosave, optimistic edit revisions and historical recovery
remain in force. **Publish changes** updates the images and palette as one settings
snapshot. Recovery creates a private draft, not an implicit public rollback.

## Media boundaries

The settings hook derives `mediaReferences` from active image selections and
ambient audio, not a client-supplied reference list. Anonymous native Media reads
already union current published Journal/project/settings references; homepage
selections reuse that mechanism. Draft/old-version-only selections do not expose
files. A removed image remains public if another published resource references it;
previously issued signed downloads can remain valid for their existing 60-second
lifetime. Catalogue photographs are already public: selecting/clearing one here
does not change catalogue publication or storage.

The public settings mapper exposes only verified image metadata and existing
access-checked file URLs. Storage keys, signed provider URLs and checksums are not
serialized. The catalogue picker endpoint requires the current Arnaud CMS identity
and returns a private, no-store response. No new identity, R2 bucket, Worker route
or upload credential is introduced.

## Renderer

`components/site-effects/HomeFluid.tsx` dynamically imports
`lib/visual/fluid-renderer.ts` only for `/`. It replaces the old home atmosphere;
the two canvases never stack. The solver adapts Pavel Dobryakov's MIT-licensed
WebGL Fluid Simulation; the full notice is retained in the renderer source.
There is no upstream GUI, analytics, advertising, remote runtime script or iframe.

The GPU solver has advected velocity/dye, curl/vorticity, pressure projection and
cursor impulses. It stores two pigment weights, compositing them over the selected
filler rather than additively bleaching a light background. Defaults: simulation
short side 112, dye short side 384 (long sides capped at 768), 14 pressure passes,
pixel ratio at most 1.5 and at most 2 million display pixels. It uses the existing
Three.js dependency; no package or lockfile change is required.

Non-touch pointer movement stirs the background without a button press. Native
cursor and link behaviour remain unchanged. Touch scroll is never captured.
Hidden tabs stop the render loop; route departure disposes GPU targets/materials
and listeners. Context loss hides the canvas; restoration initializes a fresh
solver. Reduced motion skips the solver entirely and uses static CSS. WebGL or
floating-point-target failure keeps that same static fallback.

Desktop uses an irregular grid with four different image scales. Mobile becomes
a staggered document flow; nothing relies on absolute viewport coordinates or
fixed body overflow. Image errors keep a working labelled section-link.

## Migration and release gate

`20261105_120000_homepage` adds optional homepage fields to `site_settings` and its
version table, eight source enums and indexed native Media foreign keys. It does
not rewrite old settings/versions or alter shared schemas/grants. Defaults leave
all section slots text-only until explicitly configured. Existing legacy
`featuredPhotoId` data is retained, not silently repurposed as a new slot.

The owning generator is `scripts/cms/generate-homepage-migration.ts`. It clears
provider environment scope, never loads `.env`, and runs with DB connection and
initialization disabled. Its normal invocation creates new files exclusively;
`--artifacts-only` refreshes Payload types/import map without overwriting the
migration. Do not regenerate or edit an already-applied migration.

Before a separately approved release:

1. Back up Arnaud's current schema/settings/history using the owning native CMS
   runbook. Confirm the existing site-expansion migration/launch gates separately.
2. Apply the expansion migration first, then the homepage migration through the
   existing Arnaud-only migration role. Do not use the app runtime identity or
   automatic schema push.
3. Deploy the application only after compatible schema is present; do not enable
   the expansion against a pre-migration schema.
4. Select real section images in Payload, check alt text and the palette, then
   explicitly publish Site settings. Verify anonymous delivery, desktop/mobile,
   reduced motion and link destinations using the real content.

Rollback is an app rollback that leaves additive columns, versions and originals
intact. The migration's `down` intentionally refuses destructive reversal. Restore
an earlier private settings version and explicitly publish only when an editorial
rollback is intended. No rollback authorizes deleting native originals.

## Local verification

- `npm run lint`, `npm run typecheck`, `npm run test:site`, `npm run test:cms`,
  `npm run test:blog`.
- `npm run build` with CMS/expansion/newsletter disabled and public provider scope
  cleared validates production compilation without a production database.
- `npm run test:cms:disabled` then checks actual production routes fail closed.
- Start `node --import tsx scripts/cms/site-expansion-fixture.ts`, then run
  `node scripts/cms/verify-homepage-browser.mjs` and
  `node scripts/cms/verify-site-expansion-browser.mjs`. The existing scripts accept
  `PLAYWRIGHT_MODULE` when Playwright is installed outside this repository.

The fixture is memory-only, blocks outbound traffic and uses synthetic Auth,
catalogue and native Media metadata. Browser interception supplies the existing
`public/test-image.jpg`; a derived portrait crop is test-only and never ships.
Evidence goes under `.local/homepage-browser/`. These checks do not certify real
content selection, real Media transfer, real film playback or production rollout.

The final targeted homepage run passed all ten checks with no browser errors,
including context loss/restoration and native Payload autosave/thumbnail selection/
Publish. Lint, typecheck, site/CMS/blog tests, the disabled-feature production build
and CMS-disabled route checks passed. Independent finish review returned **ship**
for supplied synthetic captures and source; the exact-home-only styling correction
was separately scored resolved. The broader existing site-expansion browser suite
still aborts while navigating to `/blog/synthetic-journal-study`; full-site browser
regression was **not passed at that checkpoint**. Before the owner-approved full
rollout, a fresh isolated fixture passed all 49 broader site cases, ten homepage/CMS
cases and seven anonymous API-boundary checks. The earlier Journal navigation
abort did not reproduce; no application fix was justified. These remain synthetic
checks, not physical Safari/iOS or production-content acceptance. Unrelated
concurrent palette/upload work was preserved.
