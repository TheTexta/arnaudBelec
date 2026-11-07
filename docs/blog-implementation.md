# Historical BlockNote journal

> The custom BlockNote journal has been retired from the working source. Its
> previous rollout evidence below is historical. The native Payload replacement,
> complete-reset gates and current operations are documented in
> [native-payload-journal.md](native-payload-journal.md). No production reset or
> native cutover is implied by the source changes.

## Direction contract

**THESIS:** Extend Arnaud's existing admin with a focused writing workspace, not a second CMS. Public posts are readable documents whose media leads without gallery animations behind the text.

**OWN-WORLD:** Superseded by the owner's old-site reference: black ground, tan geometric titles, pale warm reading text and spare red error accents. Jost and Nunito Sans are approved alternatives to Futura PT and Proxima Nova. The journal and shared admin inherit this frame; photograph-page styling is unchanged. See the non-photograph surface brief and DESIGN.md.

**STORY:** Arnaud signs in, creates a post, writes and uploads media, previews privately, then publishes deliberately. Autosave and revision recovery protect work; published content is a separate snapshot.

**FIRST VIEWPORT:** Post list with New post and clear draft/published state; the writing view places title and excerpt above an open document, with save status and Preview/Publish actions always findable. Mobile actions wrap, not overflow.

**FORM:** The owner approved the old-site direction and close font alternatives, then requested one shared admin login with component subsections. Code-led Operate for admin; Read for journal. Existing publication/upload workflows stay intact.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Deployment and operation

The owner separately approved the database migration and Next.js security update
on 2026-10-30. The database migration is applied; app deployment, admin setup and
R2 upload enablement remained separate gates. The owner subsequently approved
the security dependency fixes and app deployment, which are live. The owner then
approved the non-photograph restyle, shared login and requested account's access.
Journal R2 uploads were separately approved, deployed and privately accepted on
2026-10-31. Photograph R2 app-upload enablement remains separate.

### Journal upload activation — deployed and privately accepted 2026-10-31

- Owner explicitly approved enabling journal image/video/audio uploads and the
  required production CORS change/redeployment. Photograph uploads retain
  `ARNAUD_UPLOAD_STORAGE=supabase`; no photo-provider switch was authorized.
- Owner chose to create an Arnaud-only R2 Object Read & Write credential and set
  `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` directly in Arnaud's Vercel Production
  environment. Do not display/decrypt those secrets or silently continue with the
  previously reused broader credential. The owner has confirmed both values are
  saved and scoped to exactly the two Arnaud buckets. This scope is owner-reported,
  not independently inferred from token metadata.
- Applied and read back staging CORS: exact origin
  `https://arnaud-belec.vercel.app`, methods **PUT/GET/HEAD**, allowed header
  Content-Type, exposed ETag, 3600 seconds. The owning source is
  `deploy/r2/staging-cors.json`. GET/HEAD support signed private editor previews;
  CORS grants no object authorization. Both buckets still have r2.dev disabled
  and no custom domains. No shared Worker or other project's configuration changed.
- Added regression coverage for the disabled write gate, allowlist enforcement
  on media/publication routes, private reads with the gate off, post-bound and
  expired reservations, lost-ETag recovery, cancellation, unsupported files and
  the exact CORS contract. All **23 journal tests**, **57 checkout tests**, lint,
  typecheck and the production build pass.
- Local Chrome file-picker acceptance passed image, MP4 and WAV uploads: exact
  direct-PUT bytes, completion before stable references, autosave, private previews
  decoding all three media types, and mobile overflow. Auth/API/storage were
  fixtures; no production content or media was written. Fixtures and captures
  remain under ignored `.local/`, not public assets.
- Configured server-only `ARNAUD_BLOG_UPLOADS_ENABLED=true` in Arnaud's Vercel
  Production environment after the owner's credential confirmation, then deployed
  **`dpl_7PC4yiArE1uY1Tn1RbS41i11xXfj`** at
  `https://arnaud-belec-exxdfduu9-thetextas-projects.vercel.app` and promoted it to
  **`https://arnaud-belec.vercel.app`**. Source SHA-256:
  `fb4181e24bed7e1dd9d6cda45437f8394c933392da4c4162cb0b64dadf3a1f39`;
  104 snapshot files, 103 uploaded. Runtime application/library source matches the
  previous release; changes are operational config, regression tests and docs.
  User-owned photograph placeholder edits remain local and excluded.
- Fresh release lint/typecheck/build and **55 release tests** passed (57 checkout
  tests include the two excluded placeholder tests). Vercel's independent build
  passed on Next.js 16.4.3. Read-only live gallery, photo detail/image, journal,
  admin and anonymous-denial checks passed. No deployment protection changed.
- The owner approved a clearly labeled private image/video/audio test draft and
  signed in personally to a visible, ephemeral local Chrome window. No Auth token
  or password was exported. Real file-picker uploads and autosave passed for PNG
  (137 bytes), MP4 (2,863 bytes) and WAV (32,044 bytes). Private staging GETs returned
  200, exposed ETag and matched each original SHA-256; 16-byte range reads returned
  206. Image decoding and muted video/audio playback passed in private preview.
- Anonymous media requests returned 404 for all three assets; the draft's public
  URL returned 404 and its unauthenticated admin API returned 401. The post had no
  publication or first-publication timestamp. Its clearly labeled private draft,
  three staging originals and recovery/revision records are retained. Nothing was
  published or deleted. The ignored receipt is
  `.local/journal-upload-live/receipt.json`; it records the draft/asset IDs, byte
  checksums and acceptance window **19:06:57–19:07:18 UTC** without signed URLs.
- Runtime logs for **18:59–19:09 UTC** contained no error/fatal records. A broader
  one-hour query exceeded Hobby retention and was retried with this supported
  ten-minute window. No claim is made about logs outside that window.
- `npm audit --omit=dev` reports **zero production findings**. Full audit now
  reports **16 moderate development-tooling findings** rooted in minimatch
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  No dependency versions or forced audit fixes were bundled into upload enablement.
  Public media promotion and publish/unpublish acceptance remain untested until
  separately exercised; this acceptance proves private uploads/preview/privacy,
  not the published-bucket write path or worst-case 100 MiB timing.

### Non-photograph / shared-admin rollout — deployed 2026-10-30 local / 2026-10-31 UTC

- Owner approved the old-site black/tan direction, close font alternatives and
  production deployment. Research identified `ftnk` as Futura PT, `vcsm` as Proxima
  Nova, `rnhw` as Leather Light and `xytx` as Adorn Slab Serif via Adobe's published
  EULA pages. The implementation uses self-hosted Jost/Nunito Sans, not copied Adobe
  files, and does not copy reference-page backgrounds into reading/forms.
- One persistent `app/admin/layout.tsx` and `admin-access.tsx` now own login,
  session verification, API requests and sign-out. Photographs (`/admin`) and
  Journal (`/admin/posts`) are subsections, not separate login implementations.
  BlockNote, private preview and both sections use the same scoped design. The
  request helper preserves multipart FormData for photo publication.
- The owner-requested email matched a confirmed existing Supabase Auth account.
  Its verified UUID was added to the previously absent production
  `SUPABASE_ADMIN_USER_IDS` variable. No account was created, password changed,
  Auth metadata updated, or other site's permissions granted. The new deployment
  activated the allowlist. No R2 credentials, flags, CORS or shared routes changed.
- Shared and photo-result exit links warn before discarding queued work. A batch
  AbortController stops subsequent work after leaving, including preparation,
  Supabase/TUS and R2 transfer, publication and later files. It does not reverse
  a server-accepted publication or delete staging/recovery objects.
- Local fixture browsers passed single sign-in, persistent subsection navigation,
  active state, global sign-out, denial, photo fields, multipart publication,
  cancellation of navigation, autosave, publish/private edits, preview, saved
  version restore and unpublish. Delayed three-file fixtures proved no transfer
  starts after departure during preparation, and an aborted second R2 transfer
  cannot publish or start the third file. No real content writes were made.
- Desktop/mobile captures cover public journal, sign-in, posts, queued photos,
  editor, private preview and denial. Font requests remain same-origin, scoped
  styles do not follow navigation into photographs, and the mechanical design
  detector returned no findings. Independent review's two exit/cancellation
  findings were fixed and scored **resolved** in its **ship** verdict pass.
- Deployment **`dpl_DUQmnXUgVukrs1Y2n8Zgo1BVBG6s`** at
  `https://arnaud-belec-9lu4pdfm9-thetextas-projects.vercel.app` passed Vercel's
  independent build and was promoted to **`https://arnaud-belec.vercel.app`**.
  No deployment-protection settings were changed. Source SHA-256:
  `ba20f9ae66d07a818a0d710b1d62ff80b40cbf46117b88cd319407c45e0fbddc`;
  103 snapshot source files, 102 uploaded. The snapshot excludes local credentials
  and verification state, and uses the previous release's photograph/detail source
  byte-for-byte, excluding the preserved user-owned placeholder edits. Root
  layout/CSS and photograph renderer hashes also match the previous release.
- Fresh snapshot `npm ci`, lint, typecheck, production build and **47 tests** passed;
  the checkout's **49 tests** include two intentionally excluded placeholder tests.
  At that checkpoint `npm audit` reported zero findings. Source changes remain uncommitted/unpushed;
  a future Git release must include the approved source/configuration.
- Live read-only checks passed for the gallery, a photo detail, optimized JPEG,
  journal, `/admin`, and `/admin/posts` (200), plus nonexistent post/media (404).
  Anonymous `/api/admin/session` and `/api/admin/posts` now return **401**, not
  the previous unconfigured 503. Anonymous Chrome confirms the new typography,
  one sign-in form/navigation across subsections, noindex, no mobile overflow and
  no runtime exceptions. The scoped checked ten-minute deployment-log window
  contained no error/fatal records. The owner's actual password login and real
  authenticated content/upload writes were not exercised by these read-only checks.

### Applied checkpoint — 2026-10-30

- Confirmed the Supabase management connection targets `https://api.dextery.dev`,
  and `gmkserver.tail077753.ts.net` was reachable over Tailscale. Backend Postgres
  reports version 15.8. No existing blog objects conflicted with this migration.
- Applied `create_arnaud_blog` through Supabase's migration tool with explicit
  owner approval. The live ledger assigned version **20261030231725**. Renamed the
  originally proposed `20261030000000_create_arnaud_blog.sql` file to
  `20261030231725_create_arnaud_blog.sql` to match that ledger; its SQL is unchanged.
  Source SHA-256: `5287d64325e18ba1a9f3e8dec9c82cc3983ca2625c0039401adb9a179a951ea2`.
  The ledger normalizes newlines to spaces; its stored SQL matches the source
  exactly after that normalization.
- Verified all five tables have RLS enabled; anonymous and ordinary authenticated
  roles have no draft/revision table access or execution rights on the three
  writing RPCs. Those RPCs are security-invoker with an empty search path and
  service-role execution. Media grants expose only delivery identifiers/type/state,
  with RLS limiting reads to currently published references.
- All five new tables remained empty. No production test posts, uploads, users or
  publications were created. The existing eight-photo catalogue's complete-row
  fingerprint and the pre-existing public function-definition fingerprint matched
  their preflight values after the migration.
- Next.js, `@next/env` and `eslint-config-next` were updated locally from 16.3.6 to
  **16.4.3**. `npm audit` no longer reports Next.js vulnerabilities or any critical
  findings. No push, application deployment, R2 change, credential change, or upload
  feature-flag enablement was included.
- Post-update verification passed: all **49** blog/admin/storage/palette tests,
  lint, typecheck and production build, plus the mocked Chrome desktop/mobile
  editing/publishing/recovery flow on Next.js 16.4.3. Read-only anonymous requests
  to the real PostgREST endpoint returned empty published/delivery collections
  (200), while private posts, revisions and private media columns returned
  permission-denied responses (401 / SQLSTATE 42501). No production content was
  written to exercise these checks.

### Security release — deployed 2026-10-30

- Updated sharp **0.35.4 → 0.35.5** and refreshed only the affected transitive
  dependencies: source-map-js **1.2.1 → 1.2.2** and zod **4.6.5 → 4.6.7**. Kept
  Next.js, `@next/env` and `eslint-config-next` on **16.4.3**. The full `npm audit`
  report now has zero findings at every severity; no forced audit fix or major
  upgrade was used.
- Deployment uses a sanitized source snapshot of the blog/security work rather
  than uploading the active checkout's unrelated pre-existing photo-placeholder
  edits. Those edits and their helper/tests remain untouched locally. The snapshot
  uses committed photo/detail implementations with only the new Journal footer.
- `.vercelignore` excludes environment files, local verification state, Git data,
  dependencies and generated build output. Production environment values are
  inherited from the existing Vercel project, never copied from `.env.local`.
- Verified CLI scope: project `prj_RbImKGeLEQxJPKKKdJNWjJFoE91Q`, team
  `team_2HILKt3irP09F0Knja9Vv9z1`, Node 24.x. Existing production deployment before
  this release: `dpl_4sadD73pS1FD3AziApVHq8nncRFq`
  (`arnaud-belec-q9l8z31w0-thetextas-projects.vercel.app`). Vercel MCP's separate
  team consent is pending; the already-authorized CLI is used instead.
- Admin membership, production environment values, R2 credentials/CORS, upload
  feature flags, shared Worker routes, and the database are unchanged by this
  deployment. Authenticated real-upload acceptance is still a separate gate.
- Created production candidate **`dpl_8XWBBafjnGfXoKSQmM79H1zAxKTc`** at
  `https://arnaud-belec-g53gabplb-thetextas-projects.vercel.app`, then explicitly
  promoted it to **`https://arnaud-belec.vercel.app`** after Vercel reported READY.
  The unique deployment URL remains protected by Vercel authentication; no
  protection settings or bypass secrets were changed/created to run checks.
- Vercel build logs confirm **Next.js 16.4.3**. The deployed snapshot manifest's
  SHA-256 is `3930a0b60274e314973db4f2957692a7c54d1a3e8ffdef653ce180fac0bf1752`
  (100 snapshot source files, 99 uploaded after ignore rules). Its base Git commit
  is `95b45e56820b7a518f8356d96e889428fcaaee83`, with the approved local blog/security
  changes applied. No Git commit or push was performed. A future Git deployment
  must include these changes; redeploying the old Git branch can restore the old
  vulnerable dependency versions. The previous deployment above is an emergency
  rollback reference, not a security-safe release.
- Fresh `npm ci`, audit, lint, typecheck, the local production build, and all
  **47 release-snapshot tests** passed. The checkout's **49 tests** also passed;
  the two-test difference is the intentionally excluded user-owned placeholder
  helper/test work. Vercel's independent remote production build passed as well.
- Live read-only HTTP checks passed: gallery `/`, `/blog`, `/admin/posts`, a real
  photo detail page, and optimized JPEG delivery all returned 200. Nonexistent
  blog posts/media returned 404. At that release, `/api/admin/posts` returned the
  expected 503 configuration-denied response because `SUPABASE_ADMIN_USER_IDS`
  was absent; the blog-upload flag was also absent/default-off. These were setup gates,
  not permission bypasses or successful authenticated-write acceptance.
- Anonymous live Chrome checks passed for photograph decoding, Journal navigation,
  desktop/mobile journal rendering, the noindex admin sign-in view, and mobile
  overflow. No browser runtime exceptions were observed. Scoped deployment logs
  for the checked 10-minute release window contained zero error/fatal records.

### Setup / rollout gates

1. **Already applied on the shared production instance.** For a new instance, apply `supabase/migrations/20261030231725_create_arnaud_blog.sql` through its separately approved migration process. Do not replay it against the existing instance. It adds only Arnaud-prefixed blog tables/functions; it does not change photograph tables, shared identity, or other sites' permissions. Automated SQL tests use isolated PGlite, not production.
2. **Configured for the owner-requested account in production.** New installations still need `SUPABASE_ADMIN_USER_IDS`, the Supabase public URL/anon key, and server-only service role key. There is no automatic grant to any shared Supabase account. All administrative routes verify the access token with Auth and check the existing allowlist before parsing or accessing storage/data.
3. Provision/confirm **site-scoped** R2 Object Read & Write credentials for only `arnaudbelec` and `arnaudbelec-staging`. Reuse the server-only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` variables. Do not silently reuse broader credentials for rollout.
4. Staging CORS must allow the actual frontend origins, `PUT`, `GET`, and `HEAD`, with upload headers allowed and `ETag` exposed. Private preview GETs must work from the editor. Keep both buckets' r2.dev access disabled, staging unbound, and the shared Worker's existing photo-only allowlist unchanged.
5. **Enabled in production with owner approval.** Server-only `ARNAUD_BLOG_UPLOADS_ENABLED=true` gates upload preparation, signed parts, completion, and publishing posts with uploaded media. It still defaults off for new installations. The existing `ARNAUD_UPLOAD_STORAGE` remains independent and stays Supabase.
6. **Real private-upload acceptance is complete.** Image/video/audio upload, autosave, preview, checksum/range read-back and anonymous denial passed in the owner's signed-in session. Public publishing/unpublishing, withdrawal of new media-gateway access, photo uploads and worst-case size/timing remain separate acceptance checks. No test content was published or deleted.

### Data / publication

- `arnaud_blog_posts` and `arnaud_blog_revisions` are private to server-authorized administration. Anonymous and ordinary authenticated users have no grants to them.
- Every saved document has a version. Saving and publishing check that version under a row lock, preventing a second tab from silently overwriting a newer draft. A conflict stops autosave; download the unsaved draft, then reload. The save response returns that write's exact version rather than a subsequent writer's document version.
- `arnaud_blog_publications` contains only published snapshots. The public reader uses the anonymous client and uncached requests, never the service role. Public posts are rendered as allowlisted React elements, not executable MDX, arbitrary HTML, or a read-only editor bundle.
- Publication atomically updates the snapshot and its media references. SQL checks that the declared asset list matches the saved document and that every asset belongs to this post and has verified publication bytes. First publication fixes the slug, even after unpublishing, to preserve URLs.
- Draft autosave runs after approximately 1.8 seconds of inactivity. Saves create recoverable revisions. The UI offers the latest 50 revisions; older revisions remain in the database. Restoring creates a new draft save, never rewrites history or immediately changes the public post.
- A browser-local recovery copy is scoped by user and post; it is cleared on a successful save. Browser storage can be unavailable or cleared, so it is not a backup guarantee. Download draft exports the structured document, **not its original media files**. Do not discard private staging originals during recovery.
- The admin list shows the most recent 200 posts and says when the limit is reached. Public journal pagination is 20 posts per page. Revision retention/pruning, search, scheduled publication, RSS, newsletters, multilingual content, and collaborative editing are not part of this first version.

### Media / privacy / recovery

- Supported files: JPG/PNG/WebP, MP4/WebM, MP3/Ogg/WAV, up to **100 MiB per file**. SVG, HTML, arbitrary files, and external media URLs are rejected. Links in text can use safe web/email/telephone/relative URLs. Browser codec support still applies; no transcoding, HLS, or video-poster pipeline is introduced. Compress large video and use web-compatible codecs. Supply transcripts/captions in the surrounding post text as appropriate.
- A server-owned reservation binds the post, immutable UUID key, content type, and size. Browser uploads go directly to private R2 staging under `blog/<uuid>.<extension>`, in 8 MiB multipart chunks; originals do not pass through Vercel. Upload parts have 15-minute signatures. Completed multipart objects cannot be replaced by outstanding part URLs.
- Finishing an upload checks size, content type, file signature and a streamed SHA-256. A lost response or failed part can be retried by selecting the exact same file in the same tab; its session-scoped recovery pointer and server reservation avoid retransferring completed parts. Upload reservations accept parts/completion for 24 hours. An expired upload needs a new reservation; no cleanup runs automatically.
- Publishing conditionally copies only referenced, verified media to the published bucket and independently hashes its bytes before SQL publication. Failed/cancelled publication may leave verified copies, but no public media permission is granted until the publication transaction commits. Retries preserve originals and do not overwrite publication keys.
- Draft previews receive five-minute signed staging GET URLs only after administrative authorization and post/asset checks. These are bearer URLs: do not share them. Preview is contained inside the signed-in admin, marked noindex; it is not a publicly shareable draft URL. Refresh a long-open preview to renew media links.
- Public `/blog/media/<uuid>` checks anonymous database RLS for an asset referenced by a **currently published** post, then returns a non-cacheable redirect to a five-minute signed published-object URL. R2 handles the original bytes and range requests. No shared Worker routes/configuration changes are required; the existing Worker denies `blog/` paths.
- Unpublishing or removing a media reference withdraws new gateway access. Previously issued signed URLs can continue working until their five-minute expiry; copies already downloaded by a visitor cannot be revoked. Neither unpublishing nor editing deletes original objects.
- Staging originals and recovery metadata are retained, including abandoned uploads and old revision media. No destructive cleanup, automatic expiry, or volume retirement is included. Monitor storage/revision growth; define retention with the owner separately. Disabling the upload flag stops new uploads/publication with media but leaves existing public delivery and unpublish available.

### Verification

Run `npm run test:blog`, `npm run test:admin`, `npm run test:storage`, `npm run lint`, `npm run typecheck`, and `npm run build`. Mocked/isolated tests do not establish production acceptance. The real private-upload acceptance above is complete at its stated scope; public promotion and large-file acceptance are not implied.

Initial BlockNote Chrome verification used synthetic admin responses and no
production writes: typing, autosave, publication/private edits, preview, revision
restore, unpublish, and desktop/390px layout passed. Its original visual review was
local because the agent runner was quota-blocked. The subsequent owner-approved
restyle received an independent review and a resolved-fixes verdict, as recorded
in the shared-admin checkpoint above. Neither release adds new raster assets.

The pre-change audit reported four affected packages, including critical Next.js
advisories. The first approved update to Next.js 16.4.3 removed the Next.js findings;
the subsequently approved sharp/source-map-js/zod updates remove the remaining
findings at that release. The patched production versions remain deployed. The
2026-10-31 audit is now **zero production findings / 16 moderate dev-tool findings**,
as recorded in the upload checkpoint. Future deployments must retain the patched
runtime versions; development-tooling remediation is separate.
