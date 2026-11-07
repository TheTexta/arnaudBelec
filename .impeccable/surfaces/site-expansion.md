---
version: 1
slug: "site-expansion"
primary_target: "components/site"
related_targets: ["app/(website)", "components/site-effects", "components/site-audio"]
---

# Public portfolio expansion

Experience mode for a visitor exploring Arnaud Belec's photographs, films and fashion projects. Existing writing stays Read mode. Native admin remains monochrome Operate UI, outside this visual system.

## Direction contract

**THESIS:** A photographic, album-sleeve-like entrance to Arnaud's work, not a dashboard, music-player imitation or equal-card portfolio grid.

**OWN-WORLD:** User-pinned Spotify playlist `7sEhYBYXqUw7BvapE6A5D3`: muted chalk, powder blue, faded lilac, dusty rose and pale butter; occasional electric-blue/yellow interruptions. Reuse the existing photo-page pixel grain, dithering and pixelated glow. Use Arnaud's actual published imagery, never album-cover copies. Controls and original media stay sharp.

**STORY:** Enter at `/`, then choose Photography, Journal, Video or Fashion. Public work is deliberately published through the existing Arnaud-only CMS. Empty sections explain their state without invented projects or commercial claims.

**FIRST VIEWPORT:** Arnaud's name and a spare route index surround an atmospheric photographic field, with soft colour bleeding, a small bright accent and slow wave-like motion behind readable text. Mobile keeps the same image-first rhythm without horizontal overflow. Contact anchors the close.

**FORM:** Explicit user-pinned aesthetic and roadmap; code-led because no image-generation workflow is available. Existing photography and warm Journal identity are preserved, with shared public texture. `seed: none (user-pinned)`.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Implemented record — 2026-11-04

**Typography supersession — 2026-11-05:** current public, photography, CMS and
preview typography is P22 Cezanne Pro, cursive via `app/site-font.ts` and shared
`--font-site`; legacy display/text aliases point to it. Regular (400, normal)
only, with synthesis disabled; no Google fonts, conversion or invented faces.
Heading sizes, declared weights, composition, colors and grain are unchanged. References
to Jost/Nunito in this dated record describe the prior implementation. The
owner-supplied original is local wiring, not proof of web licensing; owner
confirmation of appropriate self-hosted web rights is required before deployment
or distributing the font asset. See `app/fonts/README.md`.

**Targeted readability correction — 2026-11-05:** public body/navigation/footer/
intro are (20px/1.7), including mobile navigation; captions/metadata are (18px),
project reading text (20px/1.8), sound status (18px/1.65), and photo small-text
roles (18px/1.7). CMS body and operating text are (20px/1.65); Journal dates and
captions (18px/1.7), legacy fields/buttons (20px). Headings and the owner-selected
Regular-only face are unchanged. These current values override the old small
roles recorded below.

Implementation documented; independent finish review returned **ship** for the
supplied synthetic desktop/mobile captures, not production approval. The
scoped public additions in `DESIGN.md` and `public-*` metadata in
`.impeccable/design.json` supplement, not replace, Journal/native-admin authority.

- **Routes:** `/` is the separate photographic entrance; `/photos` and existing
  `/photos/[filename]` retain their native palette renderer. `/video` and
  `/fashion` have staggered editorial indexes and individual project details.
  `/blog` keeps black/tan reading colors beneath restrained shared texture.
  `/admin` and `/cms` receive no public atmosphere; CMS stays monochrome.
- **Composition:** desktop entrance has a large Jost name, image field and narrow
  route index; mobile uses a wrapping route row and full-width contained image.
  Project lists stagger on twelve columns, stacking at (700px); details separate
  original media, reading copy, credits and views rather than equal-size cards.
- **Material:** muted album-art pastels, not Spotify UI. Source authority is
  `components/site/site.css`, `lib/visual/atmosphere.ts`, and `BLOOM_DEFAULTS` in
  `lib/visual/bloom-shader.ts`. The real shared photo grain/dither shader adds
  background-only waves and intermittent blue/yellow light. It loads lazily,
  stays inert behind crisp text/media, stops in hidden tabs and freezes under
  reduced motion; plain CSS gradients are the fallback, not equivalent grain.
- **Interaction:** approved self-hosted Jost/Nunito Sans; visible keyboard focus,
  skip link and wrapping (44px) controls. Sound remains explicit opt-in; native
  media pauses ambient music without automatic resume. Garment views are supplied
  image sequences with drag, arrow/Home/End keys and Previous/Next/Reset controls,
  not generated geometry. Unconfigured/empty states do not fabricate work.
- **Assets:** no new shipping raster assets. Real content comes from published
  catalogue/nativeMedia references. Existing `public/test-image.jpg` remains
  unchanged and local-fixture-only. No copied album covers, proprietary font
  binaries, licensed-music claim or 3D-reconstruction claim.

## Evidence boundary

Current P22 follow-up: the implementation owner reports **49 strict browser
checks passed** at (390px) and (1440px), including custom glyphs on photo and CMS
controls. Independent review reopened six captures and scored the small-type
readability finding **RESOLVED**, with **ship for that finding only**. This is not
full-site or production acceptance. Final builds remain pending; licensing remains
gated. Detailed checks are owned by `docs/site-expansion.md`.

Pre-Cezanne local captures: `.local/site-expansion-browser/home-{1440,390}.png`,
`journal-390.png` and `fashion-detail-390.png`. The accompanying `result.json`
reports 45 checks passed using real production-cached Jost/Nunito WOFF2 supplied
through Next's official local test stub, not fallback glyphs. This is
pre-Cezanne evidence, not browser validation of the 2026-11-05 font change. New
font checks are recorded separately by the implementation owner in
`docs/site-expansion.md`. This is synthetic
content evidence only: real-content acceptance, real media transfer and film
playback are false; empty sections and Journal inline media were not exercised.
These captures are not shipping assets or deployment approval. The independent
finish review found no material visual fixes within the supplied evidence; it did
not certify contrast, real film playback, inline Journal media, external services
or motion quality from still images. Existing Journal/admin documentation and
tokens were preserved with namespaced public additions, not a global replacement.
