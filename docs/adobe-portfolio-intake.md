# Adobe Portfolio intake and publication

Source: <https://arnaudnaudbel.myportfolio.com/films>, expanded to the source
site's sitemap and same-origin links. The original preparation scope did not
authorize uploads or publication. Subsequent separately approved private import
and publication are recorded below; these records are not standing approval for
future imports, migrations or deployments.

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

- At the private-import checkpoint, the 78 photographs remained local because the
  uploader publishes immediately. The owner subsequently approved their publication;
  see the executed publication record below.
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

## Executed owner-approved publication — 2026-11-07

The owner then said **“i approve all”**. The stated execution scope was publication
of the five completed scraped entries and unmatched photographs, not incomplete
YouTube placeholders, unrelated existing drafts or unassigned supporting assets.

### Published content

- Fashion: `/fashion/phassion` — cover plus four gallery images, with source credits.
- Journal: `/blog/tableaux`, `/blog/digital-tableaux`, `/blog/sunday-missile`.
- Video: `/video/xix-visuals-for-december` — verified 1080p film, poster and three stills.
- **78 photographs / 343,181,220 bytes:** 13 Street photography, seven Black and
  white, eight Portraiture, 22 Multicaf and 28 Theatre costuming. `/photos` now
  contains **94 photographs**. New source collection labels/order and visually
  reviewed alt descriptions were saved; capture dates were left unset. These are
  the pinned Adobe renditions, not claims of camera-original quality.

The pinned publication plan is
`5bd033f56387d1047c2d0dbdd0297baee17ff86a919c0308c13c77b3d446bad5`.
Its five IDs are bound to the completed original import journal; corrected raw
snapshot ordering and complete latest editable draft content were rechecked.
Native publication PATCHes included that complete content, current `editRevision`
and `_status: published`, without `draft=true`; no status-only stale-row publication
was used. The remaining eight private entries, including all four missing-original
YouTube placeholders, still return anonymous 404s.

### Photograph transport and recovery

All 16 existing catalogue originals were downloaded and hashed, and all candidate
contact sheets were visually compared against them. There were no new exact-byte
matches against the existing catalogue or 58 CMS Media items. Previously recorded
composition exclusions and cross-gallery aliases remained excluded.

Samples were generated with Chrome using the native orientation-aware bitmap,
downscale-only 256px canvas PNG workflow. The native prepare/publish endpoints
retained the current **Supabase** new-photo provider and server-side MMCQ analysis;
no migration, service-role client storage write, RLS change or deployment occurred.

**Compatibility finding:** production Storage is `supabase/storage-api:v1.14.6`.
Its signed TUS creation rejected the first request (missing JWT), and adding anon
JWT context still produced RLS denial. No upload resource/original/catalogue row
was created. Standard `uploadToSignedUrl` is supported, using the exact native
prepare capability, anon client and `upsert: false`. The first capability expired
after 120 seconds during diagnosis; absence and expiry were explicitly checked,
the old ticket was retained in the journal, and only then was a replacement prepared.
The 78 originals were transferred through standard signed PUT, then published via
native multipart sample/metadata POST. Every published original passed independent
full byte-count/SHA-256 read-back. Uncertain responses remain a hard reconciliation
gate; they never justify blind replacement tickets.

The ordinary Supabase **browser TUS upload path remains an unaddressed compatibility
issue** on that Storage version. This operator intake did not change the browser,
upgrade shared Storage or relax access controls. Its signed-PUT transport is the
verified workaround for this approved run; R2 upload acceptance remains separate.

### Verification and cleanup

- All 78 new photo pages returned 200 with their descriptions; the 25 newly public
  CMS originals also passed full anonymous hash read-back.
- All 78 stored palettes/backgrounds exactly matched local reanalysis of the
  submitted browser samples: `mmcq64-vibrant-oklab-background-v1`.
- Existing 16 catalogue rows/palettes, unrelated CMS records and all Site settings
  remained unchanged. Public CMS counts are 36 Media, four Journal posts, one Video
  and two Fashion projects; no extra originals or drafts were created.
- **22 anonymous browser checks at 390/1440px** passed: five entries, one photograph
  from each source group and the 94-photo archive. Images decoded, XIX played and
  sought at 1080p, with no horizontal overflow or browser page exceptions.
- Newsletter remained disabled; delivery/subscriber counts stayed **0 / 0**.
- The temporary publication API session was revoked, all prior/other sessions were
  preserved, and its token plus 80 upload-capability/diagnostic files were removed.
  No permanent API key, user, password or permission change was introduced.

Reproducible operator helpers are `prepare-publication.mjs` (read-only preparation),
`make-publication-plan.mjs` (local plan binding), `publication.mjs` (explicit
hash-confirmed native writes), and `verify-publication-browser.mjs` (anonymous
GET-only acceptance). Non-secret evidence is under
`.local/adobe-portfolio-publication-20261107/`, including the two publication
journals, original hashes, browser results, palette checks and `session-closed.json`.
Credentials and signed capabilities were never written into that repository bundle.

Final local checks passed: **35 scoped tests**, lint, TypeScript and
`git diff --check`. No build/deployment was needed for these operator-only changes.

## Final linked-video / Media-library follow-up — 2026-11-07

The owner requested publication of the remaining videos and unassigned assets,
then explicitly selected **“Publish with YouTube links”** and clarified the assets
should **“just upload to the journal media”**. This authorizes four linked Video
entries and private library intake, not a Journal archive post, embedded players,
new page placements or publication of unrelated older drafts.

### Completed

The four imported Video entries are now public with their preserved source links,
titles, copy and attribution:

- `/video/struggles-and-jugglers`
- `/video/the-bins-from-trash-to-treasure`
- `/video/a-quiet-gaze-into-tvm-bootcamp`
- `/video/nightmare-on-mctavish`

Their original files are still not rehosted and there is no on-site YouTube player.
Publication used their pinned existing IDs, complete latest editable fields and
current revision through native PATCH, without `draft=true` or stale status-only
publication. Older Lullaby/To Hang by a Thread/Fashion selection drafts and the
unrelated private Journal draft remain unchanged.

**13 private Journal Media originals / 47,558,686 bytes** were added: 11 images and
two distinct Adobe background clips. Native conditional signing/PUT, receipt
registration, server verification and full original SHA-256/byte read-back passed.
Images have visually reviewed alt descriptions; captions retain source page/role
and explicitly identify unassigned library assets. No new Journal post was created.

Six cover crops repeated already-owned compositions: Theatre costuming 08,
Circle of Fashion 04, the Sunday Missile circular collage, Digital tableaux's
circular face, the XIX orange-stair poster and the first Tableaux painting. Those
were not copied again. Five already exist in Media; Theatre 08 remains in the public
photograph catalogue. Comparison was visual composition/crop evidence, not a claim
of equal bytes. The two identical homepage Adobe clip IDs share one imported
original. All frozen source files remain untouched.

The final native Media library contains **71 items**. Public collection counts
are 36 Media, four Journal posts, five Videos and two Fashion projects; the new
unassigned library originals remain denied anonymously. All 94 photographs and
their palettes, unrelated CMS records and Site settings stayed unchanged;
newsletter remained disabled. No deployment, schema, provider, Auth permission,
homepage or public media-placement change was made.

### Verification / recovery evidence

- **34 browser checks at 390/1440px** passed: eight anonymous linked-video page
  checks and 26 authenticated Media decode/playback checks. Both private clips
  played/sought at 1080p; public pages contained their exact outbound YouTube links,
  no embedded players, no horizontal overflow and no page exceptions.
- **36 scoped tests**, lint, TypeScript and `git diff --check` passed.
- The temporary session was revoked with all other/prior sessions preserved;
  its token and pending receipt artifacts were absent after cleanup.
- Evidence: `.local/adobe-portfolio-final-media-20261107/`, including visual
  duplicate decisions, upload/import journals, linked-video publication journal,
  final verification and browser results. The upload plan SHA is
  `74c4075879aa62a9ff78704a3aeec59e997d3f05079c7ecff8da471ad36ce4e3`;
  the linked-publication plan SHA is
  `8078909317c1116e9bda9897b63c21b8b8dfe82adbf8e5d62e1036631ef6b919`.

`finish-intake.mjs` makes the bounded plans and publishes only their four pinned
linked entries. The importer accepts the explicit `unassigned-journal-media-only`
profile with zero drafts and bounded unique assets from verified placement-review
sources. Run Media intake before link publication: publication changes the pinned
video baseline. Uncertain operations remain a hard reconciliation gate, not
permission to discard journals or blindly repeat a write.
