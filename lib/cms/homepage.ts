import { APIError, type Field, type PayloadRequest } from "payload";
import { HOME_SECTIONS, DEFAULT_HOME_PALETTE, validHexColour } from "../site/homepage";
import { loadPublicPhotographs } from "../supabase-public";
import { mediaId, type MediaUse } from "./site-access";

export const validHomeColour = (value: unknown) => validHexColour(value) || "Use a six-digit hex colour, such as #ff278f.";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const fail = (path: string, message: string): never => { throw new HomepageValidationError(path, message); };
export class HomepageValidationError extends APIError {
  constructor(public path: string, message: string) { super(message, 400); }
}

export function mergeHomepage(original: unknown, incoming: unknown) {
  const before = object(original), after = object(incoming);
  return Object.fromEntries(["palette", ...HOME_SECTIONS.map(item => item.key)].map(key => [key, { ...object(before[key]), ...object(after[key]) }]));
}

export async function homepageMediaUses(value: unknown, publishing: boolean): Promise<MediaUse[]> {
  const home = object(value);
  const uses: MediaUse[] = [];
  const selectedPhotos: { path: string; id: string }[] = [];
  if (publishing) {
    const palette = object(home.palette);
    for (const key of Object.keys(DEFAULT_HOME_PALETTE)) {
      if (palette[key] !== undefined && !validHexColour(palette[key])) fail(`homepage.palette.${key}`, "Use a six-digit hex colour, such as #ff278f.");
    }
  }
  for (const { key } of HOME_SECTIONS) {
    const choice = object(home[key]);
    const path = `homepage.${key}`;
    if (!choice.source || choice.source === "none") continue;
    if (choice.source === "media") {
      const id = mediaId(choice.image);
      if (!id && (publishing || choice.image)) fail(`${path}.image`, "Choose an image from the Media library, or set Image source to Text link only.");
      if (id) uses.push({ id, kind: "image" });
    } else if (choice.source === "photograph") {
      if (publishing) {
        if (typeof choice.photographId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(choice.photographId)) fail(`${path}.photographId`, "Choose a published photograph, or set Image source to Text link only.");
        selectedPhotos.push({ path, id: choice.photographId as string });
      }
    } else fail(`${path}.source`, "Choose a supported image source.");
  }
  if (selectedPhotos.length) {
    const photographs = new Map((await loadPublicPhotographs()).map(photo => [photo.id, photo]));
    for (const { path, id } of selectedPhotos) {
      const photo = photographs.get(id);
      if (!photo) fail(`${path}.photographId`, "That photograph is unavailable. Choose a current published photograph and publish again.");
      if (!photo?.altText?.trim()) fail(`${path}.photographId`, "Add alt text to this photograph before using it on the homepage.");
    }
  }
  return uses;
}

export const homepageField: Field = {
  name: "homepage", type: "group", label: "Homepage",
  admin: { description: "Choose the four section images and the fluid palette. Changes stay private until you publish Site settings." },
  fields: [
    { name: "palette", type: "group", label: "Colour palette", fields: Object.entries(DEFAULT_HOME_PALETTE).map(([name, defaultValue]) => ({
      name, type: "text" as const, label: name === "fluidA" ? "Fluid colour A" : name === "fluidB" ? "Fluid colour B" : "Background / filler",
      defaultValue, validate: validHomeColour, admin: { components: { Field: "/components/cms/HomepageFields#ColourField" } },
    })) },
    ...HOME_SECTIONS.map(({ key, label }): Field => ({ name: key, type: "group", label, fields: [
      { name: "source", label: `${label} image source`, type: "select", defaultValue: "none", admin: { components: { Field: "/components/cms/HomepageFields#ImageSourceField" } }, options: [
        { label: "Text link only", value: "none" }, { label: "Published photograph", value: "photograph" }, { label: "Media library", value: "media" },
      ] },
      { name: "photographId", label: "Photograph", type: "text", admin: { condition: (_data, sibling) => sibling.source === "photograph", components: { Field: "/components/cms/HomepageFields#PhotographField" } } },
      { name: "image", label: "Section image", type: "upload", relationTo: "media", filterOptions: { and: [{ mimeType: { contains: "image/" } }, { verified: { equals: true } }] }, admin: { condition: (_data, sibling) => sibling.source === "media" } },
    ] })),
  ],
};

export async function homepagePhotographs(req: PayloadRequest) {
  const { siteAdmin } = await import("./site-access");
  if (!siteAdmin({ req })) throw new APIError("Sign in to Arnaud’s admin.", 403);
  const photos = await loadPublicPhotographs();
  return Response.json({ photographs: photos.map(({ id, src, title, altText, filename }) => ({ id, src, label: title || filename, alt: altText || "" })) }, { headers: { "Cache-Control": "private, no-store" } });
}
