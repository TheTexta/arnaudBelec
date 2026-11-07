---
version: 1
slug: "fashion-projects"
primary_target: "components/site/ProjectDetail.tsx"
related_targets: ["components/site/site.css", "app/(website)/fashion"]
---

# Fashion project reading layout

**Production scope note (2026-11-06):** the P22/pastel direction and local finish
record below describe the pending main checkout only. The separately approved
Circle of Fashion release preserves the actual live **Jost/Nunito Sans,
black/tan identity** and borrows structure only. Its production renderer is
`components/projects/Projects.tsx` with `fashion.css`, not the broader local
`components/site/` implementation.

Experience mode: visitors view Arnaud's garment work through its photographs.
The user selected the structure of Dexter's portfolio writeups, not their
monochrome styling or typography. Arnaud's current P22 face, public Fashion
palette, navigation and background remain authoritative.

## Direction contract

**THESIS:** One centred editorial column lets the photographs carry the project,
not a masonry grid, slideshow, shop or elaborate case study.

**OWN-WORLD:** Retain the existing Fashion colours, Regular-only P22 font,
sharp original media, square controls, background texture and visible focus.
Borrow only the portfolio writeup's 672px reading measure and mobile gutters.

**STORY:** Read the project name and exact source introduction, then scroll its
photographs in source order. Return through the existing Fashion index link.
The separate PHASSION series and existing private Fashion selection are excluded.

**FIRST VIEWPORT:** Existing site navigation, a quiet return link, left-aligned
project title/year/introduction, then the first uncropped photograph in the same
centred column. The remaining photographs stack at their natural aspect ratios.

**FORM:** User-pinned portfolio writeup structure; code-led local extension.
`seed: none (user-pinned)`.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Boundaries

Use the existing native Media and Fashion project model, protected preview and
published-only loaders. No production import, publication, migration or deployment
is authorized by the local implementation. Extracted Adobe JPEG renditions are
retained byte-for-byte with their source URLs, order and checksums in an ignored
local bundle; they are not camera originals or automatically published assets.
Video, photography and other in-flight source changes remain untouched.

## Scoped finish record — 2026-11-06

This is an extension of the incumbent design, not a new visual world.
`DESIGN.md` and `.impeccable/design.json` were read and preserved without edits
by the finish documenter. Their current P22 exception and public Fashion palette
remain authoritative; this surface record documents the narrower layout exception
to the older shared detail/gallery description, not a global token refresh.

Compared `components/site/ProjectDetail.tsx` and `components/site/site.css`
(Fashion rules at lines 130–136) with
`portfolio/app/components/projects/project-write-up.tsx`: only the centred reading
measure and responsive gutters are borrowed. Fashion places its introduction
once, above the cover; Video retains its introduction position and desktop
two-column gallery. The Fashion column caps at (672px), with minimum gutters of
(20px), increasing to (32px) at (640px). Images retain natural ratios without
the shared height ceiling. No monochrome portfolio styling, new colours, type
roles, cards, generated compositions or shipping raster assets were introduced.

The documenter opened all four captures in `.local/fashion-browser/`:
`fashion-390-viewport.png`, `fashion-390-full.png`,
`fashion-1440-viewport.png` and `fashion-1440-full.png`. They show the existing
P22 handwriting, dark-blue public ink, pastel/textured Fashion ground and shared
navigation; left-aligned title/year/copy precede an uncropped, ordered vertical
sequence. The full-page captures are sequence evidence, not full-size glyph
inspection; the viewport captures and browser glyph check supply that evidence.

`result.json` records **13 passing browser checks** using actual Next routes,
loopback-only CMS/local files and blocked external requests. At (390px), the
column measures (350px) with (20px) side gutters; at (1440px), it measures (672px)
with (384px) side margins. Checks cover exact copy once, ten images in order,
natural ratios, one column, no overflow, actual P22 glyphs, visible keyboard focus,
Fashion index round-trip, draft/unknown-slug 404s, unchanged Video layout/controls
and a mounted, after-hydration image-failure original-link fallback. The optional
manifest fixture is disposable local public test state; the default fixture stays
synthetic and no CMS publishing bypass is hardcoded into application source.

**Disposition:** the supplied independent fresh read-only finish review returned
**SHIP for this local code and supplied desktop/mobile evidence**, with no blocking
findings. It reran three parser tests and inspected the other reported checks.
The mechanical detector ran once and reported only eight pre-existing CSS
colour/type-ramp advisories; this extension adds no new values in those categories.
No unrelated drift was repaired. This is neither whole-site nor production
acceptance. Production import/publication/deployment require separate approval;
the existing P22 web-licence and main/category-only release mismatch gates persist.
Detailed provenance and implementation-check status are in
`docs/circle-of-fashion.md`.

## Scoped production finish — 2026-11-06

Live: <https://arnaud-belec.vercel.app/fashion/circle-of-fashion>, deployment
`dpl_9ncY5tyxrH4aJ27VkfTFHR9q1pWZ`, preserving the latest video/palette baseline.
The exact source copy and ten unchanged JPEGs were imported and published through
the native CMS, with existing drafts and media privacy preserved. The independent
finish reviewer opened all four staged-public captures, returned **SHIP**, and
confirmed the old desktop-width conflict resolved. The final canonical Chrome
checks also passed at 390/1440px: 350/672px columns, uncropped ordered images, real
Jost/Nunito glyphs, visible focus, no overflow/page errors and index navigation.
Screenshots and bound approval records are in ignored
`.local/fashion-production-20261106/`; production results, gateway correction,
temporary-session revocation and limitations are in `docs/circle-of-fashion.md`.
This does not approve the wider main-checkout design, P22 deployment or a whole-site
accessibility audit. Existing `DESIGN.md` and design tokens were not changed.
