# Existing YouTube links converted to players — 2026-11-09

**Subsequent behavior change:** the owner later requested default embeds,
muted viewport autoplay and click-to-unmute, then authorized committing/pushing
the application follow-up to deployment-linked `main`. Its behavior/local checks are in
[`page-customization.md`](page-customization.md#playback-privacy-and-authorization).
The click-to-load descriptions below are historical production-conversion evidence.

The owner explicitly requested **“convert them into embeds”** after the player
deployment. This authorizes changing the primary playback source on the four
already-published, previously link-only imported Video entries—not publishing
other drafts, changing copy, rehosting videos or changing YouTube permissions.

## Applied changes

| Existing Video route | Existing YouTube source |
| --- | --- |
| `/video/struggles-and-jugglers` | `R7oFdBKswIo` |
| `/video/the-bins-from-trash-to-treasure` | `34dthdTo4Rc` |
| `/video/a-quiet-gaze-into-tvm-bootcamp` | `ux9BG4qgobc` |
| `/video/nightmare-on-mctavish` | `TyQC8Ew05ho` |

Each now uses `videoSource: youtube` and its canonical YouTube watch URL. The
published main snapshot and latest saved content were checked to agree before
editing; no unrelated private draft was silently published. Updates used complete
existing editable fields, the current optimistic revision and explicit published
status through the authenticated native CMS API. First-publication timestamps and
therefore publication ordering are unchanged.

The existing body links, titles, text, credits, years, URLs, covers, galleries,
film selections and publication states are preserved. No YouTube master was
downloaded or represented as an uploaded original. The uploaded XIX film and older
private Lullaby/To Hang projects were not changed. The existing click-to-load player
is used on the listing and individual pages; no application deployment was needed.

## Preservation and recovery

- Fresh native-schema backup SHA-256:
  `b941956984a42185a717954a4619de595359c9979a12bb90bad883882c951ca3`.
- Pinned conversion plan SHA-256:
  `c03281bea0a74a20b93eb7e24dec1ae209e83875c3786211cd0653fe757cf18b`.
- Only the four source selections/URLs and normal revision/update timestamps
  changed. All **43 unrelated native/public tables** are byte-equivalent.
- All seven main Video records remain present. The four existing main records
  retain all other fields; native versioning added four published snapshots.
  Original historical version contents are unchanged; only native latest-version
  bookkeeping changed on superseded snapshots.
- All 71 Media records, three original-import journals, 94 photographs, palettes,
  remaining drafts, Site settings, schema, grants, roles and migration ledger are
  unchanged. Newsletter remains disabled; no email or new publication was created.
- One temporary session used the already configured CMS identity. It sent no
  email, introduced no account/password/permission/API-key change, was revoked with
  local scope, and retained all 20 prior/other sessions. Its credential artifact
  was deleted; no credential was stored in the repository.

Non-secret operational evidence is under ignored
`.local/youtube-embeds-20261109/`. The native prior versions and fresh backup are
retained for reviewed recovery; do not restore the database or silently unpublish
content to reverse an individual playback choice.

## Verification

All four original links returned successful YouTube oEmbed metadata with matching
titles. Native authenticated/anonymous read-back passed. All four individual pages
return 200 with their expected source and Play control; `/video` includes all four
sources. These checks establish conversion and delivery, not actual video playback.
Real-provider browser results are recorded separately in the ignored browser
evidence directory; iframe creation alone must not be reported as playback.

Real production playback subsequently passed in anonymous Chrome 156 for all four
individual films. Correct YouTube identities, `youtube-nocookie.com` iframe hosts,
advancing time, playing state and decoded frames were checked—not just load events.

| Film | Decoded test resolution | Observed playback / duration |
| --- | --- | --- |
| struggles and jugglers | 640 × 360 | 3.83 / 601.82 seconds |
| The Bins | 854 × 450 | 3.47 / 223.94 seconds |
| A quiet gaze | 640 × 360 | 3.19 / 111.10 seconds |
| Nightmare on McTavish | 1280 × 676 | 3.56 / 110.74 seconds |

These are YouTube's automatically selected test renditions, not claims about the
original masters. The listing showed four Play controls without YouTube/thumbnail
requests or iframes before interaction. Keyboard playback and 390px mobile-layout
playback passed, with no horizontal overflow. Keyboard and settled-pointer handoff
both removed the first iframe and played the second; the native film stayed paused.
The initial immediate-scroll pointer attempt did not start the second player and
is retained in `results.json`; explicit settled repetitions passed, without a
confirmed source bug or a code change.

Screenshots were visually reviewed. `browser/results.json`, `handoff.json` and
`handoff-pointer.json` retain the actual provider evidence. Browser checks created
no CMS writes, Auth sessions or deployments. Full-length watching and physical
Safari/iOS remain outside this short Chrome desktop/mobile-emulation acceptance.
