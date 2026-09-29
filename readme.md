
# Arnaud Belec

## Development

Run `npm install` and `npm run dev`, then open the local URL shown in the terminal. The photo page is currently the home page. Until photographs are imported, its gallery uses `public/test-image.jpg` as a temporary image; the selectable colour gradients filter the matching analysed placeholder tiles.

The page uses Tailwind CSS v4 utilities and Motion to drift the central photo's seven extracted palette colours around the photo. Each gradient starts outside the photo on page load, with random candidates chosen across the free area and spaced from gradients already placed; its size still depends only on its palette weight. The entire archive page, including the gallery, uses a subdued background extracted from the central photo's dominant edge colour. Each detail page uses its own photo's background colour throughout. Text and focus indicators adjust for light or dark backgrounds. The central photo and detail-page photo keep their original aspect ratios within a 66.667vw-wide frame (viewport width minus 32px on small screens) and an 80vh height limit. Their measured size drives the moving gradients' collision bounds as the viewport or photo changes. Each gradient's diameter is set by its palette weight: an even one-seventh share is 100vw, with smaller shares shrinking toward 75vw and larger shares growing toward 125vw. The archive and detail pages render their palette gradients and animated monochrome grain in one Three.js/WebGL canvas below the opaque photographs and HTML controls, keeping photographs sharp. The colour wash can spill into the gallery below the hero section, while the gradient centers remain constrained to the hero section and avoid the photo. Selecting a colour ranks the gallery below by similarity to that swatch: it shows every photo within the colour-distance threshold, or fills with the closest eligible photos to reach five when available. It does not change the central displayed photo. Clicking the central photo or a gallery thumbnail opens its `/photos/<filename>` page. Each detail page shows that photograph with its own seven moving palette gradients and photographs ranked by colour similarity; selecting a gradient uses the same five-result minimum, and clicking the full photograph restores all seven colours. The photographer name links back to the archive at `/`. `app/globals.css` holds the fallback glow utility.

## Palette gradients and grain

`app/bloom-layer.tsx` loads `app/bloom-renderer.ts` on the client after mount. The renderer uses a single full-screen plane and shader, with the existing Motion orb positions, palette weights, and selected-colour expansion. Selecting a gradient moves it to the top of a persistent colour stack in both WebGL and the CSS fallback, preserving the relative order of the other gradients. Deselecting only reverses its expansion; its stack position remains unchanged. Selecting an earlier gradient brings it back to the top without duplicating it. The stack lasts for the mounted page and resets when the layer remounts. The fixed canvas tracks the hero’s position during scrolling so its colour wash continues into the gallery. It composites palette colours in sRGB, adds monochrome noise in linear light, screens the pixel-art orb light directly onto the finished gradient image, and applies output dithering to reduce banding. Photographs and orb controls remain HTML above the canvas.

Tune `GRAIN_STRENGTH` (default `0.035`), `GRAIN_SIZE` (default `1` CSS pixel), and `GRAIN_SPEED` (default `1`) in `app/bloom-renderer.ts`. The effect is inspired by the screen shader on [bur1alrites’ threejs branch](https://github.com/TheTexta/bur1alrites/tree/threejs); grain fades near black to preserve dark backgrounds. The shader supplies smooth gradient falloffs directly; it does not use a bloom postprocessing pass. Each selectable colour orb uses four CSS pixels per grain cell, a pixelated glow, and a soft outer light. Its pixels run from white at the centre through the palette colour at the original midpoint, then fade exponentially to transparent over 2.5 times the previous outer distance; the large gradient it follows is unchanged. The fade reaches zero at the existing outer edge. Its palette-weight scaling remains the same, from 75% to 125% of the baseline; selection grows that shape another 1.5 times without enlarging the grain cells. Each orb also pulses by roughly 5–7% on its own phase and speed, around 0.9 Hz at the baseline size, with smaller orbs pulsing faster; reduced motion disables the pulse. One screen-space, four-CSS-pixel cell grid is shared by all the orbs for both their shape and noise, with the noise refreshed every 60 ms. WebGL applies the shared noise to each orb colour before screening it onto the composed gradients; the HTML fallback aligns its orb canvases to the same grid and also applies noise before CSS screen blending. The background grain remains separate. Reduced motion freezes the orb noise.

Rendering is capped at a pixel ratio of `1.5` and 2.5 million drawing-buffer pixels. Hidden tabs skip rendering. Reduced motion freezes the grain and orb motion, makes selection changes immediate, and redraws only when the scene or viewport changes. Existing CSS gradients remain visible while the shader loads, when WebGL is unavailable, or during context loss; rendering resumes after context restoration. Renderer resources are disposed when the layer unmounts. No backend or environment changes are required.

## Photograph storage

The Coolify-managed Supabase instance at `https://api.dextery.dev` has a separate public Storage bucket named `arnaudbelec`. It accepts JPEG, PNG, and WebP images up to 500 MiB. The tables `public.arnaud_photographs`, `public.arnaud_photo_palette_analyses`, and `public.arnaud_photo_palette_colours` store Arnaud's image metadata and seven-colour analysis separately from Elliot's catalogue. The initial schema is in `supabase/migrations/20260923062000_create_arnaud_photographs.sql`; `supabase/migrations/20260923150000_expand_arnaud_palette_to_seven.sql` expands the rank constraint, requires seven colours for new imports, and adds an atomic palette replacement RPC. `supabase/migrations/20260923211500_use_oklab_kmedoids.sql` requires the OKLab k-medoids extractor. `supabase/migrations/20260923220600_add_edge_background_colour.sql` adds `arnaud_photographs.background_hex` and requires the background colour in both write RPCs. `supabase/migrations/20260928220000_exclude_background_from_arnaud_palette.sql` accepts the background-aware palette algorithm in both write RPCs. Apply these migrations in order on new instances.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the ignored `.env.local` file to show imported images on the site. Get the keys from Supabase Studio at `https://studio.dextery.dev`. The local setup and import scripts also load `.env.local`; they need `SUPABASE_SERVICE_ROLE_KEY` and use `SUPABASE_URL` or fall back to `NEXT_PUBLIC_SUPABASE_URL`. Keep the service-role key in `.env.local` or your local shell; never expose it through a `NEXT_PUBLIC_` variable or commit it.

The site reads the published photograph catalogue first, including each photograph's stored seven-colour palette in analysis rank order for the gradients and colour filtering. If the catalogue is empty, it can still show public objects found in the `arnaudbelec/uploads` bucket, but those bucket-only objects do not have colour analysis until they are imported with the publish workflow below. Files uploaded at the bucket root are not shown directly; the current photographs were copied to canonical `uploads/<uuid>.jpg` paths, analysed, and published while their original root objects were retained.

The bucket is already provisioned on the current server, and `npm run storage:setup` verifies its settings or creates it on a new instance. Analyze an image locally before upload with `npm run photos:import -- --dry-run path/to/photo.jpg`, then publish with `npm run photos:import -- path/to/photo.jpg`. Multiple file paths are supported.

### Photo admin

The upload panel is at `/admin`. Create a Supabase Auth user in Studio, then put that user's UUID in the server-only `SUPABASE_ADMIN_USER_IDS` environment variable. Separate multiple UUIDs with commas. The panel has no public sign-up flow, and every admin API request verifies its Supabase access token with Auth and checks this allowlist. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the deployed environment as well as `.env.local` for local development. `.env.example` lists the required variables. The service-role key must never use a `NEXT_PUBLIC_` prefix.

Sign in with that Auth user's email and password, choose JPG, PNG, or WebP photographs, add optional title, alt text, capture date, and sort order, then select **Upload and publish**. Uploads go directly from the browser to the existing `arnaudbelec` bucket in resumable 6 MiB chunks using a short-lived signed upload token. The original files do not pass through Vercel. The browser sends a 96-pixel sample to the server for the existing seven-colour palette and background-colour analysis; the server checks the finished object and publishes its metadata through `arnaud_publish_photograph`. The admin path uses a supplied capture date or a `YYYYMMDD-` filename prefix; it does not read EXIF dates. Filenames must be unique in the published catalogue. If the connection fails after transfer, **Retry remaining uploads** reuses the completed upload while its ticket is valid. The server removes the uploaded object when it rejects publication; closing the browser before publishing can leave an unpublished object for an administrator to remove. Successful photographs appear on the live photo pages without a rebuild. The public catalogue, bucket, and CLI importer remain compatible; no database migration is needed for this panel. Run `npm run test:admin` for upload-ticket and input-validation checks.

After applying the latest migration on another instance, run `npm run photos:reanalyze -- --dry-run` to check every published image, then `npm run photos:reanalyze` to replace its stored palette and background colour. The script downloads existing bucket objects, computes all analyses before writing, and replaces each photograph's background colour, analysis metadata, and seven colour rows atomically. It preserves photograph IDs, filenames, and storage objects. Existing palettes continue to appear on the site until this reanalysis runs. It uses the service-role credentials in the ignored `.env.local` file.

To set a different title, alt text, capture date, or sort order per image, pass `--manifest path/to/photos.json`. Its keys can be file paths or basenames:

```json
{
  "photo.jpg": {
    "title": "A photograph title",
    "altText": "Description of the photograph",
    "capturedAt": "2026-09-23",
    "sortOrder": 1
  }
}
```

The importer reads orientation and capture date from EXIF, samples an orientation-corrected image at up to 96 × 96 pixels, and runs seven-colour OKLab k-medoids analysis for up to 10 iterations. Pixel chroma raises saturated colours' importance during clustering, and each swatch is a colour observed in the image. The background colour uses the largest cluster from the outer 8% of the same sample, with reduced chroma and unchanged OKLab lightness. Palette extraction excludes pixels within an OKLab distance of 0.08 from that background colour, then calculates each swatch's weight as its share of the remaining pixels; this controls gradient size. If no pixels remain, a uniform image keeps its original pixels. Transparent pixels are ignored; if the entire edge is transparent, the extractor uses the opaque interior. For each palette colour it stores rank, RGB, hex, CIE Lab for gallery matching, and weight. It uploads the object first, publishes all database rows in one transaction, and removes the object if publishing fails. Run `npm run test:palette` to check the extractors. Eight unique photographs are currently published with OKLab palettes; an identical duplicate root upload was removed.

## Project notes

### Overview — portfolio + social media page

blog section. with pictures video and text.
email updates when new blogs are published.
buy the domain arnaudbelec.com.
email hosting possibly?

180 degree video to point cloud estimation for 3d viewing of clothing

super saturated pages and pages that are entirely black/white (not fully)

paralax in the ui a lot

arnaudnaudbel@protonmail.com

music playing sitewide

bloom + halation

P22 Cezanne Pro font (for now)

floating gradients colour thing like elliots.
- chords for each colour. 7 chord 7 colour brackets. 

whole page colourful for the photo page but it goes to black and white when you select it to be so. upon black and white mode its shows black and white photos. 
- ui for this is complicated. 
- use a leaking of the black and white page on the colour page to indicate its a interactable element that will switch the colour mode



pages:
- homepage -> wave distortion (like wallpaper engine water) on the ui
- blog page -> needs to be able to upload videos and photos and music to it
- photo page
- video page -> possible buying platform for DVDs
- fashing page


admin facing ui


## Hours Logged
Sept 22:
init consult

sept 23:
3 hours. Rough mockup of photo page and inital site repo creation + storage solution investigation.

0.75 hour. Finding a new colour extraction model that extracts saturated colours rather then weighted averages. updated some of the similar photo logic.
