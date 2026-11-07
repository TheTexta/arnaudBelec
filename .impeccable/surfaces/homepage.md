---
version: 1
slug: "homepage"
primary_target: "components/site/HomeEntrance.tsx"
related_targets: ["components/site/HomePreview.tsx", "components/site/site.css", "components/site-effects/HomeFluid.tsx", "lib/site/homepage.ts", "lib/visual/fluid-renderer.ts", "lib/cms/homepage.ts"]
---

# Homepage — Experience

## Direction contract

**THESIS:** Four differently sized image-links form a compact, irregular scene over real cursor-driven fluid, not a hero photograph beside a route index or a uniform card grid.

**OWN-WORLD:** User-pinned Pavel Dobryakov fluid simulation and nepobabies image-link composition. Saturated pink and yellow dominate; pastel blue fills the gaps. Retain the owner's currently installed P22 Cezanne Pro face and sharp original imagery. Labels stay legible on solid palette-backed grounds. Payload owns images and the three palette roles.

**STORY:** Explore Photography, Journal, Video and Fashion through editor-selected images. All four section destinations remain present with or without an image. Only published settings affect the public surface.

**FIRST VIEWPORT:** Name upper-left, largest photograph left-centre, small Journal near centre, tall Fashion upper-right, wide Video lower-right. Images stay still as the pointer stirs pigment behind them. Desktop is approximately one viewport; mobile scrolls through staggered sizes. Existing contact and opt-in sound remain below.

**FORM:** Explicitly approved compact collage; code-led continuation of the existing public expansion. `seed: none (user-pinned)`.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Boundaries

Homepage only; photograph, Journal, video/fashion interiors and native CMS theme stay independent. Additive CMS migration only; no production migration, deployment or publication authorization. No new shipping rasters: images are existing catalogue or verified native Media references. Reduced motion and WebGL failure retain a static composition. No autoplay, touch-scroll interception or cursor replacement.

## Implemented record — 2026-11-05

- Four independent slots preserve Photography `/photos`, Journal `/blog`, Video
  `/video` and Fashion `/fashion` links. Each supports text-only, published
  catalogue thumbnail or verified native image; missing/failed imagery does not
  remove the destination. Originals retain aspect ratios and sharp rendering.
- Desktop is a 24-column/16-row scene, rows `minmax(36px, 3.8svh)`, with the
  hierarchy and placement above. At 700px and below it stacks/staggers widths
  Photography 88%, Journal 57%, Video 78%, Fashion 51%. No equal card shells or
  shadows. Name/labels/intro use solid filler and automatic black/white contrast.
- `DESIGN.md` owns the `home-*` palette and type tokens. Defaults in
  `lib/site/homepage.ts`: fluidA `#ff278f`, fluidB `#ffe52f`, background `#c8e6ff`.
  Desktop heading `clamp(40px, 5.2vw, 72px)`, mobile
  `clamp(40px, 10vw, 64px)`; labels `clamp(22px, 2vw, 30px)`, mobile 26px;
  intro retains 20px/1.7. Current owner-supplied P22 Cezanne Pro is unchanged.
- `HomeFluid` lazily loads the Three GPU solver adapted from MIT Pavel Dobryakov.
  Seeded opening, curl/vorticity/projection and pointer splats move two pigment
  weights over filler, not a CSS imitation. Simulation 112, dye 384, long target
  max 768, pressure 14, ratio <=1.5 and display <=2 million pixels. Fixed canvas
  is home-only, inert/aria-hidden/pointer-transparent, replacing the old home
  atmosphere. Hidden tabs pause, teardown disposes, context loss falls back and
  restoration reinitializes. Reduced motion skips the solver entirely; static
  CSS also covers absent WebGL. No touch interception or custom cursor.
- Native Payload Site settings exposes images and all palette roles, with
  drafts/autosaves/versions and explicit atomic Publish. Native media authorization
  follows published active references only; drafts/version history confer no
  public access. Existing field/grant/identity boundaries remain intact. The
  additive migration is prepared; production has not been changed.

## Finish and evidence scope

Independent finish review: **ship for supplied synthetic captures plus source**;
no visual/source blocking fixes. Authoritative local captures:
`.local/homepage-browser/home-1440.png`, `home-1280.png`, `home-390.png`,
`cursor-1440.png` and `payload-homepage.png` (all under the same directory).
Native Payload autosave, image picking and Publish were exercised in a synthetic
memory fixture, not production. Existing `public/test-image.jpg` is test-only;
the portrait crop existed only in test memory. No shipping raster was added and
no raster-provenance requirement remains outstanding for this implementation.

Implementation owner reports lint, typecheck, `test:site` (35), `test:cms` (42),
`test:blog` (3) and CMS-disabled route checks passed. A fresh final production
build also passed with CMS, expansion and newsletter disabled and provider scope
blank; this is build verification, not a production deployment. After a clean isolated
fixture build resolved transient dev-bundle errors,
`scripts/cms/verify-homepage-browser.mjs` completed its scoped ten-check pass:
`.local/homepage-browser/result.json` records `passed: true`, `errors: []`,
`syntheticOnly: true`, `productionWrites: false`. Coverage includes layout,
focus/navigation at 390/1280/1440px; context loss/restoration; reduced-motion and
no-WebGL fallback; native Payload private autosave, thumbnail selection and Publish
with public palette updates; empty and image-error links. This is synthetic
homepage verification, not full-site regression or real-content acceptance. The
repeated broader existing browser suite still aborts at
`/blog/synthetic-journal-study`; that regression verification remains unresolved,
not passed. Independent finish
disposition above remains scoped to the supplied snapshots and source.

Exact-route scope: the entrance styling and fluid belong only to `/`, not unknown
routes that reuse the legacy `home` fallback preset. `SiteShell` adds
`site-shell--entrance` only to `/`; new homepage CSS targets that class. The final
targeted browser pass verifies absence on `/photos` and an arbitrary 404, retaining
the original fallback ink when that shell is present. The independent reviewer
scored this scope-only correction **resolved**, disposition **ship** for that
correction; recaptured desktop/mobile composition is unchanged.

Separate gates: production migration, configuration and deployment approval;
real owner-selected images and real-content acceptance; existing P22 self-hosted
web-licence confirmation. No deployment or production publication is claimed.
