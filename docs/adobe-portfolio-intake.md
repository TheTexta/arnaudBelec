# Adobe Portfolio scrape preparation

Source: <https://arnaudnaudbel.myportfolio.com/films>, expanded to the source
site's sitemap and same-origin links. This is **local preparation**, not approval
to upload, edit existing CMS documents, publish, migrate or deploy.

## Run

```sh
node --test scripts/portfolio/prepare.test.mjs
node scripts/portfolio/prepare.mjs .local/adobe-portfolio-NEW-DIRECTORY \
  --existing "/Volumes/A044/arnaud portfolio" --adobe-video
node scripts/portfolio/prepare.mjs verify .local/adobe-portfolio-NEW-DIRECTORY
```

Use the repository's supported Node version and installed `sharp`. Optional Adobe
video preparation also requires existing `ffmpeg`/`ffprobe` executables. The tool
never installs software, loads `.env`, authenticates, or contacts CMS/storage/DB
write APIs. With no arguments it prints help. It only makes public source GETs,
reads existing supplied images, and creates one new direct child of ignored
`.local/`. Existing destinations, including partial runs, are refused before
network requests. Failed/partial files are retained, never silently removed.

If the supplied drive is unavailable, explicitly replace `--existing ...` with
`--recorded-exclusions`. That mode retains the source-ID/composition decisions
established during the earlier 2026-11-06 read-only comparison, without claiming
fresh local hashes or matches. Exclusions are labelled
`recorded-existing-composition-not-downloaded` and must be resolved against the
current CMS before upload. This fallback is useful for staging new work while the
drive is disconnected; it is not an upload-ready dedupe certificate.

## Bundle

- `inventory.json`: frozen discovery before media downloads.
- `manifest.json` / `manifest.sha256`: provenance, source order, dimensions,
  byte counts/hashes, exclusions, aliases, failures and limitations.
- `images/`: highest advertised Adobe renditions, preserved without re-encoding.
  No claim is made that these are camera originals. Advertised lightbox links
  remain in source snapshots for optional later original-quality investigation.
- `videos/`: optional highest-exposed, unencrypted Adobe HLS segments, local-only
  playlists and stream-copy MP4s. No video/audio encoding or supplied-master changes.
  Expiring CDN capability URLs are used in memory, not saved. Equivalent encoded
  segment sequences are identified without deleting either source record.
- `sources/`: page HTML as inert `.html.txt`, plain text, source sitemap and CSS
  snapshots. Source scripts are parsed as data, not executed.
- `cms-drafts.json`: proposed native CMS field/asset mappings, **not** an executable
  Payload import or fabricated Media IDs.
- `photographs-queue.json`: review queue; the current Photographs tool publishes
  immediately and therefore requires separate explicit publication approval.
- `summary.json` / `UPLOAD-REVIEW.md`: operator handoff and unresolved work.

## Duplicate decisions

The supplied drive contains the originals used by the completed photography and
private project intake. Before excluding known compositions, the tool hashes those
local images and checks public previews against the expected images. This includes
the Circle of Fashion copies under two Adobe UUID sets, five existing photograph
compositions and the existing film poster. Two cross-gallery images have identical
preview compositions and retain canonical associations. These are explicitly
**composition-level decisions**, not claims of identical original bytes. Review
meaningful changes in grading/cropping before dismissing alternate versions.

Full downloaded-byte SHA-256 matches are separately labelled. No existing file,
draft, Media record or object is replaced. The current authenticated CMS inventory
must still be refreshed before any upload: drive/receipt evidence is not a live
Media-ID lookup. The old ten-file Circle extraction remains untouched and should
not be imported as another copy of the existing Fashion selection's originals.

## Destination decisions

| Source material | Proposed destination | Gate |
| --- | --- | --- |
| Street/B&W/portrait/Multicaf/theatre photography | Existing Photographs tools; current public archive `/` | Confirm classification, alt text and explicit immediate publication |
| PHASSION | New private Fashion project | Preserve Sophie Miretsky/Nora Roos collaboration credit and source ordering |
| Circle of Fashion | Look up existing Fashion selection; reuse existing Media | Do not overwrite or create another duplicate project automatically |
| To Hang by a Thread | Existing private Video draft | Reuse existing poster/stills and separately managed originals |
| XIX visuals | New private Video draft with four stills and its Adobe clip | Review title, credits, cover and rendition quality |
| Four YouTube embeds | Proposed Video drafts, film fields unresolved | Obtain authorized originals/downloads and verify codecs/size; retain TVMTelevision attribution |
| Tableaux / Digital tableaux / Sunday Missile | Proposed Journal posts | No dedicated artwork/music collection exists; owner must review editorial placement |
| Contact portrait, collection covers, service thumbnails, backgrounds | Hold/private Media after review | No invented About page or automatic Site settings changes |

All source text, image order and external links are retained. Missing alt text is
not invented. Fashion collection credits are kept separate; photographing the
theatre course is not treated as a claim of fashion-design authorship.

YouTube oEmbed supplies public titles and attribution only. No YouTube binary
download is attempted or claimed, and no downloader is installed automatically.
The native uploader's **100 MiB** ceiling remains unchanged. Larger authorized
films must use separately verified large-original support; do not raise the limit
or bypass verification hooks. Published Adobe clips are not substitutes for the
existing supplied 4K masters.

`/sporadic-thread` stays password-blocked. Linked Instagram/TikTok/YouTube channel
archives are outside this bounded site scrape. No login or access bypass occurs.

## Upload handoff

1. Verify the bundle's pinned manifest and every referenced staged/source file.
2. Refresh authenticated native Media/Photographs/project inventories and compare
   hashes and reviewed composition identities; resolve real existing Media IDs.
3. Review proposed destinations, source text/credits, variants, covers, order and
   alt text. Resolve YouTube originals and every failed/held asset first.
4. With separate upload authorization, upload only unmatched eligible files using
   native signing/direct transfer/receipt/server verification. Do not inject
   `verified`, hashes or storage identities through ordinary create/PATCH APIs.
5. Create new private drafts using actual returned Media IDs, preserving existing
   drafts and versions. Private preview and anonymous-denial checks precede any
   separately approved publication. The Photographs publication gate is independent.

No application route, schema, provider configuration or deployment change is
required for this preparation tool. Do not deploy the unrelated dirty main
checkout to make a bundle usable; the category-only production baseline and
remaining expansion gates still apply.
