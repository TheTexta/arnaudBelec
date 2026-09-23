export type PaletteColour = {
  labL: number;
  labA: number;
  labB: number;
  weight: number;
};

export type PublicPhotograph = {
  id: string;
  src: string;
  filename: string;
  width: number;
  height: number;
  title: string | null;
  altText: string | null;
  palette: PaletteColour[];
};

type CatalogueRow = {
  id: unknown;
  storage_path: unknown;
  filename: unknown;
  image_width: unknown;
  image_height: unknown;
  title: unknown;
  alt_text: unknown;
  palette: unknown;
};

const BUCKET = "arnaudbelec";
const PAGE_SIZE = 500;
const STORAGE_PATH = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

function isPaletteColour(value: unknown): value is {
  lab_l: number;
  lab_a: number;
  lab_b: number;
  weight: number;
} {
  if (typeof value !== "object" || value === null) return false;
  const colour = value as Record<string, unknown>;
  return ["lab_l", "lab_a", "lab_b", "weight"].every(
    (key) => typeof colour[key] === "number" && Number.isFinite(colour[key]),
  );
}

function photographFromRow(row: CatalogueRow, storageRoot: string): PublicPhotograph | null {
  if (
    typeof row.id !== "string" ||
    typeof row.storage_path !== "string" ||
    !STORAGE_PATH.test(row.storage_path) ||
    typeof row.filename !== "string" ||
    typeof row.image_width !== "number" || row.image_width <= 0 ||
    typeof row.image_height !== "number" || row.image_height <= 0
  ) return null;

  const objectPath = row.storage_path.split("/").map(encodeURIComponent).join("/");
  const palette = Array.isArray(row.palette)
    ? row.palette.filter(isPaletteColour).map((colour) => ({
        labL: colour.lab_l,
        labA: colour.lab_a,
        labB: colour.lab_b,
        weight: colour.weight,
      }))
    : [];

  return {
    id: row.id,
    src: `${storageRoot}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    filename: row.filename,
    width: row.image_width,
    height: row.image_height,
    title: typeof row.title === "string" ? row.title : null,
    altText: typeof row.alt_text === "string" ? row.alt_text : null,
    palette,
  };
}

/** Reads the public catalogue with the publishable/anon key; no privileged key is needed. */
export async function loadPublicPhotographs(): Promise<PublicPhotograph[]> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) return [];

  let storageRoot: string;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return [];
    storageRoot = url.href.replace(/\/$/, "");
  } catch {
    return [];
  }

  const photographs: PublicPhotograph[] = [];

  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = new URLSearchParams({
        select: "id,storage_path,filename,image_width,image_height,title,alt_text,palette:arnaud_photo_palette_colours(lab_l,lab_a,lab_b,weight)",
        order: "sort_order.asc.nullslast,captured_at.desc.nullslast,filename.desc",
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const response = await fetch(`${storageRoot}/rest/v1/arnaud_photographs?${query}`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`PostgREST returned ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Unexpected catalogue response");

      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const photograph = photographFromRow(row as CatalogueRow, storageRoot);
        if (photograph) photographs.push(photograph);
      }

      if (rows.length < PAGE_SIZE) break;
    }
  } catch (error) {
    console.error("Unable to load the public Arnaud photograph catalogue:", error);
    return [];
  }

  return photographs;
}
