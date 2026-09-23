
# Arnaud Belec

## Development

Run `npm install` and `npm run dev`, then open the local URL shown in the terminal. The photo page is currently the home page. Until photographs are imported, its gallery uses `public/test-image.jpg` as a temporary image; the selectable colour gradients filter the matching analysed placeholder tiles.

The page uses Tailwind CSS v4 utilities and Motion to drift the central photo's extracted palette colours around the photo. Each gradient's diameter is set by its palette weight: an even 20% share is 100vw, with smaller shares shrinking toward 75vw and larger shares growing toward 125vw. Selecting a colour filters only the gallery below; it does not change the central displayed photo. `app/globals.css` holds the custom glow utility.

## Photograph storage

The Coolify-managed Supabase instance at `https://api.dextery.dev` has a separate public Storage bucket named `arnaudbelec`. It accepts JPEG, PNG, and WebP images up to 500 MiB. The tables `public.arnaud_photographs`, `public.arnaud_photo_palette_analyses`, and `public.arnaud_photo_palette_colours` store the same image metadata and five-colour analysis fields as Elliot's site without mixing the two catalogues. Their migration is in `supabase/migrations/20260923062000_create_arnaud_photographs.sql` and has been applied to the current instance.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the ignored `.env.local` file to show imported images on the site. Get the keys from Supabase Studio at `https://studio.dextery.dev`. The local setup and import scripts also load `.env.local`; they need `SUPABASE_SERVICE_ROLE_KEY` and use `SUPABASE_URL` or fall back to `NEXT_PUBLIC_SUPABASE_URL`. Keep the service-role key in `.env.local` or your local shell; never expose it through a `NEXT_PUBLIC_` variable or commit it.

The site reads the published photograph catalogue first, including each photograph's stored five-colour palette in analysis rank order for the gradients and colour filtering. If the catalogue is empty, it can still show public objects found in the `arnaudbelec/uploads` bucket, but those bucket-only objects do not have colour analysis until they are imported with the publish workflow below. Files uploaded at the bucket root are not shown directly; the current photographs were copied to canonical `uploads/<uuid>.jpg` paths, analysed, and published while their original root objects were retained.

The bucket is already provisioned on the current server, and `npm run storage:setup` verifies its settings or creates it on a new instance. Analyze an image locally before upload with `npm run photos:import -- --dry-run path/to/photo.jpg`, then publish with `npm run photos:import -- path/to/photo.jpg`. Multiple file paths are supported.

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

The importer reads orientation and capture date from EXIF, samples an orientation-corrected image at up to 96 × 96 pixels, and runs Elliot's five-colour, 10-iteration RGB k-means analysis. For each colour it stores rank, RGB, hex, CIE Lab, and weight. It uploads the object first, publishes all database rows in one transaction, and removes the object if publishing fails. Eight unique photographs are currently published; an identical duplicate root upload was removed.

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

floating gradients colour thing like elliots. ![[Screenshot]]
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
