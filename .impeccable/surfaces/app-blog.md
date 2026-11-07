---
version: 1
slug: "app-blog"
primary_target: "app/blog"
related_targets: ["app/admin", "components/cms", "app/(payload)"]
---

# Journal and administration

Scope: `/blog`, journal reading and preview, `/admin/posts`, and `/admin`. Read mode for the journal; Operate for administration. Existing documents, controls, publication, recovery and upload semantics remain intact. Photograph pages are excluded.

## Direction contract

**Native CMS exception (2026-11-04):** `/cms` now follows the separately approved
Dexter/Elliot monochrome admin direction: black/white/neutral greys, square controls,
compact native Payload layout, Automatic system theme plus remembered Light/Dark
overrides. The warm contract below continues to govern `/blog` and the private
article-preview canvas, not native administration. Public photograph pages and the
CMS-disabled photography admin remain unchanged. See the native-admin exception
in `DESIGN.md` and `components/cms/cms.css` for this narrower source authority.

**THESIS:** Bring Arnaud's old Adobe Portfolio identity into a readable journal and usable administration, not an unrelated cream CMS.

**OWN-WORLD:** Black ground, warm tan headings drawn from `#c69b69`, pale warm reading text, spare red state accents, geometric Jost titles and Nunito Sans controls. User approved close open-source alternatives to the old site's licensed Futura PT and Proxima Nova; no Adobe font files are copied.

**STORY:** Visitors find published writing; the author signs in once and switches between Photographs and Journal within one persistent admin. Writing remains private until deliberately published; state and recovery stay more prominent than decoration.

**FIRST VIEWPORT:** A left-aligned name and right-aligned navigation frame a spacious journal title and list. Administration keeps familiar top navigation, a compact sign-in form or post list, and clearly separated writing/actions. The signature is the old site's tan geometric title against black, repeated consistently across both admin areas.

**FORM:** User-pinned old-site direction; code-led Read/Operate implementation. No concept roll: identity and composition are explicitly constrained by the reference and retained workflows.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
