---
name: Arnaud Belec — Journal and Administration
description: Scoped black-and-tan reading and authoring system; not the photograph-page identity.
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
typography:
  display:
    fontFamily: 'Jost, "Futura PT", Futura, sans-serif'
    fontSize: "clamp(44px, 6vw, 76px)"
    fontWeight: 400
    lineHeight: 1.12
  headline:
    fontFamily: 'Jost, "Futura PT", Futura, sans-serif'
    fontSize: "clamp(38px, 5vw, 64px)"
    fontWeight: 400
    lineHeight: 1.15
  title:
    fontFamily: 'Jost, "Futura PT", Futura, sans-serif'
    fontSize: "clamp(32px, 4vw, 44px)"
    fontWeight: 400
    lineHeight: 1.2
  entry-title:
    fontFamily: 'Jost, "Futura PT", Futura, sans-serif'
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 400
    lineHeight: 1.25
  name:
    fontFamily: 'Jost, "Futura PT", Futura, sans-serif'
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: '"Nunito Sans", "Proxima Nova", sans-serif'
    fontSize: "18px"
    lineHeight: 1.8
  field:
    fontFamily: '"Nunito Sans", "Proxima Nova", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"Nunito Sans", "Proxima Nova", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.6
  button:
    fontFamily: '"Nunito Sans", "Proxima Nova", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
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
---

# Design System: Arnaud Belec — Journal and Administration

## Overview

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

Journal outer padding is (36px clamp(20px, 5vw, 80px) 96px); admin is (32px clamp(20px, 4vw, 56px) 64px). Navigation is a wrapping, space-between row with a bottom rule and (24px) bottom padding. Admin content caps at (1200px); the journal list at (1040px), article at (880px), article header at (720px), writing document at (960px), login at (440px).

Journal entries pair a (150px) date column with flexible content and a (28px) gap. The index begins (88px) below navigation. At widths at or below (600px), entries become one column with a (10px) gap, index top space becomes (52px), article top space becomes (40px), and shell top padding becomes (24px). Navigation gaps reduce from (28px) to (20px). Actions wrap with (10px) gaps; editor toolbar and preview banner also wrap rather than overflow.

The editor document uses fluid (20–64px) inset, replaced by (20px 16px) on phones. The toolbar sticks to the viewport top with an opaque paper ground, bottom rule and z-index (20). BlockNote has intentional negative outer margins and internal left padding for block handles; preserve the mobile overrides rather than applying a global card inset.

## Elevation & Depth

The authored shell is flat: no custom drop-shadow vocabulary, glass or floating decorative cards. Tonal differences and single-pixel rules separate page, document, fields and notices. BlockNote's library-owned menus may retain their native overlay treatment; that is not a new shell shadow token. No custom motion or transition scale is declared in the scoped stylesheet.

## Shapes

Controls, login, notices and writing document use nearly square corners: the frontmatter control radius. Rules and field outlines are (1px). Journal entries are open rows, not rounded cards. Quotes use a single tan left rule; unavailable media uses a dashed outline. Media preserves its aspect ratio with `object-fit: contain` and an (85vh) height ceiling.

## Components

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
