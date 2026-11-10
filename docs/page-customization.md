# Page palettes and Video management

Implemented 2026-11-09. The owner subsequently approved applying the Arnaud-only
migration, then committing/pushing all local changes to production-linked `main`.
The production migration is applied and preservation checks pass; see
[`page-customization-rollout-20261109.md`](page-customization-rollout-20261109.md).
That approval does not publish existing drafts, change originals or enable newsletter delivery.

## Authoring

- In a **Journal post** or **Fashion project**, choose **Page palette → Custom
  palette**. Set Background, Atmosphere colour A/B and Accent using the native hex
  fields or colour pickers. Section palette preserves the existing section look.
  Save, Preview, then explicitly Publish. Incomplete drafts remain private.
- A custom palette covers navigation, reading content, atmosphere, sound controls
  and footer from the server's first render. Text uses readable black/white;
  low-contrast accents fall back to that ink. Decorative colours are bounded
  against the background and custom point lights are disabled. Saved colours and
  original media are not rewritten to implement those readability protections.
- In **Videos**, choose the primary source: Uploaded film, YouTube or None. Blank
  retains legacy behavior: an existing film plays, otherwise there is no primary
  player. YouTube accepts a supported HTTPS URL or exact 11-character ID, not HTML.
  Publication validates the active source. Switching sources retains the inactive
  uploaded original and its historical versions.
- In **Site settings → Video page**, set Heading, Intro, Featured video and Manual
  order. Featured appears first, then the explicit order, then remaining published
  films in publication order. Duplicate manual rows are rejected; featuring a film
  also present in the order displays it once. Older pinned selections remain
  resolvable beyond the normal 100-item listing window. Later withdrawal hides a
  stale selection rather than exposing a draft.
- Site settings Preview opens `/cms/video-page-preview` and shows the saved draft
  configuration with currently published films. Journal/Fashion private previews
  show their saved palettes without recolouring Payload's navigation/editor chrome.
  Previewing is not publishing; the existing global publication is atomic across
  all Site settings fields.

Existing links, credits, body content, original masters/variants, publication
states and permissions are preserved. Existing YouTube links in project bodies
are not automatically converted; select YouTube and publish deliberately.

The owner subsequently requested conversion of the four existing published
link-only Videos. That native content update is complete; see
[`youtube-embed-conversion-20261109.md`](youtube-embed-conversion-20261109.md).
Other existing/future body links still require an explicit primary-source choice.

The homepage's sound/subscription/footer **containers** no longer paint a solid
strip. The fluid field stays behind them. Small control/text backings retain
readability, as do the existing nameplate, section labels and intro backings.

## Playback, privacy and authorization

**Viewport-playback follow-up:** the owner superseded
click-to-load with default embeds, muted viewport autoplay and click-to-unmute.
`YouTubeVideo` initializes the official iframe API and a privacy-enhanced
`youtube-nocookie.com` player on hydration, without waiting for a click. YouTube
may therefore receive requests before interaction; the privacy-enhanced hostname
does not mean no data is sent. The server reserves the 16:9 player space and
announces loading while the API initializes. No content conversion or migration
is needed for this behavior change.

At least 25% of the frame must be visible in a visible tab to autoplay. Leaving
that viewport or hiding the tab pauses and mutes the existing player; returning
resumes muted at its existing position. Clicking/tapping the video (or activating
its Unmute button with Enter/Space) enables sound without recreating the iframe.
The overlay leaves the bottom control strip exposed; after unmute the full native
player is interactive. Separate Pause/Resume controls let visitors stop autoplay
without turning on sound, and Mute video is available with sound on. A manual
pause is respected until the next viewport/tab entry.
Browser autoplay restrictions display recovery guidance, while unavailable or
restricted films retain bounded initialization, explicit retry and Watch on
YouTube fallback.

Silent players can coexist and do not interrupt ambient/native audio. Unmuting
claims sound, pauses native/ambient audio and mutes other YouTube players without
destroying their iframes. Native playback likewise mutes YouTube. Delayed iframe
mute acknowledgements cannot reclaim another player's sound; an explicit Unmute
overrides pending silence. Pause, end, unmount and failure release the sound lock;
ambient music never automatically resumes. Private CMS previews work without the
public audio provider. Uploaded-film playback remains unchanged.

Only active uploaded primary films plus genuinely used covers/body/gallery/frame
media contribute publication references. A retained inactive film is not granted
anonymous access just because it is still selected privately. Body references
remain independent. Featured/ordered project relationships do not grant media
access. Existing short signed-URL expiry remains unchanged.

Routes own `PublicSiteFrame`, allowing slug-specific server-rendered palettes
without a hydration colour flash. `SiteAudioRoot` remains in the public root so
audio state survives client navigation. Admin entry unmounts it; native CMS uses
its separate root. Error/not-found pages retain public navigation.

## Schema and rollout gate

`migrations/20261109_120000_page_customization.ts` adds 52 schema statements:
palette fields on Posts/Fashion and their versions, nullable Video source/URL
fields and versions, plus global landing fields/order tables and versions. It
does not rewrite existing content, defaults for Video source, originals or grants.
The operator-only `media_imports` journal remains outside Payload snapshots and
is preserved by the rehearsal. Down migration refuses destructive reversal.

The schema-only generator is `scripts/cms/generate-page-customization-migration.ts`.
It clears provider settings, uses no database connection, refuses DROP/TRUNCATE,
and refuses overwriting an existing migration. `--artifacts-only` regenerates
types/import map without creating migration files. Existing snapshots stay intact.

Journal palette registration uses the existing expansion gate, preserving the
native-only/old-schema OFF path. There is no new feature flag. Since the deployed
expansion gate is already on, **apply and verify the additive migration before
deploying this application**. This was approved and completed for Arnaud production
on 2026-11-09; it is not permission to migrate other environments. Back up/rehearse under the existing
Arnaud-only migration identity, verify retained content/roles, then perform public
and authenticated read-back after an independently approved deployment.

Keep additive columns/tables, versions and original bytes during rollback. Older
code does not understand YouTube selections, so application rollback alone does
not guarantee their playback. Do not restore inactive originals to public access
or rewrite editorial choices as an automatic rollback step.

## Local verification

- Lint and TypeScript pass.
- CMS: 61 tests, including additive migration preservation, restricted roles,
  source validation, inactive-film denial, merged palette validation, private
  restore and native-only OFF compatibility.
- Site: 46 tests, including source/palette DTOs, contrast roles, featured ordering,
  selection filtering, native layout regression and newsletter transaction tests.
- Media: four tests. The updated standalone YouTube SSR/mocked Chrome matrix covers
  default embeds, viewport/tab entry and exit, muted coexistence, keyboard unmute,
  native controls, delayed mute acknowledgement, cleanup, bounded failure/retry,
  blocked-autoplay recovery and standalone preview.
- CMS/expansion-enabled and disabled optimized Webpack builds pass with synthetic
  settings, `.env` loading suppressed, outbound traffic blocked and no build-time
  database connection. Initial cold builds reported warnings without diagnostics;
  final builds compiled cleanly in both modes.
  Output is isolated under `.local/page-customization-build-{enabled,disabled}`;
  tracked TypeScript setup was protected from build-time rewriting.
- Disabled production smoke: 15 public/admin/API/detail/preview route checks pass
  without initializing the database.
- Existing full-site Chrome matrix: 49 checks pass at 390px/1440px, including real
  P22 rendered glyphs, persistent audio, draft-only 404s, reduced motion, WebGL
  fallback/context recovery and photography/turntable regressions.
- Focused integrated Chrome matrix: 14 checks pass at 390px/1440px for first-render
  palettes, client-navigation reset, transparent homepage bottom, both YouTube
  routes, anonymous preview denial and all authenticated private previews. The
  screenshots were visually reviewed, including the scrolled homepage bottom.
- Existing admin/blog/palette/storage suites: 14 / 3 / 21 / 33 tests pass.
- Independent read-only integration review reported no substantive findings.

Run `node --import tsx scripts/cms/site-expansion-fixture.ts`, then the browser
scripts below. The fixture is memory-only, loopback-only, blocks external services
and does not read `.env`. All content/media are synthetic. `PLAYWRIGHT_MODULE` may
point to an existing external Playwright installation with Chrome available.

```bash
node scripts/cms/verify-site-expansion-browser.mjs
node scripts/cms/verify-page-customization-browser.mjs
node scripts/cms/verify-youtube-browser.mjs
```

Screenshots/results are ignored under `.local/site-expansion-browser/` and
`.local/page-customization-browser/`. Real playback for the four converted YouTube
films subsequently passed the short Chrome checks documented in the conversion
record above. Physical Safari/iOS, full-length playback and other live content
publication remain separate acceptance gates. Production
migration/deployment scope and receipts are recorded in the rollout document.
Mock transport is not real YouTube acceptance.

The local viewport follow-up additionally passed real anonymous Chrome playback
using the actual component and all four existing public YouTube IDs: muted
autoplay, advancing frames/time, click-to-unmute without iframe replacement,
off-screen pause/mute and silent re-entry. All four passed at 1440px and the first
also passed at 390px without overflow. Evidence and the local-only acceptance
runner are under ignored `.local/youtube-autoplay-20261109/`. This verifies local
source with the real provider, not a new production deployment or physical iOS.

Follow-up validation: lint, TypeScript, 46 site tests, four media tests, 18
standalone SSR/mocked-browser checks and the 14 integrated checks passed. The
CMS/expansion-enabled optimized Webpack build passed cleanly on the final run;
the disabled optimized build also passed. Both suppress `.env` loading and
network access and isolate output without rewriting tracked TypeScript setup.
Independent read-only review's delayed-mute handoff finding was fixed and covered
by the delayed-acknowledgement regression; targeted re-review found no blocker.
Real and synthetic mobile/desktop screenshots were visually reviewed. At that local
validation checkpoint, no new commit, push, deployment, production data write or
infrastructure change had occurred. The owner subsequently authorized committing
and pushing this follow-up to deployment-linked `main`. Local checks do not establish
the resulting Vercel deployment status or live acceptance; no schema/content write
or infrastructure mutation is required by this application release.

The native CMS's existing long-title breadcrumb overflows horizontally at 390px
for the synthetic project name. The new colour controls fit within the viewport;
this task preserves the surrounding native editor chrome rather than restyling it.
