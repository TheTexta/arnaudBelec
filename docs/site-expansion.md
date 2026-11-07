# Public portfolio expansion

**Full-rollout follow-up:** the owner explicitly requested committing/deploying all
local changes, confirmed P22 web-use licensing and approved both pending Arnaud-only
migrations after backup/rehearsal. See
[`full-site-rollout-20261107.md`](full-site-rollout-20261107.md) for production
status; newsletter sending and new editorial publication remain separate gates.
The earlier scoped/local-only records below are historical.

**2026-11-06 production exception:** an independently approved category-only
Video/Fashion release and image intake is complete. It excludes this document's
full homepage/settings/newsletter/font/palette expansion. The new ordered migration
checkpoint is `20261104_110000_portfolio_categories`; the remaining expansion SQL
now derives from that snapshot to the unchanged original full-expansion snapshot.
Existing category drafts/versions/links are tested through the later migration.
See [`portfolio-intake-20261106.md`](portfolio-intake-20261106.md). Do not interpret
the category flag being enabled in production as approval or schema readiness to
deploy the full main checkout.

## Scope and status

This is the implementation record for the README's remaining site proposals:
a separate entrance, photography archive, film and fashion portfolios, shared
pixel atmosphere, curated colour/monochrome browsing, optional sound, newsletter
delivery, and a garment-viewer foundation. It does not authorize a production
migration, deployment, domain purchase, email campaign or infrastructure change.

The owner selected a separate homepage, fashion as an editorial project portfolio,
and DVD commerce as a later phase. The homepage's visual reference is album artwork
in Spotify playlist `7sEhYBYXqUw7BvapE6A5D3`, not Spotify's interface: muted pastel
grounds, occasional bright blues/yellows, photographic diffusion and the existing
photo-page pixel grain/dithering. Album artwork is reference material, not a
shipping asset. Original media and readable HTML remain sharp above the effect.

Existing native Journal content, versions, immutable private originals, Supabase
identity, Arnaud-only permissions, photography metadata/palettes and unrelated
local work must be preserved. The monochrome CMS theme remains independent.

## Implementation stages

Code readiness and external launch readiness are separate: absent real projects,
music rights, email configuration or garment captures must not be represented as
completed production acceptance. No expansion migration/deployment has been applied
to production. The earlier native Journal release remains the live release.

### 1. Public structure and homepage

`components/site/HomeEntrance.tsx` uses the selected published photograph (or the
first real catalogue photograph), a spare nameplate and route index. No available
catalogue produces an honest empty state, not a fake project. `SiteShell.tsx`
coordinates navigation, contact, route-specific atmosphere and public-only sound;
native `/cms` has its own root and `/admin` bypasses the public shell. Public
project indexes use Suspense/error recovery through `ProjectFeed`/`ProjectRoute`.

Target routes are `/`, `/photos`, the unchanged `/photos/[filename]`, `/blog`,
`/video`, `/video/[slug]`, `/fashion` and `/fashion/[slug]`. The new entrance and
shared navigation must preserve direct photo links and provide useful empty states
without invented projects. Wave displacement belongs behind controls, not on their
hit targets. Reduced motion and WebGL failure must leave a usable site.

### 2. Native content and publication boundaries

`lib/cms/projects.ts`, `site-settings.ts` and `site-access.ts` implement native
drafts/autosave/versioning, Arnaud-only access, stale-form revision checks, stable
published slugs and verified MIME-specific media references. Collection restores
are forced to private drafts. Payload's stock **global** restore can replace the
published main row even with `draft:true`, so Site settings overrides its restore
endpoint with a private `updateGlobal` path and rejects direct stock restore.
`components/cms/ProjectPreview.tsx` reads the latest draft only after authentication.
`lib/site/public.ts` maps published snapshots to a deliberately small DTO: no
storage keys, original checksums or signed URLs are serialized.

Video and fashion authoring and site settings use the existing Payload/Supabase
architecture, not a second CMS or public persistence layer. New database objects
belong to `arnaud_cms` and are introduced only through a reviewed forward migration.
`ARNAUD_SITE_EXPANSION_ENABLED` stays off until that migration is approved/applied.
Disabled reads must not query missing tables. Current Journal behavior must remain
compatible while the expansion is disabled.

Media authorization must follow verified references on currently published main
documents/settings. Drafts, versions, restored private working copies and unused
originals do not grant anonymous access. Unpublish does not delete original bytes;
already issued signed URLs retain their documented short expiry. No new public
bucket, shared Worker change, cross-project administrator grant or storage copy is
part of this implementation.

### 3. Video and fashion portfolios

`ProjectIndex`, `ProjectDetail` and `ProjectMedia` supply media-first composition,
native video/audio controls, galleries, credits, safe native rich text and explicit
media-load failures. Video/fashion slugs resolve only published main documents;
unknown/draft-only slugs return 404. Empty sections have working navigation rather
than invented titles, sample sales items or disabled purchase buttons.

Native metadata, credits, body content, galleries and deliberate publication feed
the public indexes/detail pages. The existing 100 MiB verified Media upload boundary
is not silently increased for archival film masters. Large-file uploads, transcoding
and adaptive streaming need their own approved processing/storage acceptance.

### 4. Curated photography modes

`lib/photographs/presentation.ts` scopes both the hero and similarity results to
the selected editorial group. `app/photo-page.tsx` provides All / Colour / Black &
white controls, resets stale selections when switching and offers a real curated
monochrome peek only when one exists. Invalid/overlapping membership stays in All
rather than guessing intent. Site settings stores UUID membership, not duplicate
photograph records, palettes or storage objects.

Colour and monochrome membership are editorial classifications, not another
photograph-publication switch. Unknown photographs remain visible in All. The
monochrome view uses genuine owner-classified monochrome originals, not CSS
desaturation of colour work. No destructive palette reanalysis or original-object
change is implied.

### 5. Shared pixel finish and sound

`lib/visual/bloom-shader.ts` holds the extracted real photo shader primitives;
the normalized photo fragment output matched its pre-extraction SHA-256.
`PublicAtmosphere` adds related home/journal/video/fashion presets with background
pointer waves, restrained accents, lazy Three loading and a plain CSS fallback.
No texture is painted over foreground text or original media.

`PublicAudioProvider`/`SoundControls` coordinate explicit playback and native-media
competition. `lib/audio/instrument.ts` synthesizes seven colour-rank chords with
four bounded voices, fade envelopes and repeat suppression. Only explicit photo
orb pointer/keyboard selection dispatches `playColourChord`; disabled opt-in ignores
the event. No audio context is created before the sound activation gesture.

Reuse the photo renderer's grain/dithering primitives rather than inventing a
separate visual filter for each page. Do not stack full-screen renderers over the
existing photo canvas. Keep bounded rendering, hidden-tab pause, disposal and
reduced-motion/fallback behavior.

Ambient music and the seven-colour chord instrument are opt-in. Browser gestures,
mute/volume, playback rejection and competing film/audio playback must be handled
honestly. No music is licensed or automatically sourced by linking the inspiration
playlist. The owner must supply an authorized track before ambient playback can
be enabled.

### 6. Newsletter, domain and email operations

`lib/newsletter/` owns private subscribers, delivery outbox and recipient attempts.
`/api/newsletter/subscribe` validates bounded input and records a hashed 24-hour,
single-use confirmation token, with durable one-request/address/day cooldown.
Confirmation and unsubscribe GET links present a button; only explicit POST changes
state, so mail scanners cannot silently subscribe/unsubscribe people. Suppression
is retained and cannot be bypassed by resubmitting the form.

The Posts `afterChange` hook queues only first publication, inside that publication's
transaction, when the environment and currently published settings permit it.
Dispatch is a same-origin authenticated admin POST, not a public cron endpoint:
`POST /api/newsletter/dispatch` with JSON `{ "limit": 10 }` processes at most ten
recipients. It rechecks publication/suppression, uses durable leases and stable
provider idempotency keys, and never sends in the publication transaction.

Five-minute retry records preserve identical message parameters. Ambiguity beyond
23 hours, changed retry parameters or secret rotation becomes `reconcile`, not an
automatic resend. Before resolving one, compare its provider idempotency key and
provider delivery/event records using approved operator access. There is no automatic
reconciliation/resend button and no exactly-once remote-delivery claim. Confirmation
provider failures do not retry automatically; a fresh request is eligible after the
cooldown. This per-address protection is not a global anti-abuse/WAF budget: review
provider quotas and public abuse controls before enabling real subscriptions.

Newsletter sending remains disabled until explicit provider/sender configuration
and controlled-recipient acceptance. Double opt-in, suppression/unsubscribe,
publication idempotency and delivery retry outcomes must be verified without real
emails during local development. Draft saves, private restores and ordinary
republishing must never generate repeated announcements.

Domain launch is an owner-operated gate, not an application API call:

1. Confirm availability/ownership of `arnaudbelec.com`; purchase only after approval.
2. Add the confirmed domain to the owning Vercel project and follow its actual
   verification/DNS instructions. Do not invent a CNAME/A record or alter shared DNS.
3. Verify TLS and the chosen www/apex redirect, then update canonical metadata and
   the exact CMS origin as one reviewed release.
4. Review existing private-upload CORS and authentication origin allowlists for
   the approved origin. Test them before retiring any existing allowed origin.
5. Keep mailbox hosting separate from bulk delivery. Preserve the current Proton
   address until a replacement mailbox is accepted.
6. Publish only the selected provider's actual SPF/DKIM/DMARC requirements after
   reviewing existing records; never overwrite an existing SPF policy blindly.
7. Exercise opt-in, confirmation, one controlled announcement, unsubscribe,
   suppression and provider failure handling before public subscription launch.

### 7. Garment experiments and later commerce

`components/garment-viewer/TurntableViewer.tsx` displays the ordered verified native
image references with pointer dragging, keyboard arrows/Home/End, previous/next/reset
and frame-load recovery. It requests only the selected frame and never autoplays or
preloads the entire sequence. Zero frames render nothing and one is a normal still.

An ordered-image turntable is a useful viewer foundation, not a claim that video
reconstruction has been solved. Test one real capture before choosing a point-cloud,
mesh or splat pipeline. A 180-degree recording cannot reliably reconstruct unseen
surfaces. Offline/isolated processing, derived formats, private publication and GPU
budgets require separate asset/processing acceptance, not work in a Vercel request.

DVD checkout remains deferred as explicitly chosen. Before implementation, define
actual products, stock, pricing, shipping, taxes/returns and fulfilment; choose a
hosted checkout first unless a concrete requirement justifies more infrastructure.
Do not expose inactive purchase controls or invent products/prices.

## Release and verification gates

### Authoring after an approved rollout

1. Sign in through `/admin` using the existing Arnaud Supabase identity. With the
   CMS and expansion enabled, native navigation exposes Videos, Fashion projects
   and Site settings alongside Journal/Media/Photographs.
2. Upload originals through the existing native Media uploader. Add descriptive
   image alt text; verified bytes/MIME/SHA and the existing 100 MiB ceiling apply
   to these assets too. No project publication copies originals to a public bucket.
3. Create a Video or Fashion project. Drafts may be incomplete; publication needs
   real text or verified referenced media. Choose cover/film/gallery/ordered frames,
   body, year and credits as appropriate. Use Preview for the latest private draft,
   then explicitly Publish. After first publication the slug is fixed.
4. Saving/autosaving a new draft does not replace the public snapshot. Version
   restoration prepares another private draft, never an immediate publication.
   Finish saves before Unpublish; withdrawal removes public access without deleting
   originals still required for private work or another published document.
5. Edit Site settings for intro/contact/social links, featured photograph UUID,
   ambient audio and curated photograph UUID lists. Save privately, then Publish
   the settings snapshot. These are catalogue IDs, not filenames or Media IDs.
   Unknown IDs do not manufacture photographs, and overlapping colour membership
   stays unclassified in All. Unpublishing settings restores safe public defaults.
6. Newsletter enablement is independent: publishing the settings checkbox alone
   does not provision a provider or send email. After the separately approved
   provider acceptance, first publication queues an outbox delivery; an authenticated
   operator explicitly dispatches bounded batches through the endpoint above.

### Verification before production changes

- Generate/review the additive schema diff without a production connection.
- Rehearse migrations against populated isolated native data; compare retained
  Journal/Media/identity records before and after and verify runtime privileges.
- Exercise project/global drafts, publication, restore, unpublish, shared media,
  anonymous denial and the expansion-disabled compatibility path.
- Test desktop/mobile, keyboard focus, contrast, reduced motion, WebGL fallback,
  media errors, empty sections and sound off by default.
- Use mocked provider delivery for newsletter tests; live delivery is a separate
  authorized acceptance, never a side effect of `npm run` checks.
- Run lint, typecheck, relevant tests and CMS-enabled/disabled builds with synthetic
  configuration. Do not use production credentials for a local verification run.
- Obtain explicit approval for production schema/configuration/deployment and
  perform public/authenticated read-back before reporting the expansion live.

Empty legacy-table retirement, historical backup purging, photograph-upload R2
activation and shared-infrastructure changes remain independent gates.

### Non-destructive rollback boundary

If a separately approved rollout needs rollback, disable newsletter first, then
the expansion gate, before rolling back the application. Keep the additive tables,
versions, outbox/suppression records and private originals. With the gate off,
project/settings references stop granting anonymous media access; existing Journal
references still work. Already issued file URLs retain their short expiry and
already accepted provider sends cannot be recalled. Do not run a destructive down
migration or reset Journal/photography to roll back this source update.

## Local verification record — 2026-11-04

- Integrated six isolated workstreams by exact owned-file patches after baseline
  SHA-256 checks: 64 files matched their worker outputs before parent wiring.
  Existing unrelated work was not reverted or merged wholesale against Git HEAD.
- Final migration: `20261104_120000_site_expansion`, 164 additive schema statements,
  generated without a database connection. Its down operation refuses destructive
  reversal. No photograph/Journal/original-storage reset is involved.
- `npm run test:cms`: 40 passed, including populated migration preservation,
  actual runtime privileges, cross-schema denial, current published-media union,
  project/global private restores and registered-off compatibility on native-only
  tables. Isolated schema pushing exists only in a fresh-memory model test; the
  separate migration rehearsal applies the real generated SQL.
- `npm run test:site`: 33 passed, including mocked provider opt-in/delivery/retry,
  published-only newsletter activation, disabled operational-model safety, audio
  policy/node cleanup, frame controls and shared shader/preset behavior.
- Palette/admin/blog/storage suites: 7 / 12 / 3 / 22 passed. These include the
  curated photograph eligibility tests and existing upload/publication protections.
- Lint and TypeScript passed. CMS/expansion-off and CMS/expansion-on Turbopack
  production builds passed using synthetic configuration, no `.env` loading and
  an intentionally unreachable database. No runtime database query ran at build.
- The disabled production build passed 25 route checks with no database
  initialization. This caught and corrected streamed project misses returning
  HTTP 200; detail routes now resolve existence before streaming and return 404.
- Independent security review confirmed both initial integration blockers fixed:
  operational newsletter collections never extend the shared lock relationship,
  and unpublished settings cannot enable newsletter operations. Remaining scaling
  considerations are published-reference scans and aggregate subscription abuse
  budgets, not broader grants or a new publication mechanism.
- Static design detection found no primary findings. Palette/type advisories
  reflect the separately pinned public expansion versus the existing Journal-only
  design registry; no unrelated registry repair or global restyling was performed.

Additional native newsletter acceptance: six tests passed against the real
generated migration and actual registered hooks/runtime grants. They exercise
published-settings gating, no backfill, first-publication deduplication, explicit
transaction rollback removing both publication and outbox, double opt-in, distinct
durable claims and mocked Resend dispatch. PGlite serializes its socket sessions:
this proves lease exclusion, not full parallel PostgreSQL session isolation.

Strict browser acceptance passed **45 checks** using the isolated memory-only
fixture at 390px and 1440px, with all 18 public-route captures regenerated after
assets decoded and loading states settled. Actual Jost/Nunito rendered glyphs
were verified; the fixture uses Next's supported local font-response stub to
bundle real production-cache WOFF2 without external font requests. No production
font source or application stylesheet was replaced to make the test pass.

Coverage includes navigation and overflow, initial silence, explicit chords,
persistent ambient player, native-audio interruption without automatic restart,
turntable keyboard/touch input, draft-only 404s, admin isolation, reduced motion,
WebGL failure and context recovery. The strict pass caught a cached-image
hydration race in the turntable's loading indicator; its image ref now handles
already-complete images as well as subsequent load/error events. Earlier
fallback-font and pre-settled captures are superseded, not acceptance evidence.

Evidence is under `.local/site-expansion-browser/`: `result.json`, route captures,
contact sheet and `platform-fonts-{390,1440}.json`. Reproduce after a synthetic
production build (for the cached fonts) with
`npx tsx scripts/cms/site-expansion-fixture.ts`, then
`node scripts/cms/verify-site-expansion-browser.mjs` (set `PLAYWRIGHT_MODULE` to an
existing installation if needed). The fixture is loopback-only, suppresses `.env`
loading, blocks external network and uses separate generated output. ESLint
excludes `.local` artifacts; the fixture must not rewrite project TypeScript setup.

Independent screenshot/source review returned **ship** for the supplied synthetic
desktop/mobile visual evidence. This is not production approval, a contrast
certification or proof of real film/audio transfers. Real content, intentional
film-404 recovery versus actual film playback, inline Journal media, browser empty
sections, provider delivery and external-domain acceptance remain distinct. Empty
routes/SSR states have unit and disabled-production-route coverage, not this
browser matrix's visual acceptance. No migration, deployment, email, domain/DNS
change or commit/push was performed for this expansion.

## Typography follow-up — 2026-11-05

The owner supplied `CezannePro.ttf` and requested P22 Cezanne Pro site-wide.
`app/site-font.ts` now defines one shared `next/font/local` Regular 400 face;
`app/site-font.css` maps the existing text/display aliases to it. Both public and
Payload roots load it, including photograph pages, form controls and previews.
The earlier Jost/Nunito typography and font-mock evidence above are historical,
not the current font source. The isolated fixture now bundles the real local font
directly and needs neither a production font cache nor a Google-font mock.

Small-text roles were tuned for the handwritten face: public navigation, footer,
intro and controls use 20px; captions/status/photograph labels use 18px; native
CMS body, inputs, labels and action text use 20px with 1.65 leading. Existing
heading sizes, palettes, media and layout structures are retained. No artificial
bold/italic faces are synthesized. Independent review found the original tiny-text
regression resolved after inspecting the updated desktop/mobile captures; that
verdict covers this font finding only, not a new whole-site approval.

Current validation passed lint, TypeScript, 33 site tests, both CMS/expansion build
modes, 25 disabled production-route checks and 49 strict synthetic browser checks.
The browser checks verify actual P22 Cezanne Pro glyphs for reading/display text,
photography controls and native CMS controls at both 390px and 1440px. One initial
cold webpack-fixture pass reported a client-navigation hydration mismatch; the
warmed full rerun and the post-readability-fix full run passed without suppressing
the error assertion. No unrelated application hydration refactor was made.

The original supplied Pro file is preserved byte-for-byte; no conversion or
subsetting was performed. See `app/fonts/README.md` for its checksum and provenance.
The package contains no web licence; its preview/print embedding flag is not web
licensing evidence. Appropriate self-hosted web-use rights or an authorized webfont
replacement still need owner confirmation before deployment/distribution. Nothing
was deployed or pushed, and the temporary synthetic fixture was stopped.
