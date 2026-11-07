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

To retry only Adobe videos without redownloading images or changing a pinned
bundle, run `node scripts/portfolio/prepare.mjs videos .local/SOURCE-BUNDLE
.local/NEW-SUPPLEMENT`. The supplement pins its source manifest and its own files;
verify both bundles. Existing failures remain honestly recorded in the source.

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

**Owner follow-up (2026-11-07):** upload of ready content was authorized, followed
by a request for agent-generated API authentication rather than manual login.
Publication remains unrequested. Existing Payload API-key routes remain disabled;
the operator uses a temporary normal Supabase session for the already configured,
confirmed Arnaud admin and revokes only that session afterward. No account,
password, permissions, shared signing keys or application authentication changes
are needed. Temporary tokens and receipt capabilities stay **outside the repository**
in the approved private OpenCode temporary directory (directory 0700/files 0600).
Only non-secret plans/import receipts belong in ignored `.local/`.

`scripts/portfolio/operator-session.mjs` provides explicit create/inspect/refresh/
finish operations. It reads current server-owned Auth configuration privately over
the existing Tailscale/SSH path, never prints or persists service/anon keys, and
uses the no-email `generateLink` + OTP verification flow for the existing identity.
Fresh native CMS bearer acceptance and preservation of prior Auth sessions are
checked. Pre-issuance state and a unique request User-Agent marker support
reconciliation; ambiguous issuance is a hard hold, not permission to revoke other
sessions. Cleanup verifies the exact issued session is absent and other sessions
remain, then removes only this run's token artifact.

`scripts/portfolio/upload.mjs plan IMAGE-BUNDLE VIDEO-SUPPLEMENT AUDIT-DIRECTORY
PRIVATE-SESSION-DIRECTORY` makes a fresh authenticated inventory and a pinned
`upload-plan.json`. `apply PLAN --confirm=SHA256 PRIVATE-SESSION-DIRECTORY` is an
explicit mutation command, not an automatic part of scraping. It selects only the
reviewed PHASSION, artwork/music Journal, and XIX project assets, and four
YouTube-reference private placeholders. Native Media descriptions were written
after inspecting a contact sheet. Source text and image occurrences remain in
order; the already-held `will in living.png` is linked to its existing photograph
instead of duplicated into Media.

The importer never PATCHes existing content, publishes, writes photograph rows,
or uploads placement-review assets. It uses native conditional signing/PUT and
receipt creation, compares server verification with local SHA-256/size, reads every
original back in full, and checks anonymous denial before accepting completion.
Uncertain registration/draft creation is journalled and requires explicit
reconciliation before retry, not another upload. Existing record fingerprints and
new private-draft URLs are checked afterward. Session revocation is a separate
mandatory final step, including after a partial import.

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
required for this preparation tool. Use the current verified production CMS;
deploying source is not an import prerequisite or permission to run this operator.
The separately approved full-site deployment and migrations are recorded in
[`full-site-rollout-20261107.md`](full-site-rollout-20261107.md).

## Executed intake — 2026-11-07

The owner-authorized private import completed through the existing production
CMS API. **Nothing was published, no deployment/migration/configuration change
was made, and no existing editorial project was overwritten.**

### Local source evidence

- Image bundle: `.local/adobe-portfolio-prep-20261106-bundle/` — 21 source pages,
  one password-blocked page, 148 image asset identities, **119 staged image files
  (476,348,155 bytes)**, 26 recorded composition exclusions, two reviewed
  cross-gallery aliases and one exact-byte cover duplicate. The disconnected
  supplied drive was not treated as fresh original-hash evidence.
- All 184 image-bundle artifact checks passed. The initial video failures remain
  recorded in that frozen manifest; they were not hidden or overwritten.
- Video supplement: `.local/adobe-portfolio-video-supplement-20261107/` — all
  four Adobe IDs prepared as verified 1080p stream-copy MP4s; 19 artifact checks
  passed. The two homepage IDs have identical segment and MP4 SHA-256 identities,
  so they represent three distinct clip files across four source IDs. Only the
  XIX clip was selected for import; background loops remain held.
- A fresh authenticated inventory found 33 existing Media items (all hashed), two
  Journal posts, two Videos and two Fashion projects. Circle of Fashion was already
  published with ten Media items; it was left unchanged, as were the other existing
  Fashion selection, both film projects and all existing originals.

### Native private import

Pinned operator plan:
`c3fb4d7b7f2c1261623f5677499d5df71946b95ac2e33c23941c23a81606f8a7`.

**25 new Media originals / 82,229,313 bytes:** five PHASSION images, ten Tableaux
images, two new Digital tableaux images, three Sunday Missile images, four XIX
stills and the 5,608,786-byte XIX MP4. All used native signing, conditional direct
PUT and receipt creation; server SHA-256/size, complete authorized original read-back
and anonymous denial passed. The short film also passed a byte-range read.

**Nine new private drafts:** PHASSION; Tableaux; Digital tableaux; Sunday Missile;
XIX visuals for December; and four YouTube-reference Video drafts. The four latter
film fields remain empty rather than pretending the YouTube binaries were imported.
Digital tableaux links the already-published `will in living.png` photograph instead
of creating another Media original for it. Exact source copy/credits and reviewed
image descriptions are retained.

The resulting native counts are 58 Media, five Journal posts, seven Videos and
three Fashion projects. Existing Media/Journal/Video/Fashion record fingerprints
matched after import. Every new draft denied anonymous access, and no new Media
appeared in anonymous library queries.

### Visible-placement correction and acceptance

Adobe grid markup contains image copies inside inert `script type="text/html"`
lightbox templates. The first parser counted these as placements, while correctly
downloading each asset only once. The initial browser pass mirrored that flawed
count and is **not the final gallery-membership acceptance evidence**.

The parser now excludes inert script/style/noscript/template markup while preserving
offsets and genuine visible repeat occurrences. The bounded
`correct-template-galleries.mjs` operation verified the original submitted content
and optimistic revision of **only the two newly created private projects**, then
corrected PHASSION to cover + four gallery images and XIX to film/poster + three
gallery images. No cover, film, text or original changed; all other native record
fingerprints passed and both projects still returned anonymous 404s.

Keep the original pinned plan/bundles and initial receipts as historical evidence.
Use the reparsed `visible-cms-drafts-v2.json` / `visible-photographs-queue-v2.json` and
`gallery-correction.json` under `.local/adobe-portfolio-upload-20261107/`, not the
initial template-inclusive gallery mappings. The importer now reparses pinned raw
source snapshots for future plans, and browser acceptance independently derives
visible membership from those snapshots.

The corrected live browser acceptance passed **18 private previews at 390px and
1440px**, with five PHASSION images, three XIX gallery images plus its film/poster,
all Journal images decoded, no viewport overflow or page exceptions, and actual
1080p XIX playback/seek/decoded frames. `browser-corrected/result.json` and its
captures supersede the initial `browser/` gallery-membership result. Both temporary
API sessions were confirmed revoked; their token/receipt artifacts were absent.
All other sessions present at each logout were preserved. The first run's
historical baseline had changed before cleanup, which remains recorded rather
than claiming every historical session survived unrelated concurrent work.

### Remaining gates

- The 78 staged, likely-new photographs remain local: the catalogue uploader
  publishes immediately, so its separate explicit publication gate was preserved.
- Seventeen cover/background/contact/navigation image files and three unselected
  Adobe clip copies remain held for editorial placement; one pair of those clips
  is byte-identical.
- Four YouTube original files are still missing. Password-protected content and
  external social archives remain unaccessed.
- No shared Auth identity, password, allowlist, application permission or permanent
  API-key mechanism was changed. Temporary session cleanup must remain recorded
  separately from import completion; historical session-baseline changes caused by
  other work must not be misreported as this import revoking other active sessions.

Non-secret import, correction and browser evidence lives under
`.local/adobe-portfolio-upload-20261107/`. Real credential artifacts are not stored
in the repository.

Final verification: **30 scoped parser/preparation/import-replay tests**, lint,
TypeScript and `git diff --check` passed. No application build/deployment was
needed for these operator-only scripts. `temporary-sessions-closed.json` confirms
both sessions were revoked and token/pending-receipt artifacts were absent;
`final-anonymous-checks.json` confirms all nine drafts still return 404 and public
collection counts remain 11 Media, one Journal post, zero Videos and one Fashion
project.
