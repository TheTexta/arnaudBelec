# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

Arnaud Belec presents photographs, films, fashion projects and multimedia journal posts. Arnaud authors projects, writing and site settings in a private native CMS rather than editing source files.

## Capabilities and constraints

- Preserve the existing photography experience and photo-upload workflow.
- Typography decision (2026-11-05): use owner-supplied P22 Cezanne Pro, cursive site-wide, including photography, CMS and previews. Shared `next/font/local` delivery supplies Regular (400, normal) only with synthesis disabled; Google fonts are removed. Local wiring does not establish web rights: owner confirmation of an appropriate self-hosted web licence is required before deployment or distributing the asset; see `app/fonts/README.md`.
- Use one Arnaud-only Supabase login and native Payload 3.92.1 shell, with Photographs, Journal, Videos, Fashion projects and Site settings.
- Use native Lexical writing, drafts, autosave, private preview, version recovery, explicit publishing and verified direct media uploads. BlockNote is retired.
- Supabase owns identity/Postgres metadata; R2 holds originals. Native media remains private and becomes anonymously readable only through current published references, never draft/version references.
- Reuse the site's explicit server-side admin allowlist. A hidden URL is not authorization.
- Production migrations, configuration changes, and deployment require separate approval.
- `/` is a separate entrance; `/photos` is the palette-driven archive, with unchanged `/photos/[filename]` links. Journal remains `/blog`; video and fashion have independent indexes/details.
- Homepage decision (2026-11-05): four irregular, varied-size section image-links over genuine cursor-driven pink/yellow fluid with pastel-blue filler. Preserve the current P22 face, sharp original media and independent interiors. Each slot supports text-only, a published catalogue thumbnail or a verified native image; Payload Site settings owns all four choices and the three palette roles through drafts/autosaves/versions and explicit atomic Publish. Only published active references authorize native media. The additive migration is prepared, not applied to production.
- Curated colour/monochrome modes never infer classification or desaturate originals. Unclassified work stays available in All.
- Sound is opt-in, with no autoplay or hover audio. Music requires an owner-supplied authorized track.
- Newsletter is independently default-off, double opt-in and suppressed on unsubscribe. Provider/sender acceptance and actual sending require separate approval.
- Fashion is an editorial portfolio, not a shop. The image-sequence garment viewer is not 3D reconstruction. DVD commerce and real reconstruction remain separately gated.

## Evidence on hand

The 2026-11-05 site-wide P22 Cezanne Pro decision supersedes the earlier
Jost/Nunito font direction below without replacing the established palettes,
themes or layout. Earlier browser evidence using Jost/Nunito is pre-Cezanne and
does not verify the new face.

The subsequent 2026-11-05 readability correction raises targeted operating and
supporting roles without changing headings or the Regular-only face. The owner
reports 49 strict P22 browser checks passed; independent review resolved that
specific readability finding only, not full-site/production acceptance. Final
builds and the existing web-licence approval gate remain pending.

The photograph pages retain their palette-driven visual identity. For Journal
and article preview, the user chose `https://arnaudnaudbel.myportfolio.com/`:
black grounds, tan accents, and geometric typography. Close open-source font
alternatives are explicitly approved; exact Adobe fonts require authorized web
delivery. For the homepage only, the user's pinned Pavel Dobryakov fluid simulation
and nepobabies irregular image-link composition supersede the earlier album-art
direction; images and palette must both remain editable in Payload. Home uses a
static fallback for reduced motion/no WebGL, with no touch interception or cursor
replacement. Other public expansion surfaces retain album artwork from Spotify playlist
`7sEhYBYXqUw7BvapE6A5D3`: photographic softness, muted pastels and occasional
blue/yellow highlights, with the photo renderer's shared pixel grain/dithering.
This is not Spotify UI and does not license playlist artwork/music. Native admin
remains monochrome with automatic/light/dark themes. Existing editorial content
must be retained; empty new sections do not justify invented work or a reset.

Homepage finish disposition is **ship for supplied synthetic snapshots and source
only**, with no blocking visual/source fixes. This does not establish deployment
or real owner-selected-content acceptance. Production migration/configuration,
deployment, real image selection/acceptance and the existing font web-licence gate
remain separate gates; detailed evidence is in `.impeccable/surfaces/homepage.md`.
