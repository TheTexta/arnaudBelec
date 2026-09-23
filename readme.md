
# Arnaud Belec

## Development

Run `npm install` and `npm run dev`, then open the local URL shown in the terminal. The photo page is currently the home page. Until photographs are imported, its gallery uses `public/test-image.jpg` as a temporary image; the selectable colour gradients filter the matching analysed placeholder tiles.

The page uses Tailwind CSS v4 utilities and Motion to drift the central photo's seven extracted palette colours around the photo. Each gradient starts at a random position outside the photo on page load; its size still depends only on its palette weight. The entire archive page, including the gallery, uses a subdued background extracted from the central photo's dominant edge colour. Each detail page uses its own photo's background colour throughout. Text and focus indicators adjust for light or dark backgrounds. The central photo and detail-page photo keep their original aspect ratios within a 66.667vw-wide frame (viewport width minus 32px on small screens) and an 80vh height limit. Their measured size drives the moving gradients' collision bounds as the viewport or photo changes. Each gradient's diameter is set by its palette weight: an even one-seventh share is 100vw, with smaller shares shrinking toward 75vw and larger shares growing toward 125vw. Selecting a colour ranks the gallery below by similarity to that swatch: it shows every photo within the colour-distance threshold, or fills with the closest eligible photos to reach five when available. It does not change the central displayed photo. Clicking the central photo or a gallery thumbnail opens its `/photos/<filename>` page. Each detail page shows that photograph with its own seven moving palette gradients and photographs ranked by colour similarity; selecting a gradient uses the same five-result minimum, and clicking the full photograph restores all seven colours. The photographer name links back to the archive at `/`. `app/globals.css` holds the custom glow utility.

## Photograph storage

The Coolify-managed Supabase instance at `https://api.dextery.dev` has a separate public Storage bucket named `arnaudbelec`. It accepts JPEG, PNG, and WebP images up to 500 MiB. The tables `public.arnaud_photographs`, `public.arnaud_photo_palette_analyses`, and `public.arnaud_photo_palette_colours` store Arnaud's image metadata and seven-colour analysis separately from Elliot's catalogue. The initial schema is in `supabase/migrations/20260923062000_create_arnaud_photographs.sql`; `supabase/migrations/20260923150000_expand_arnaud_palette_to_seven.sql` expands the rank constraint, requires seven colours for new imports, and adds an atomic palette replacement RPC. `supabase/migrations/20260923211500_use_oklab_kmedoids.sql` requires the OKLab k-medoids extractor. `supabase/migrations/20260923220600_add_edge_background_colour.sql` adds `arnaud_photographs.background_hex` and requires the background colour in both write RPCs. Apply these migrations in order on new instances.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the ignored `.env.local` file to show imported images on the site. Get the keys from Supabase Studio at `https://studio.dextery.dev`. The local setup and import scripts also load `.env.local`; they need `SUPABASE_SERVICE_ROLE_KEY` and use `SUPABASE_URL` or fall back to `NEXT_PUBLIC_SUPABASE_URL`. Keep the service-role key in `.env.local` or your local shell; never expose it through a `NEXT_PUBLIC_` variable or commit it.

The site reads the published photograph catalogue first, including each photograph's stored seven-colour palette in analysis rank order for the gradients and colour filtering. If the catalogue is empty, it can still show public objects found in the `arnaudbelec/uploads` bucket, but those bucket-only objects do not have colour analysis until they are imported with the publish workflow below. Files uploaded at the bucket root are not shown directly; the current photographs were copied to canonical `uploads/<uuid>.jpg` paths, analysed, and published while their original root objects were retained.

The bucket is already provisioned on the current server, and `npm run storage:setup` verifies its settings or creates it on a new instance. Analyze an image locally before upload with `npm run photos:import -- --dry-run path/to/photo.jpg`, then publish with `npm run photos:import -- path/to/photo.jpg`. Multiple file paths are supported.

After applying the latest migration on another instance, run `npm run photos:reanalyze -- --dry-run` to check every published image, then `npm run photos:reanalyze` to replace its stored palette and background colour. The script downloads existing bucket objects, computes all analyses before writing, and replaces each photograph's background colour, analysis metadata, and seven colour rows atomically. It preserves photograph IDs, filenames, and storage objects. It uses the service-role credentials in the ignored `.env.local` file.

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

The importer reads orientation and capture date from EXIF, samples an orientation-corrected image at up to 96 × 96 pixels, and runs seven-colour OKLab k-medoids analysis for up to 10 iterations. Pixel chroma raises saturated colours' importance during clustering, and each swatch is a colour observed in the image. The stored weight remains that colour cluster's share of sampled pixels, which controls the gradient size. The background colour uses the largest cluster from the outer 8% of the same sample, with reduced chroma and unchanged OKLab lightness. Transparent pixels are ignored; if the entire edge is transparent, the extractor uses the opaque interior. For each palette colour it stores rank, RGB, hex, CIE Lab for gallery matching, and weight. It uploads the object first, publishes all database rows in one transaction, and removes the object if publishing fails. Run `npm run test:palette` to check the extractors. Eight unique photographs are currently published with OKLab palettes; an identical duplicate root upload was removed.

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
