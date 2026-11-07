
# Arnaud Belec

**Full-site rollout approved:** the owner requested committing all local changes,
confirmed P22 web-use licensing and approved the two pending additive CMS
migrations after backup/rehearsal. Validation and populated-data rehearsal passed;
see [`docs/full-site-rollout-20261107.md`](docs/full-site-rollout-20261107.md) for
production migration/deployment status. Preserve Circle of Fashion's existing
publication and all other draft/publication boundaries; newsletter sending remains
disabled. The scoped-release history below is not the full-rollout receipt.

**Production content intake (2026-11-06):** the scoped Video/Fashion release is
live, with eight new public photographs (16 total), 11 private Fashion images and
eight private film images attached to drafts in the native CMS. The subsequently
approved original-video intake uploaded and fully checksum-verified all three
masters (16,205,649,755 bytes), without compression or publication. Lullaby is its
existing draft's film; To Hang retains labelled OVES/VOSF uploads in its draft body,
without a preferred cut. The supplied originals remain untouched.
This intake release excluded the pending homepage/font/newsletter expansion below;
the subsequent palette-only MMCQ deployment/backfill is recorded below. The
production photography remains at `/`. See
[`docs/portfolio-intake-20261106.md`](docs/portfolio-intake-20261106.md) for release,
migration order, storage/preservation checks and draft locations, and
[`docs/original-video-support-plan.md`](docs/original-video-support-plan.md) for
the completed original-quality rollout and remaining Safari/iOS limitation.
Video baseline `dpl_9BCvNXNg1nmLSUyppiuJvUoQcoen` preserves the independent
MMCQ deployment. The subsequent Fashion-only release
`dpl_9ncY5tyxrH4aJ27VkfTFHR9q1pWZ` retains that exact video/palette behavior;
homepage/font/newsletter work remains excluded. The operator-only
8 GiB importer and private recovery journal leave normal Media's 100 MiB uploader
unchanged; see [`docs/large-original-operator.md`](docs/large-original-operator.md).
Native playback retains 60-second capabilities with bounded authorized recovery.
Six real Chrome desktop/narrow playback cases and an actual-expiry seek passed;
these are not physical mobile/Safari tests. Do not deploy main's full expansion
against the category-only production schema plus the additive raw import journal.

## Development

**Adobe Portfolio intake preparation:** `scripts/portfolio/prepare.mjs` builds a
local-only, duplicate-aware scrape bundle with source text/credits and proposed
CMS destinations. It does not upload or publish. See
[`docs/adobe-portfolio-intake.md`](docs/adobe-portfolio-intake.md) for commands,
duplicate-review limits and the separate CMS/publication gates.

Use Node **24.22.1** (`.nvmrc`; Payload also supports `^22.23.4`), then run `npm install` and `npm run dev`. Open the local URL shown in the terminal. The source now has a separate homepage at `/` and the photography archive at `/photos`; existing `/photos/<filename>` links are unchanged. The expansion is a local source update, not a production deployment. An empty catalogue produces explicit empty states rather than presenting `public/test-image.jpg` as published work; that existing asset is retained for local synthetic fixtures.

The page uses Tailwind CSS v4 utilities and Motion to drift the central photo's extracted palette colours around the photo (up to seven in the new MMCQ model below). Each gradient starts outside the photo on page load, with random candidates chosen across the free area and spaced from gradients already placed; its size still depends only on its palette weight. The entire archive page, including the gallery, uses a subdued background extracted from the central photo's dominant edge colour. Each detail page uses its own photo's background colour throughout. Text and focus indicators adjust for light or dark backgrounds. The central photo and detail-page photo keep their original aspect ratios within a 66.667vw-wide frame (viewport width minus 32px on small screens) and an 80vh height limit. Their measured size drives the moving gradients' collision bounds as the viewport or photo changes. Each gradient's diameter is set by its palette weight: an equal share of the actual palette is 100vw, with smaller shares shrinking toward 75vw and larger shares growing toward 125vw; a single-colour palette stays at 100vw. The archive and detail pages render their palette gradients and animated monochrome grain in one Three.js/WebGL canvas below the opaque photographs and HTML controls, keeping photographs sharp. The colour wash can spill into the gallery below the hero section, while the gradient centers remain constrained to the hero section and avoid the photo. Selecting a colour ranks the gallery below by similarity to that swatch: it shows every photo within the colour-distance threshold, or fills with the closest eligible photos to reach five when available. It does not change the central displayed photo. Clicking the central photo or a gallery thumbnail opens its `/photos/<filename>` page. Each detail page shows that photograph with its own moving palette gradients and photographs ranked by colour similarity; selecting a gradient uses the same five-result minimum, and clicking the full photograph restores the full palette. The photographer name links back to the archive at `/`. `app/globals.css` holds the fallback glow utility.

## Palette extraction — deployed and backfilled

The source adopts Elliot's **MMCQ64 + vibrancy/diversity scoring**, adapted for
Arnaud's background exclusion and **up to seven genuine colours**. Flat and simple
photographs can have fewer swatches; deployed archive/detail gradients and CIELAB
matching use the actual count without fabricated filler colours. The source-only
audio/drag/homepage expansion is not part of this palette release.

On 2026-11-06, the palette-only application was deployed as
`dpl_C6pjaSz3JYLw8c56hGsno7uweHZe` on the exact current CMS/projects baseline, and
all **16 photographs** were backfilled from verified originals. Both compatibility
migration `20261105000000` and safe-update-compatible scoped-delete follow-up
`20261106000000` are applied. All current photographs yield seven genuine colours;
saved backgrounds, full photograph metadata/timestamps, originals and storage
providers are unchanged. The live archive remains `/`.

The guarded `photos:reanalyze` command defaults to **help only**, not production
writes. Read [`docs/palette-extraction.md`](docs/palette-extraction.md) for pinned
backups, verification, exact rollback and rollout evidence. Its active run is
`frozen-run-scoped/`; older eight-photo and pre-follow-up artifacts are stale.
Local `.env.local` service-role credentials remain stale; the authorized rollout
used the current server key in a private process without displaying/persisting it
or changing configuration. Do not retry operations with old artifacts or credentials.

## Palette gradients and grain

On `/photos` and photograph detail pages, each orb has a small circular pointer,
hover and drag target around its visible light (at least 44 CSS pixels wide),
rather than a viewport-sized target across its gradient. Drag with mouse, pen or
touch to move the orb and its colour wash; it pauses while held and resumes its
gentle drift from the released position. Its centre stays inside the hero and
outside the photograph. Movement of 6 CSS pixels or more counts as a drag and
does not select a colour or play its opt-in chord. A click/tap still toggles colour
selection on release, and Enter/Space retain button activation. Touch scrolling
remains native outside these small targets. Reduced motion permits direct dragging
but keeps automatic drift disabled. Neither positions nor drag state are persisted.

For the isolated orb regression, start `node scripts/orbs-fixture.mjs`, then run
`node scripts/verify-orbs-browser.mjs` in another terminal (requires Playwright
and Chrome; `PLAYWRIGHT_MODULE` can point to an externally installed Playwright
module). The fixture disables CMS/expansion, never reads `.env`, and blocks
external services; its catalogue and browser images are synthetic. The regression
covers both photo routes at 390/1440px with WebGL, CSS fallback and reduced motion;
screenshots/results go to ignored `.local/orbs-browser/`. Stop the fixture afterward.

The photo fragment shader and grain constants now live in
`lib/visual/bloom-shader.ts`, shared by the native photo renderer and
`components/site-effects/PublicAtmosphere.tsx`. The tuning reference to
`app/bloom-renderer.ts` below describes the original location; change the shared
module for future filter tuning. The extraction preserves the photo shader output.

Main photographs and gallery thumbnails show an inline placeholder in their
stored edge-background colour while loading, then replace it with the full image
once loaded. Photographs without an extracted background use a neutral fallback.
The placeholder needs no extra image request and preserves the image dimensions.

`app/bloom-layer.tsx` loads `app/bloom-renderer.ts` on the client after mount. The renderer uses a single full-screen plane and shader, with the existing Motion orb positions, palette weights, and selected-colour expansion. Selecting a gradient moves it to the top of a persistent colour stack in both WebGL and the CSS fallback, preserving the relative order of the other gradients. Deselecting only reverses its expansion; its stack position remains unchanged. Selecting an earlier gradient brings it back to the top without duplicating it. The stack lasts for the mounted page and resets when the layer remounts. The fixed canvas tracks the hero’s position during scrolling so its colour wash continues into the gallery. It composites palette colours in sRGB, adds monochrome noise in linear light, screens the pixel-art orb light directly onto the finished gradient image, and applies output dithering to reduce banding. Photographs and orb controls remain HTML above the canvas.

Tune `GRAIN_STRENGTH` (default `0.035`), `GRAIN_SIZE` (default `1` CSS pixel), and `GRAIN_SPEED` (default `1`) in `app/bloom-renderer.ts`. The effect is inspired by the screen shader on [bur1alrites’ threejs branch](https://github.com/TheTexta/bur1alrites/tree/threejs); grain fades near black to preserve dark backgrounds. The shader supplies smooth gradient falloffs directly; it does not use a bloom postprocessing pass. Each selectable colour orb uses four CSS pixels per grain cell, a pixelated glow, and a soft outer light. Its pixels run from white at the centre through the palette colour at the original midpoint, then fade exponentially to transparent over 2.5 times the previous outer distance; the large gradient it follows is unchanged. The fade reaches zero at the existing outer edge. Its palette-weight scaling remains the same, from 75% to 125% of the baseline; selection grows that shape another 1.5 times without enlarging the grain cells. Each orb also pulses by roughly 5–7% on its own phase and speed, around 0.9 Hz at the baseline size, with smaller orbs pulsing faster; reduced motion disables the pulse. One screen-space, four-CSS-pixel cell grid is shared by all the orbs for both their shape and noise, with the noise refreshed every 60 ms. WebGL applies the shared noise to each orb colour before screening it onto the composed gradients; the HTML fallback aligns its orb canvases to the same grid and also applies noise before CSS screen blending. The background grain remains separate. Reduced motion freezes the orb noise.

Rendering is capped at a pixel ratio of `1.5` and 2.5 million drawing-buffer pixels. Hidden tabs skip rendering. Reduced motion freezes the grain and orb motion, makes selection changes immediate, and redraws only when the scene or viewport changes. Existing CSS gradients remain visible while the shader loads, when WebGL is unavailable, or during context loss; rendering resumes after context restoration. Renderer resources are disposed when the layer unmounts. No backend or environment changes are required.

## Photograph storage

### R2 delivery and staged uploads

All eight production photographs now use checksum-verified R2 originals;
Supabase originals are retained for rollback. The application supports
per-photograph Supabase/R2 delivery and opt-in R2 admin/CLI uploads.
**New uploads still default to Supabase; admin setup and authenticated R2
publication testing are deferred.** R2 uses published `arnaudbelec` and private
`arnaudbelec-staging`, with shared Worker delivery under `/arnaudbelec/`.
Supabase still owns Auth, catalogue metadata and palettes. See
[`docs/r2-storage.md`](docs/r2-storage.md) for required SQL/configuration,
provisioning/CORS, checksum-verified migration commands, resumable upload
recovery, rollout gates and rollback limitations. Run `npm run test:storage`
for local storage and isolated Postgres migration/security checks.

### Legacy Supabase workflow (new-upload default)

The Coolify-managed Supabase instance at `https://api.dextery.dev` has a separate public Storage bucket named `arnaudbelec`. It accepts JPEG, PNG, and WebP images up to 500 MiB. The tables `public.arnaud_photographs`, `public.arnaud_photo_palette_analyses`, and `public.arnaud_photo_palette_colours` store Arnaud's image metadata and seven-colour analysis separately from Elliot's catalogue. The initial schema is in `supabase/migrations/20260923062000_create_arnaud_photographs.sql`; `supabase/migrations/20260923150000_expand_arnaud_palette_to_seven.sql` expands the rank constraint, requires seven colours for new imports, and adds an atomic palette replacement RPC. `supabase/migrations/20260923211500_use_oklab_kmedoids.sql` requires the OKLab k-medoids extractor. `supabase/migrations/20260923220600_add_edge_background_colour.sql` adds `arnaud_photographs.background_hex` and requires the background colour in both write RPCs. `supabase/migrations/20260928220000_exclude_background_from_arnaud_palette.sql` accepts the background-aware palette algorithm in both write RPCs. Apply these migrations in order on new instances.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the ignored `.env.local` file to show imported images on the site. Get the keys from Supabase Studio at `https://studio.dextery.dev`. The local setup and import scripts also load `.env.local`; they need `SUPABASE_SERVICE_ROLE_KEY` and use `SUPABASE_URL` or fall back to `NEXT_PUBLIC_SUPABASE_URL`. Keep the service-role key in `.env.local` or your local shell; never expose it through a `NEXT_PUBLIC_` variable or commit it.

The site reads the published photograph catalogue first, including each photograph's stored palette in analysis rank order for the gradients and colour filtering. Both legacy seven-colour and new 1–7-colour analyses remain readable. If the catalogue is empty, it can still show public objects found in the `arnaudbelec/uploads` bucket, but those bucket-only objects do not have colour analysis until they are imported with the publish workflow below. Files uploaded at the bucket root are not shown directly; the current photographs were copied to canonical `uploads/<uuid>.jpg` paths, analysed, and published while their original root objects were retained.

The bucket is already provisioned on the current server, and `npm run storage:setup` verifies its settings or creates it on a new instance. Analyze an image locally before upload with `npm run photos:import -- --dry-run path/to/photo.jpg`, then publish with `npm run photos:import -- path/to/photo.jpg`. Multiple file paths are supported.

### Shared admin

The upload panel is at `/admin`. Create a Supabase Auth user in Studio, then put that user's UUID in the server-only `SUPABASE_ADMIN_USER_IDS` environment variable. Separate multiple UUIDs with commas. The panel has no public sign-up flow, and every admin API request verifies its Supabase access token with Auth and checks this allowlist. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the deployed environment as well as `.env.local` for local development. `.env.example` lists the required variables. The service-role key must never use a `NEXT_PUBLIC_` prefix.

With `ARNAUD_CMS_ENABLED=true`, `/admin` routes to native `/cms`, which contains
Journal, Journal media and the existing protected Photographs tools. Supabase
remains the one identity provider and every request checks Arnaud's allowlist.
With CMS disabled, the original photography admin remains available; the retired
custom journal does not return. The client shell is never a security boundary.

Confirmed departure stops further preparation, transfer and publication in the
remaining photo batch, including work waiting on a preparation response. Recovery
tickets/objects are retained. A publication request already accepted by the server
may still complete; leaving the page does not roll back committed photographs.

With explicit owner approval, the requested confirmed Supabase Auth account was
added to Arnaud's production UUID allowlist on 2026-10-30 and activated in the
shared-admin deployment. No shared Auth metadata or other site's permissions were
changed. That admin release did not change R2 upload settings. Sign in at
`https://arnaud-belec.vercel.app/admin` with the existing Supabase email/password.

### Non-photograph styling

**Site-wide typography source update (2026-11-05; local only):** all routes now
use **P22 Cezanne Pro, cursive**, including public pages, `/photos` and photograph
details, controls, native `/cms`, administration and previews. One shared
`next/font/local` definition in `app/site-font.ts` exposes `--font-site`;
`app/site-font.css` maps the legacy display/text variables to it, and
`app/non-photo-fonts.ts` is a compatibility re-export. The Google font dependency
has been removed. Only Regular (400, normal) is supplied; `font-synthesis: none`
disables fabricated bold/italic faces without changing existing declared weights,
headings, themes, layout or palette/grain rendering. A subsequent targeted
readability correction sets public body/navigation/footer/intro to (20px/1.7),
captions/metadata to (18px), project reading text to (20px/1.8), sound status to
(18px/1.65), photo small-text roles to (18px/1.7), and native CMS body/operating
text to (20px/1.65). Journal dates/captions use (18px/1.7); legacy fields/buttons
use (20px). Existing heading sizes remain unchanged.

The owner's `/Users/dexteryoung/Downloads/p22-cezanne-pro/CezannePro.ttf` was copied
byte-for-byte to `app/fonts/cezanne-pro.ttf`, without conversion or subsetting.
SHA-256: `10779cdb3a7d5f8cc01f8a50a9cd82ccfdb2c8067ca16556c0124cc3112f8ca4`.
The supplied package contains no web licence; fsType 4 preview/print embedding
metadata does not establish web-use rights. **The owner explicitly confirmed the
web-use licence and approved this font for the full-site rollout.** See
`app/fonts/README.md`. Deployment acceptance is recorded separately below; no Git
push is implied. Earlier Jost/Nunito
browser checks are historical, not Cezanne acceptance; new implementation checks
belong in `docs/site-expansion.md`.

The implementation owner reports 49 strict P22 browser checks passed after the
readability fix at (390px) and (1440px), including photo/CMS-control custom glyphs.
Independent review reopened six captures and marked the specific readability
finding resolved, with ship limited to that finding—not full-site or production
acceptance. Full-rollout build/browser results are recorded with that deployment.

The following font-scope description records the pre-Cezanne implementation;
the dated site-wide typography update above supersedes it.

The public journal and private article preview take their black/tan direction from
Arnaud's old [Adobe Portfolio](https://arnaudnaudbel.myportfolio.com/). Its primary
faces are Futura PT and Proxima Nova; the approved open-source alternatives are
**Jost** and **Nunito Sans**, self-hosted with `next/font` only on these routes.
No Adobe font binaries or old-site background images are copied. Fonts/CSS are
scoped to non-photograph shells; photo pages retain their original styling.

**Admin theme source update (2026-11-04; not yet deployed):** native `/cms` uses
a black/white/neutral-grey theme, square controls and restrained spacing matching
the Dexter/Elliot admin direction.
**Automatic** follows the device's light/dark preference, including live changes.
The native account settings retain remembered **Light** and **Dark** overrides;
choosing Automatic removes the override. Login, Journal, Media and embedded
Photographs share this theme. Public pages and the article-preview canvas keep
their existing appearance. The CMS-disabled photography admin is unchanged.
Local theme coverage uses `scripts/cms/verify-theme-browser.mjs` with the isolated
fixture described in `docs/native-payload-journal.md`; no production login is needed.

Sign in with that Auth user's email and password, choose JPG, PNG, or WebP photographs, add optional title, alt text, capture date, and sort order, then select **Upload and publish**. Uploads go directly from the browser to the existing `arnaudbelec` bucket in resumable 6 MiB chunks using a short-lived signed upload token. The original files do not pass through Vercel. In the new source, the browser sends a bounded 256-pixel PNG sample for MMCQ palette analysis; the server also accepts already-open 96-pixel clients and records that smaller sampling setting honestly. Background analysis retains the existing 96-pixel edge method. The server checks the finished object and publishes its metadata through `arnaud_publish_photograph`. The admin path uses a supplied capture date or a `YYYYMMDD-` filename prefix; it does not read EXIF dates. Filenames must be unique in the published catalogue. If the connection fails after transfer, **Retry remaining uploads** reuses the completed upload while its ticket is valid. The server removes the uploaded object when it rejects publication; closing the browser before publishing can leave an unpublished object for an administrator to remove. Successful photographs appear on the live photo pages without a rebuild. The public catalogue, bucket, and CLI importer remain compatible; the new palette release requires the compatibility migration above. Run `npm run test:admin` for upload-ticket, sampling and input-validation checks.

After approval and application of the compatibility migration, use `npm run photos:reanalyze -- prepare --run=PRIVATE_NEW_DIRECTORY` to read and checksum every catalogue original and produce a local before/after comparison. Preparation never writes remote data and preserves saved backgrounds. Applying or rolling back requires the independently recorded run SHA-256, explicit project confirmation and exact frozen catalogue/palette/schema state. Both palette tables change in one transaction; photograph rows, timestamps, originals, reservations and other projects are untouched. The old bare-command writer and `--dry-run` invocation are replaced by the explicit workflow documented in `docs/palette-extraction.md`. Only explicit operator commands load the existing server-only `.env.local` credentials; default/help does not.

To set a different title, alt text, capture date, or sort order per image, pass `--manifest path/to/photos.json`. Its keys can be file paths or basenames:

```json
{
  "photo.jpg": {
    "title": "A photograph title",
    "altText": "Description of the photograph",
    "capturedAt": "2026-09-23",
    "sortOrder": 1
  }
}
```

The importer reads orientation and capture date from EXIF and now uses the same MMCQ analyser as uploads and original-file backfills, with an orientation-corrected sample up to 256 × 256 pixels and two quantisation phases. Each selected swatch is a colour observed in that sample, with noise rejection and minimum OKLab separation of 0.055. The separate background colour still uses the largest cluster from the outer 8% of a 96-pixel sample, with reduced chroma and unchanged OKLab lightness. Palette extraction excludes pixels within an OKLab distance of 0.08 from that background, then assigns the remaining population to its nearest selected swatches for gradient weights; selection scores are not weights. If no pixels remain, a uniform image keeps its original pixels. Transparent pixels are ignored; if the entire edge is transparent, the background extractor uses the opaque interior. Rank, RGB, hex, CIELAB for gallery matching and weight retain their existing fields; no separate OKLab database model is introduced. Original publication/cleanup and R2 recovery ordering are unchanged. Run `npm run test:palette` to check the extractors. The 16-photo production catalogue was backfilled with the verified, pinned run documented above.

## Journal / native Payload

The working source now uses **Payload 3.92.1's native Lexical editor**, drafts,
autosave, versions, publication state and Media collection. BlockNote and the
legacy dual-write/publication model are removed. Supabase Auth and the existing
restricted connection to self-hosted Coolify PostgreSQL are retained; no Supabase
Cloud or second identity system is introduced.

**Deployed on 2026-11-03** after the owner-approved complete journal reset, native
schema migration, Arnaud-only runtime credential rotation and staging CORS update.
All three old posts, their histories/CMS copies and six legacy journal R2 objects
were removed. Photography, palettes, Auth identities and unrelated local photograph
edits were preserved.

**Live native acceptance passed on 2026-11-03:** real image/video/audio uploads,
the 100 MiB Vercel/R2 path, checksum/range playback, private autosave/restore,
publish/unpublish/republish, signed-download expiry and cookie refresh/logout.
The separately approved temporary public test was unpublished, then its one post,
13 versions, four media records and four R2 originals were removed with exact
identity/hash guards. The existing user draft/media and non-test originals were
preserved; subsequent real editorial content is not a cleanup target. Temporary
session/cleanup credentials were revoked and their generated secret files removed.
Empty legacy-table retirement and historical-backup purging still need separate
approval. No additional application deployment was needed for acceptance.

Native journal originals stay private under
`arnaudbelec-staging/journal-native/`, including when published. Native client
uploads bypass Vercel's body limit and do not require a manual parent-post Save.
Post publication performs no storage copy/download: published native references
authorize short-lived file redirects. The native upload hook verifies actual
bytes/format/size and records SHA-256. Originals are immutable; replacement means
a new Media item. The photograph upload provider remains unchanged.

See [`docs/native-payload-journal.md`](docs/native-payload-journal.md) for the full
architecture, private media behavior, exact reset/retirement commands, cutover
ordering, limitations and local/browser acceptance. Use `npm run test:cms`,
`npm run test:blog`, lint, typecheck and build. `npm run cms:reset-journal` is
read-only by default and requires an exact reviewed manifest hash for mutations;
its reviewed one-time reset was executed during this cutover. Do not rerun it
against the migrated native schema or treat it as a general CMS deletion command.

<details>
<summary>Historical BlockNote rollout notes — superseded, not current setup</summary>

### Previous Payload/BlockNote administration

Payload 3.92.1 is implemented at `/cms`, with the existing BlockNote JSON editor,
native drafts/autosave/versions, a protected Photographs view, private preview,
and immutable imported legacy revision recovery. Supabase remains the only login
and the existing server UUID allowlist is checked on every request.

`ARNAUD_CMS_ENABLED` defaults off. When enabled, `/admin` redirects to `/cms` and
legacy journal-write APIs refuse writes; disabling it restores the previous
admin. The photograph frontend, storage provider, public journal loaders and
media gateway are unchanged. Route groups give Payload its own root layout;
existing page routes now live under `app/(website)/` without URL changes.

Payload uses `arnaud_cms` in the **same Postgres database** as the legacy journal.
Each native save/publish/restore updates both stores in one database transaction.
Automatic schema pushing, database creation and destructive down migrations are
disabled. Do not point it at a separate database or run migrations during builds.

See [`docs/payload-cutover.md`](docs/payload-cutover.md) for isolated local setup,
environment variables, import/report commands, production scope, acceptance gates
and non-destructive rollback. Run `npm run test:cms` in addition to the existing
tests. **Payload is live at `/cms` as of 2026-11-02**, with `/admin` routing there.
The owner-approved Vercel/TLS-gateway migration preserved two drafts, 11 exact
legacy revisions and three private media records without publishing/deleting
content. Arnaud-only native backup/restore, real database-role/import/concurrency
and verified TLS/isolation checks passed; existing project access is preserved.
Full shared-Supabase disaster recovery remains unverified and was explicitly not
required for this cutover. Final real signed-in CMS/media acceptance remains a
human check. See `deploy/cms/gateway/README.md` for deployment/maintenance details.

The 2026-11-02 upload correction is deployed: media callbacks now use the new post
ID after its first save without reopening the editor or losing writing. Reload
an already-open CMS tab to receive the fix. The local-only browser
regression is `node scripts/cms/verify-editor-browser.mjs` (requires Playwright;
set `PLAYWRIGHT_MODULE` if installed elsewhere). It checks desktop/mobile uploads
after the initial save without connecting to production services.

A deployed follow-up removes the first manual Save requirement by preparing a
private draft automatically when New post opens. It also blocks Publish during
media transfer and displays actionable publication errors (such as a missing photo
caption), with a completed-upload status when verification finishes. Reload open
CMS tabs to receive it. Full CMS desktop/mobile lifecycle coverage is
`scripts/cms/verify-post-lifecycle-browser.mjs`, with the isolated setup documented
in `docs/payload-cutover.md`; it uses real local Payload saves but mocked storage.

The public journal is at `/blog`, with posts at `/blog/<slug>`. Private writing
is in the native Posts collection under `/cms`. It uses the same Supabase Auth
account and server-only admin allowlist; there is no new sign-up flow. The old
custom `/admin/posts` implementation remains part of the disabled-CMS rollback.
BlockNote loads only inside the authenticated writing view, not on public posts.

Posts support autosaved private drafts, private preview, saved-version recovery,
explicit publishing/unpublishing, and direct multipart image/video/audio uploads.
Published documents are separate snapshots: editing a live post does not expose
its new draft. Uploaded media stays in private R2 staging until verification and
publication. Blog media uses site-level access-checked redirects, not new shared
Worker routes or the existing photograph catalogue.

**Database and application deployed:** with owner approval, the blog migration
was applied to `api.dextery.dev` on 2026-10-30. Its source is
`supabase/migrations/20261030231725_create_arnaud_blog.sql`, aligned with the live
migration ledger. RLS/grants were verified, no blog content was created, and the
existing eight-photo catalogue was unchanged. On 2026-10-31, separately approved
journal uploads were enabled and deployed with
`ARNAUD_BLOG_UPLOADS_ENABLED=true`, owner-confirmed Arnaud-only R2 credentials,
and exact-origin staging CORS for PUT/GET/HEAD. The flag still defaults off for new
installations and is independent of `ARNAUD_UPLOAD_STORAGE`, which stays Supabase.
Legacy-admin signed-in image/video/audio uploads, autosave, private preview/playback,
checksum/range reads and anonymous denial passed; these do not replace live native
CMS acceptance. The private acceptance draft
and staging originals are retained; nothing was published or deleted. Public
media promotion/publish/unpublish and worst-case-size acceptance were not exercised.

In the editor, type **`/image`**, **`/video`**, or **`/audio`**, select the block and
choose a file. Supported formats are JPG, PNG, WebP, MP4, WebM, MP3, Ogg and WAV,
up to **100 MiB per file**. Keep the tab open during upload; reselect the same file
in the same post/tab to resume after a failed transfer.

Next.js, `@next/env`, and `eslint-config-next` are pinned to **16.4.3** for the
approved Next.js security fix. The remaining advisories were fixed with sharp
**0.35.5**, source-map-js **1.2.2**, and zod **4.6.7**. These patched versions remain
live. At that upload-release checkpoint, `npm audit --omit=dev` reported zero
production findings and the full audit reported 16 moderate development-tooling
findings rooted in minimatch. The later Payload dependency assessment is recorded
separately in `docs/payload-cutover.md`. No unrelated dependency upgrade was
bundled with upload enablement. See the journal runbook for release checkpoints.

See [`docs/blog-implementation.md`](docs/blog-implementation.md) for setup,
security, media/recovery behavior, and rollout checks. Run `npm run test:blog` for
document, route, storage, upload-resume, and isolated Postgres security checks.

</details>

## Homepage — local source, not deployed

The homepage is a compact, staggered scene of four image-links to Photography,
Journal, Video and Fashion over a cursor-driven fluid simulation. Pink/yellow
pigments and a pastel-blue filler are the defaults; images stay sharp above the
canvas. The current owner-supplied site font is retained. Section interiors keep
their existing rendering and palettes.

In **Payload → Site settings → Homepage**, choose each section's **Image source**:
Text link only, a published photograph using the thumbnail picker, or a verified
image from the native Media library. The three colour fields have a colour picker
and editable six-digit hex value. Clearing a selection never substitutes another
photograph. Save/autosave edits privately, then **Publish changes** to update the
public images and palette together. No rebuild is needed after publication.

This source requires the additive
`migrations/20261105_120000_homepage.ts` migration **after** the site expansion
migration. It has only been applied to isolated local test databases; production
migration, configuration and deployment require separate approval. See
[`docs/homepage.md`](docs/homepage.md) for validation, privacy and rollout details.

## Public portfolio expansion — local source, not deployed

**Circle of Fashion (2026-11-06; deployed exception):** live at
[`/fashion/circle-of-fashion`](https://arnaud-belec.vercel.app/fashion/circle-of-fashion).
All ten unchanged Adobe JPEGs and the exact source introduction were imported,
verified and published through the native CMS as a new project. The scoped release
uses a centred 672px column with ordered, uncropped photographs, preserving live
Jost/Nunito Sans, black/tan styling, Video and the MMCQ rollout—not main's pending
P22/homepage expansion. Mobile/desktop checks and full original hash read-backs
passed; existing records/draft privacy were preserved and the task's temporary
admin session was revoked. A separately approved Arnaud-only gateway correction
raised client admission to 120 while retaining six PostgreSQL backends, zero
reserve and existing authentication/TLS/network boundaries. See
[`docs/circle-of-fashion.md`](docs/circle-of-fashion.md) for exact release scope,
verification, cleanup and remaining limitations. The wider expansion below is
still local-only; do not deploy all of main.

The staged implementation and release gates are documented in
[`docs/site-expansion.md`](docs/site-expansion.md). Existing native Journal content,
photographs, versions, Auth identities and original media are retained.

| Stage | Implementation | External launch gate |
| --- | --- | --- |
| Entrance/navigation | Separate `/`, `/photos`, `/video`, `/fashion`; unchanged Journal/detail URLs | Review with real selected work |
| Projects/settings | Native draft/versioned Videos, Fashion projects and Site settings; private project preview | Approve/apply additive migration, then enable expansion |
| Film/fashion | Published-only indexes/details, native playback, rich text, credits/galleries | Real project assets; large-file/transcoding work is separate |
| Photography modes | Published curated Colour/Black & white membership, All fallback and genuine monochrome peek | Classify real photographs in Site settings |
| Pixel finish | Shared actual photo grain/dither/glow, restrained pastel atmosphere and background-only waves | Final review with real content; no UI-hit-target distortion |
| Sound | Persistent opt-in player and seven colour-rank chords; no autoplay/hover audio | Authorized owner-supplied ambient track |
| Newsletter | Double opt-in, private operational outbox, suppression and bounded manual dispatch | Provider/sender/DNS setup and separately approved controlled sending |
| Garment viewer | Ordered-image drag/keyboard turntable | Actual captures; point-cloud/mesh reconstruction is not implemented |
| Domain/email | Documented Vercel/domain/mailbox/sender rollout | Ownership/purchase, DNS and mailbox/provider approval |
| DVD commerce | Intentionally deferred; no inactive checkout controls | Products, stock, prices, shipping and fulfilment decisions |

`ARNAUD_SITE_EXPANSION_ENABLED` defaults off and must remain off until the reviewed
`20261104_120000_site_expansion` migration is applied using the existing Arnaud-only
migration identity. Disabled loaders return empty/default settings without querying
new tables. Source routing/visuals are independent of this database-readiness gate.
Do not run schema pushing or migrations during a Vercel build. The schema-only
generator is `npx tsx scripts/cms/generate-site-migration.ts`; it never connects to
Postgres and refuses to overwrite generated files.

Newsletter additionally requires `ARNAUD_NEWSLETTER_ENABLED=true`, a Resend
`ARNAUD_NEWSLETTER_API_KEY`, bare sender `ARNAUD_NEWSLETTER_FROM`, stable random
`ARNAUD_NEWSLETTER_TOKEN_SECRET` (at least 32 characters), HTTPS canonical
`ARNAUD_CMS_ORIGIN` and published `Site settings.newsletterEnabled=true`.
All are server-only. No provider account, DNS record or actual send is created by
the implementation. Subscription requests acknowledge only a request, not delivery
or confirmed membership. No automatic backfill or republish announcements occur.

Use `npm run test:site` for isolated visual/audio/viewer/newsletter checks and
`npm run test:cms` for native lifecycle/migration coverage, alongside the existing
lint, typecheck, palette, admin, blog, storage and build checks. All local tests
must use synthetic configuration and mocked providers, not production credentials.

Local verification passed 117 automated tests, 45 strict desktop/mobile browser
checks, 25 disabled production-route checks, lint, TypeScript and CMS/expansion
enabled/disabled builds. Independent visual review returned **ship** for the
synthetic screenshots only. These checks do not authorize a production migration,
deployment, actual sending or acceptance of unprovided real media/captures.

## Original project notes — proposals, not current launch status

### Overview — portfolio + social media page

blog section. with pictures video and text.
email updates when new blogs are published.
buy the domain arnaudbelec.com.
email hosting possibly?

180 degree video to point cloud estimation for 3d viewing of clothing
depth anything v2

super saturated pages and pages that are entirely black/white (not fully)

paralax in the ui a lot

arnaudnaudbel@protonmail.com

music playing sitewide

bloom + halation

P22 Cezanne Pro font (for now)

floating gradients colour thing like elliots.
- chords for each colour. 7 chord 7 colour brackets. 

whole page colourful for the photo page but it goes to black and white when you select it to be so. upon black and white mode its shows black and white photos. 
- ui for this is complicated. 
- use a leaking of the black and white page on the colour page to indicate its a interactable element that will switch the colour mode



pages:
- homepage -> wave distortion (like wallpaper engine water) on the ui
- blog page -> needs to be able to upload videos and photos and music to it
- photo page
- video page -> possible buying platform for DVDs
- fashing page


admin facing ui


## Hours Logged
Sept 22:
init consult

sept 23:
3 hours. Rough mockup of photo page and inital site repo creation + storage solution investigation.

0.75 hour. Finding a new colour extraction model that extracts saturated colours rather then weighted averages. updated some of the similar photo logic.
