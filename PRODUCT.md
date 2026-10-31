# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

Arnaud Belec presents his photography and publishes multimedia journal posts for visitors. Arnaud writes in a private online admin rather than editing source files.

## Capabilities and constraints

- Preserve the existing photography experience and photo-upload workflow.
- Use one shared admin login and shell, with Photographs and Journal subsections.
- Use BlockNote for visual writing, with drafts, autosave, preview, explicit publishing, and direct photo/video/audio uploads.
- Supabase owns identity and post metadata; R2 holds media. Draft uploads must stay private until publication.
- Reuse the site's explicit server-side admin allowlist. A hidden URL is not authorization.
- Production migrations, configuration changes, and deployment require separate approval.

## Evidence on hand

The photograph pages retain their current visual identity. For non-photograph
pages, the user chose `https://arnaudnaudbel.myportfolio.com/` as the reference:
black grounds, tan accents, and geometric typography. Close open-source font
alternatives are explicitly approved; exact Adobe fonts require authorized web
delivery. Existing photographs are not invented blog content; the journal starts
empty.
