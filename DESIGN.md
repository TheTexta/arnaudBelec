---
name: Arnaud Belec — Journal and Administration
description: Black-and-tan journal/preview with a separate monochrome native admin; not the photograph-page identity.
colors:
  paper: "#090807"
  panel: "#141210"
  ink: "#eadfce"
  title: "#c69b69"
  muted: "#b5a895"
  line: "#7d6a52"
  accent: "#d65b4b"
  danger-text: "#f5a195"
  error-bg: "#261512"
  error-text: "#f5b4a8"
  editor-menu: "#211b15"
  editor-hover: "#33291e"
  public-chalk: "#f4f5f3"
  public-blue: "#c4d4ed"
  public-lilac: "#d4cce5"
  public-rose: "#e1cbd2"
  public-butter: "#eee6b5"
  public-ink: "#25334b"
  public-muted: "#485771"
  public-accent: "#204cd6"
  public-video-ground: "#dce0e5"
  public-home-field-ground: "#e3e3dc"
  public-fashion-field-ground: "#e7ded9"
  home-fluid-a: "#ff278f"
  home-fluid-b: "#ffe52f"
  home-filler: "#c8e6ff"
  home-ink-dark: "#000000"
  home-ink-light: "#ffffff"
typography:
  home-display:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(40px, 5.2vw, 72px)"
    fontWeight: 400
    lineHeight: 1.15
  home-display-mobile:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(40px, 10vw, 64px)"
    fontWeight: 400
    lineHeight: 1.15
  home-label:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(22px, 2vw, 30px)"
    lineHeight: 1.3
  home-label-mobile:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "26px"
    lineHeight: 1.3
  public-body:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "20px"
    lineHeight: 1.7
  public-navigation:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "20px"
    lineHeight: 1.7
  public-caption:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "18px"
    lineHeight: 1.7
  public-sound-status:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "18px"
    lineHeight: 1.65
  cms-body:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "20px"
    lineHeight: 1.65
  public-display:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(48px, 7.8vw, 96px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  public-headline:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(44px, 7vw, 88px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  public-project-title:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(26px, 3vw, 38px)"
    fontWeight: 400
    lineHeight: 1.25
  display:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(44px, 6vw, 76px)"
    fontWeight: 400
    lineHeight: 1.12
  headline:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(38px, 5vw, 64px)"
    fontWeight: 400
    lineHeight: 1.15
  title:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(32px, 4vw, 44px)"
    fontWeight: 400
    lineHeight: 1.2
  entry-title:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 400
    lineHeight: 1.25
  name:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "18px"
    lineHeight: 1.8
  field:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.6
  button:
    fontFamily: '"P22 Cezanne Pro", cursive'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.65
rounded:
  control: "2px"
spacing:
  field-gap: "8px"
  action-gap: "10px"
  compact: "12px"
  group: "16px"
  inset: "20px"
  section: "24px"
  navigation: "28px"
  block: "32px"
  major: "48px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary:
    backgroundColor: "{colors.title}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger-text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
    width: "100%"
  notice:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "20px"
  notice-error:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error-text}"
    rounded: "{rounded.control}"
    padding: "20px"
  public-navigation:
    textColor: "{colors.public-ink}"
    typography: "{typography.public-navigation}"
    height: "44px"
  public-sound-button:
    backgroundColor: "transparent"
    textColor: "{colors.public-ink}"
    typography: "{typography.public-body}"
    padding: "8px 12px"
---

# Design System: Arnaud Belec — Journal and Administration

## Overview

### Homepage-only precedence — 2026-11-05

The approved `/` redesign is an irregular four-image entrance over genuine
cursor-driven fluid: pink and yellow pigments with pastel-blue filler. This
supersedes only the older homepage album-art atmosphere, hero/route-index layout
and entrance type roles below. `home-*` tokens take precedence on `/`; existing
`public-*` tokens/history remain intact for other surfaces. Preserve the current
owner-supplied P22 Cezanne Pro face, sharp originals, independent photograph,
Journal, video/fashion interiors and monochrome native admin. The existing font
web-licence gate is unchanged.

Runtime authority: `lib/site/homepage.ts`, homepage rules and mobile overrides in
`components/site/site.css`, `HomeEntrance`, `HomePreview`, `HomeFluid` and
`lib/visual/fluid-renderer.ts`. Surface composition, publication boundaries and
scoped finish evidence are recorded in `.impeccable/surfaces/homepage.md`.

### Site-wide typography exception — 2026-11-05

The owner selected **P22 Cezanne Pro, cursive** site-wide: entrance, photography
archive/details, Journal, video/fashion, controls, native CMS and previews. This
supersedes every older Jost/Nunito pairing, open-source-only font statement and
non-photograph font-scope rule below, including historical specimen guidance.
Colors, palette rendering, public grain, native admin themes, layout, heading
sizes and declared weights are not redesigned by this exception. The targeted
readability correction below supersedes the initial unchanged-small-size record.

Current authority is `app/site-font.ts` (`next/font/local`, `--font-site`) and
`app/site-font.css`; `app/non-photo-fonts.ts` is a compatibility re-export, and
both legacy font variables alias `--font-site`. Only Regular (400, normal) is
supplied; `font-synthesis: none` prevents fabricated bold/italic faces. Existing
500/600 role declarations do not establish additional supplied font faces.
There is no Google font dependency, font conversion or subsetting.

`app/fonts/cezanne-pro.ttf` is the byte-for-byte owner-supplied `CezannePro.ttf`
from `/Users/dexteryoung/Downloads/p22-cezanne-pro`. Provenance and SHA-256 are in
`app/fonts/README.md`. The package contains no web licence; its fsType 4
preview/print flag does not establish web-use rights. This is local wiring only:
owner confirmation of appropriate self-hosted web rights (or an authorized
replacement package) is required before deployment or distributing the asset.
Earlier Jost/Nunito browser captures and verdicts are pre-Cezanne evidence, not
verification of this font change.

**Readability correction — 2026-11-05:** public shell/body, navigation at both
widths, footer and intro now use (20px/1.7); captions and metadata use (18px).
Project back links use (20px); project reading text uses (20px/1.8) at both
widths. Sound status is (18px/1.65); photo `.text-xs`/`.text-sm` roles are
(18px/1.7). CMS body, fields, actions, labels, navigation and help use
(20px/1.65). Journal dates/captions are (18px/1.7); legacy fields/labels use
(20px), and buttons (20px/1.65). Other Journal reading sizes and all headings
remain unchanged. Source: `components/site/site.css`, `components/cms/cms.css`,
`app/blog/blog.css`, `components/site-audio/sound.module.css`.

The implementation owner reports 49 strict P22 browser checks passed at (390px)
and (1440px), including actual custom glyphs on photo/CMS controls. Independent
review reopened six captures and marked the specific small-type readability
finding **RESOLVED**, with **ship for that finding only**, not full-site or
production acceptance. Final builds remain pending; the web-licence gate above
is unchanged. Detailed implementation checks belong in `docs/site-expansion.md`.

### Public extension — 2026-11-04

**Route precedence:** the new `/` entrance and `/video`, `/video/[slug]`,
`/fashion`, `/fashion/[slug]` use the namespaced `public-*` tokens and the scoped
additions below, not the incumbent warm palette or its illustrative tonal ramps.
The older references to the photograph “root” now mean `/photos`; existing
`/photos/[filename]` links and their palette-driven renderer remain independent.
`/blog` and articles retain their warm reading identity, with a restrained shared
background texture. `/admin` and `/cms` receive no public atmosphere; native CMS
keeps the monochrome exception below. Historical text/examples are retained, not
re-endorsed as current editor architecture.

The public extension interprets the user's Spotify **album-art** reference as
muted photographic pastels with occasional blue/yellow interruptions, never
Spotify interface chrome. Its authority is `components/site/site.css`,
`lib/visual/atmosphere.ts`, `lib/visual/bloom-shader.ts` (`BLOOM_DEFAULTS`) and
`components/site-effects/`. Surface composition and evidence belong to
`.impeccable/surfaces/site-expansion.md`.

### Native admin exception — 2026-11-04

The owner selected the Dexter/Elliot admin direction for `/cms`: black and white,
neutral-grey hierarchy, square controls and restrained native Payload composition.
This supersedes the warm admin styling described in the historical sections below,
but not the public journal or private article-preview appearance. Frontmatter's
warm palette remains the journal/preview palette, not a CMS token source.

Native admin uses white (`#fff`) with black (`#000`) text in Light, black (`#000`)
with neutral light text (`#ebebeb`) in Dark, and Payload's neutral elevation ramp
for fields, rules, secondary copy and state surfaces. Nunito Sans remains the
compact operating face; Jost remains part of the article-preview identity. Buttons
and inputs are square, with monochrome selection/caret/focus and clear status text.
Media content keeps its original colours. No decorative gradients, cards or motion
are added. The native account theme setting defaults to Automatic (live system
preference) and retains remembered Light/Dark overrides. Source authority:
`components/cms/cms.css`, `components/cms/SystemTheme.tsx` and `lib/cms/theme.ts`.
The public photograph routes and CMS-disabled photography admin are unchanged.

The remaining sections record the black-and-tan journal/preview system and its
historical administration implementation; this exception wins for native CMS UI.

**Creative North Star: "Arnaud's black-and-tan journal"**

This is a record of the approved, implemented non-photograph identity: warm geometric titles on near-black grounds, pale reading text, fine rules and quiet authoring controls. Its visual authority is the user-pinned [old Adobe Portfolio](https://arnaudnaudbel.myportfolio.com/), interpreted through approved open-source fonts rather than copied font binaries or reference imagery.

**Scope is binding:** apply this system to `/blog`, journal articles, `/admin`, `/admin/posts`, the editor and private preview. The photograph root and `/photos/[filename]` have an independent palette-driven visual system and are excluded. A Photographs link or the photograph-upload admin subsection does not extend these tokens to public photograph pages.

**Key Characteristics:**
- Black grounds and warm tan titles, with pale text for sustained reading.
- Jost display hierarchy and Nunito Sans reading, labels and controls.
- Flat, finely ruled surfaces with compact, nearly square controls.
- One persistent administration shell with explicit state and private-preview context.

Evidence: `app/blog/blog.css`, `app/non-photo-fonts.ts`, `app/blog/layout.tsx`, `app/admin/layout.tsx`, `app/admin/admin-access.tsx` and `app/admin/posts/block-editor.tsx`. Direction: `.impeccable/surfaces/app-blog.md`; durable scope: `PRODUCT.md`. Local reference snapshots live at `.local/old-site-{home,contact,tableau,root}.png`. No new shipping rasters belong to this system.

## Colors

### Homepage scope

The `home-fluid-a` and `home-fluid-b` tokens are the two pigment defaults;
`home-filler` is the solid ground between them. Payload Site settings can replace
all three with validated six-digit hex colors. These are fluid compositing inputs,
not the old seven-color home atmosphere. `homeInk()` selects `home-ink-dark` or
`home-ink-light` from filler luminance (threshold .179). Name, labels and intro
sit on solid filler, never directly on unpredictable moving pigment.

### Public extension scope

The `public-*` frontmatter entries record the implemented shell colors: blue home
ground, lilac fashion ground, cool-grey video ground, dark-blue ink/muted copy and
cobalt interaction accent. Chalk supports the skip link; rose/butter are the
shell's pastel vocabulary. Shader profile colors are separate compositing inputs,
not a replacement text palette: home uses `#dbe4ec`, `#c8d5e6`, `#d3c8e0`,
`#dfc4c7`, `#eee2b5`, `#244ce8`, `#f5d632` over its field ground, with wash/accent
opacity (.64/.64). Video uses (.58/.46), fashion (.60/.44); their exact seven-color
profiles remain in `lib/visual/atmosphere.ts`, not synthesized ramps. Journal
retains paper/ink/tan, with profile opacity only (.045/.035) and no point lights.
Shell grounds remain visible if the renderer is absent; field grounds belong to
the fixed atmosphere, not media or controls.

Warm near-blacks support tan geometry and cream reading text; red is a restrained state color. Frontmatter is the normative palette; names below explain placement.

The sidecar's eight-step tonal ramps are synthesized OKLCH swatch aids required by the documentation panel, not additional implemented CSS colors. Component snippets resolve shell-local color variables to literal values so they can render independently; approved font variables remain live-bound when available.

### Primary
- **Tan title:** nameplate, journal headings, filled primary actions, focus outlines, selection, caret and native progress accents.
- **Red accent:** error borders rather than a decorative page wash; lighter danger and error text remain separate legible state colors.

### Neutral
- **Paper black:** full-page ground and recessed form fields.
- **Panel black:** login, writing document, notices and code/media backing.
- **Warm ink:** body text, ordinary controls and the primary-action hover fill.
- **Muted sand:** dates, captions, excerpts, help and read-only field text.
- **Brown line:** single-pixel rules and control outlines.
- **Error background / error text:** paired error notice treatment; danger text marks destructive actions.
- **Editor menu / editor hover:** BlockNote menu and hovered-item grounds.

**The Scoped Ground Rule.** Black and tan belong to the non-photograph shells; never replace photograph-derived backgrounds with this palette.

## Typography

### Homepage scope

Use `home-display` and `home-label`, switching to their mobile roles at (700px)
and below. Intro retains `public-body` (20px/1.7) with a (40ch) measure. All use
the current Regular-only P22 face; no replacement font or synthesized face.
These entrance roles supersede `public-display` only on `/`.

### Current authority — 2026-11-05

All frontmatter typography roles now use P22 Cezanne Pro with a cursive fallback,
delivered by the shared local definition described in the Overview exception.
The targeted current sizes/leading are recorded in the Overview correction and
frontmatter; remaining sizes, spacing and requested weights are unchanged. Only
the Regular face exists and synthesis is disabled. The following Jost/Nunito prose
records the prior system, not current family selection or font-loading scope.

### Public extension scope

The approved Jost / Nunito Sans pairing is also self-hosted for the public website
through `app/non-photo-fonts.ts` and the website layout; the older “layouts only”
statement below is historical. Use `public-display` for the entrance,
`public-headline` for project index/detail headings and `public-project-title`
for linked work titles. At (700px) and below, entrance type becomes
`clamp(44px, 10.2vw, 70px)`. Public nameplates use Jost (400, 24px/1.25), reducing
to (23px); navigation uses Nunito Sans (15px), reducing to (14px). Intro copy is
(16px/1.65, 38ch); project decks are (18–23px/1.6, 52ch); project reading text is
(18px/1.8, 68ch), reducing to (17px). No proprietary font binaries are bundled.

**Display Font:** Jost, with Futura PT, Futura and sans-serif fallbacks. **Body Font:** Nunito Sans, with Proxima Nova and sans-serif fallbacks. Jost and Nunito Sans are self-hosted through `next/font/google`, loaded by the journal/admin layouts only. The legacy face names are fallback declarations, not bundled licensed fonts.

**Character:** geometric, lightly weighted headings establish the identity; softer sans-serif reading and operating text keep long posts and dense forms approachable. The frontmatter records CSS family intent; Next.js supplies generated font-family aliases at runtime.

### Hierarchy
- **Display / headline / title / entry title:** use the fluid frontmatter roles for the journal index, article, admin heading and journal list respectively.
- **Name:** medium-weight nameplate; reduces to (22px) on phones.
- **Article body:** bounded to (68ch), with frontmatter body size and leading; reduces to (17px) at the mobile breakpoint. Intro copy is (18px / 1.7), bounded to (48ch); article decks are (20px / 1.7).
- **Article subheadings:** Jost (500 / 1.3); h2 (30px), h3 (25px), h4–h6 (21px).
- **Fields / labels / buttons:** use their explicit roles, including (16px) editable field text. Title textarea uses Jost (400), fluid (28–42px), leading (1.2).
- **Supporting copy:** muted (14px / 1.6); dates use tabular numerals and leading (1.7). Inline code alone uses ui-monospace / monospace.

**The Two Faces Rule.** Carry the display/body pairing through articles, authentication, admin forms and preview; do not substitute a generic CMS face for these surfaces.

## Layout

### Homepage scope

Desktop uses a (24-column / 16-row) irregular grid, rows
`minmax(36px, 3.8svh)`: largest Photography left-centre, small Journal upper-centre,
tall Fashion upper-right and wide Video lower-right. At (700px) and below it
becomes a staggered vertical sequence: Photography (88%), Journal (57%), Video
(78%), Fashion (51%) wide, with (36px) gaps. Originals retain their aspect ratios
with `contain`; no equal-card shells or cropped portfolio images. Contact and
explicit opt-in sound remain below the scene. The historical entrance layout
below is superseded, not the project index/detail layouts.

### Public extension scope

The entrance pairs a flexible image column with a (150px) route index, fluid
(20–80px) side inset and (24–80px) column gap. The figure is (88%) wide, original
ratio, capped at (53svh). At (700px) and below, the index becomes a wrapping row,
the figure fills its column and caps at (48svh). Project pages cap at (1440px);
their twelve-column list staggers entries across columns (1–9), (5–12), and
(2–10), with (88px 32px) gaps. Mobile stacks entries (56px apart). Detail reading
caps at (880px); two-column galleries with (40px 32px) gaps collapse to one column
with (32px) gaps. Project images/video use `contain`, original ratios and an
(82svh) ceiling. Header, footer, contact and sound controls wrap rather than clip.

Journal outer padding is (36px clamp(20px, 5vw, 80px) 96px); admin is (32px clamp(20px, 4vw, 56px) 64px). Navigation is a wrapping, space-between row with a bottom rule and (24px) bottom padding. Admin content caps at (1200px); the journal list at (1040px), article at (880px), article header at (720px), writing document at (960px), login at (440px).

Journal entries pair a (150px) date column with flexible content and a (28px) gap. The index begins (88px) below navigation. At widths at or below (600px), entries become one column with a (10px) gap, index top space becomes (52px), article top space becomes (40px), and shell top padding becomes (24px). Navigation gaps reduce from (28px) to (20px). Actions wrap with (10px) gaps; editor toolbar and preview banner also wrap rather than overflow.

The editor document uses fluid (20–64px) inset, replaced by (20px 16px) on phones. The toolbar sticks to the viewport top with an opaque paper ground, bottom rule and z-index (20). BlockNote has intentional negative outer margins and internal left padding for block handles; preserve the mobile overrides rather than applying a global card inset.

## Elevation & Depth

### Homepage scope

Home replaces the old atmosphere with a lazy Three.js GPU fluid solver adapted
from MIT-licensed Pavel Dobryakov: seeded opening, curl/vorticity, pressure
projection and pointer splats. Two pigment weights composite over filler; this
is not simulated by CSS animation. Budgets: simulation (112), dye (384), long
target dimension at most (768), pressure iterations (14), pixel ratio at most
(1.5), display buffer at most (2,000,000 pixels). The fixed home-only canvas is
inert, aria-hidden and pointer-transparent beneath sharp HTML/media. No shadows,
touch interception or cursor replacement. Hidden tabs pause; teardown disposes;
context loss exposes static CSS fallback and restoration reinitializes. Reduced
motion skips the solver entirely; no-WebGL also retains the static CSS field.
The shared grain/shader description below continues to apply outside home only.

### Public extension scope

Depth comes from the background field, not cards, glass or shadows. The real
shared photograph shader supplies linear-light monochrome grain, output dithering
and four-CSS-pixel glow cells; this is not a grain-image overlay or bloom
postprocessing. `BLOOM_DEFAULTS`: strength (.035), grain size (1 CSS px), speed
(1), seven colors, pixel ratio at most (1.5), drawing buffer at most (2,500,000
pixels), orb noise refresh (60ms). Three.js is dynamically imported after mount.
The fixed field is inert, aria-hidden and pointer-transparent beneath sharp HTML
and original media. Passive non-touch pointer movement perturbs background waves
only (strength 18; Journal 6). Hidden tabs stop animation; reduced motion freezes
time and removes pointer waves, redrawing on changes. CSS gradients remain the
honest fallback during loading, WebGL failure or context loss; teardown disposes
resources. No extra public atmosphere mounts on photo routes, admin or CMS; the
photograph pages retain their own existing renderer.

The authored shell is flat: no custom drop-shadow vocabulary, glass or floating decorative cards. Tonal differences and single-pixel rules separate page, document, fields and notices. BlockNote's library-owned menus may retain their native overlay treatment; that is not a new shell shadow token. No custom motion or transition scale is declared in the scoped stylesheet.

## Shapes

### Public extension scope

Public work is open editorial imagery, not a uniform rounded-card grid. Sound and
viewer actions are square, transparent, single-pixel outlined controls with (44px)
minimum heights; pressed sound controls strengthen the outline to (2px). Do not
apply the historical Journal control radius as a public-page default.

Controls, login, notices and writing document use nearly square corners: the frontmatter control radius. Rules and field outlines are (1px). Journal entries are open rows, not rounded cards. Quotes use a single tan left rule; unavailable media uses a dashed outline. Media preserves its aspect ratio with `object-fit: contain` and an (85vh) height ceiling.

## Components

### Homepage: section image-links and settings

`HomeEntrance` / `HomePreview` retain all four labeled section links even without
images. Each slot independently supports text-only, a published catalogue thumbnail
or a verified native image. Hover underlines the label; keyboard focus uses
current contrast ink (3px outline, 7px offset). Solid filler backs the name,
labels, intro and explicit unavailable-media status; media stays sharp and still.

Native Payload Site settings owns both image choices and all three palette roles,
with drafts, autosaves, versions and explicit atomic Publish. Native images become
public only through published active references, not drafts, autosaves or versions.
The additive migration is prepared, not applied to production. Existing field,
grant and identity boundaries are unchanged; the native admin remains monochrome.

### Public extension: navigation, media, sound and garment views

`SiteShell` / `SiteNavigation` share Photography, Journal, Video and Fashion links;
the entrance uses its own route index instead of a duplicate header. Active links
use `aria-current` and a (2px) underline; hover underlines links. A focus-revealed
skip link targets the public content. Public focus is cobalt (2px, 5px offset),
warm tan on Journal and black on the photo header; sound controls retain their
current-color (2px, 4px offset) focus treatment.

`ProjectIndex`, `ProjectDetail` and `ProjectMedia` present published catalogue /
nativeMedia content, captions, dates and credits without simulated commissions.
Empty/loading/error states explain themselves; failed media offers an original
link. Native video/audio controls remain available, with no autoplay.

`SoundControls` exposes independent explicit music and colour-sound opt-ins,
mute, labeled volume and live status. No hover sound or automatic start/resume;
native media pauses ambient music. Music requires an owner-supplied authorized
track; playlist access confers no music rights. `TurntableViewer` is an ordered
photographic sequence, not 3D reconstruction: sideways drag, Left/Right and
Home/End keys, Previous/Next/Reset buttons and announced frame/loading status.
Only the selected frame is requested, drag updates are capped at (120ms), and a
single frame is a still rather than a misleading interactive control.

### Buttons
Compact outlined actions with a (44px) minimum height. The ordinary button uses ink on transparent ground with a line-colored border; hover changes text and border to tan. Primary buttons invert tan against paper, then ink against paper on hover. Danger buttons change text to the lighter danger token, not a filled red background. Disabled controls use opacity (.5) and a not-allowed cursor.

### Inputs / Fields
Dark, recessed fields beneath visible semibold labels; use the frontmatter field inset, radius and colors with a (44px) minimum height and (8px) label gap. Placeholders and read-only text are muted, not transparent. Focus uses a tan (2px) outline offset (4px), shared with links and buttons. Title textareas retain their display hierarchy, content sizing and vertical resize affordance.

### Cards / Containers
Login and editor are purposeful bordered panels, not a general dashboard-card grid. Login uses (32px) inset, reduced to (24px) on phones. Notices use the component inset with matching border; errors switch border to accent and use the dedicated error background/text pair. Post rows remain open, top-ruled flex rows with wrapping actions.

### Navigation
The public shell pairs the nameplate with Photographs / Journal links. One `AdminAccess` in `app/admin/layout.tsx` owns the persistent admin navigation: Photographs (`/admin`), Journal (`/admin/posts`), View site and authenticated Sign out. The active admin subsection is tan and underlined through `aria-current="page"`. Links underline and turn tan on hover; keyboard focus stays visibly outlined. Preserve the shared login and existing navigation/exit confirmations; appearance is not authorization.

### Journal, editor and private preview
Journal lists use date/title/excerpt hierarchy and fine separators. Articles use the same renderer in private preview, with explicit private-preview context above the content. Saving, unpublished changes and publication actions remain distinct in the editor toolbar. BlockNote inherits the approved body face, panel/ink editor colors, tan selection/tooltips and dedicated dark menu/hover colors. Do not promote every library detail into a reusable shell token.

## Do's and Don'ts

### Public extension guardrails

- **Do** keep text and original media crisp above the shared shader; preserve the
  warm Journal and independent monochrome native CMS.
- **Do** source real work from the published catalogue/nativeMedia. This extension
  adds no shipping raster assets; unchanged `public/test-image.jpg` is a local
  synthetic fixture, not portfolio content.
- **Don't** copy album covers, bundle proprietary font binaries, imply playlist
  music licensing, claim 3D reconstruction or turn fashion into a shop.
- **Don't** treat synthetic browser evidence as real-content, real-film playback
  or production acceptance. Independent finish review returned **ship** for the
  supplied desktop/mobile visual evidence only.

### Do:
- **Do** keep these tokens scoped to journal and administration, including private preview.
- **Do** retain the approved self-hosted Jost / Nunito Sans pairing and bounded reading measure.
- **Do** preserve visible keyboard focus, wrapping controls and explicit saving/publication/private state.
- **Do** use existing media as content only; keep browser fixtures clearly labeled.

### Don't:
- **Don't** restyle the public photograph root/detail pages using this document.
- **Don't** copy Adobe font binaries, old-site imagery or invent shipping raster assets.
- **Don't** replace the approved black ground with the superseded cream CMS treatment.
- **Don't** infer production authorization or acceptance from a local visual review.

Evidence coverage: `.impeccable/review/` contains journal, login, posts, photos and preview desktop/mobile captures; `desktop.png` / `mobile.png` show the editor, and `denied-mobile.png` shows denied access. These are review evidence, not shipping imagery. The supplied finish verdict is ceiling reached for the constrained Read/Operate brief; two subsequent upload exit/cancellation fixes were judged resolved, with ship disposition limited to that two-fix scope. This document does not independently certify those behavioral fixes or production readiness. Existing `review.md` and `design-verification.md` still describe the earlier cream system; that historical documentation drift is not canonized here or repaired outside this write boundary.
