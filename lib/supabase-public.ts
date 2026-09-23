export type PaletteColour = {
  hex: string;
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
  backgroundHex: string | null;
  palette: PaletteColour[];
  hasPaletteAnalysis: boolean;
};

type CatalogueRow = {
  id: unknown;
  storage_path: unknown;
  filename: unknown;
  image_width: unknown;
  image_height: unknown;
  title: unknown;
  alt_text: unknown;
  background_hex: unknown;
  palette: unknown;
};

type StorageObjectRow = {
  name: unknown;
  id: unknown;
  updated_at: unknown;
  created_at: unknown;
  last_accessed_at: unknown;
  metadata: unknown;
};

const BUCKET = "arnaudbelec";
const PAGE_SIZE = 500;
const STORAGE_PATH = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

function isPaletteColour(value: unknown): value is {
  rank: number;
  hex: string;
  lab_l: number;
  lab_a: number;
  lab_b: number;
  weight: number;
} {
  if (typeof value !== "object" || value === null) return false;
  const colour = value as Record<string, unknown>;
  return Number.isInteger(colour.rank)
    && typeof colour.hex === "string"
    && /^#[0-9a-fA-F]{6}$/.test(colour.hex)
    && ["lab_l", "lab_a", "lab_b", "weight"].every(
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
    ? row.palette.filter(isPaletteColour).sort((left, right) => left.rank - right.rank).map((colour) => ({
        hex: colour.hex.toLowerCase(),
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
    backgroundHex: typeof row.background_hex === "string" && /^#[0-9a-fA-F]{6}$/.test(row.background_hex)
      ? row.background_hex.toLowerCase()
      : null,
    palette,
    hasPaletteAnalysis: palette.length > 0,
  };
}

function photographFromStorageObject(row: StorageObjectRow, storageRoot: string): PublicPhotograph | null {
  if (typeof row.name !== "string" || !/\.(?:jpe?g|png|webp)$/i.test(row.name)) return null;

  const storagePath = `uploads/${row.name}`;
  if (!STORAGE_PATH.test(storagePath)) return null;
  const objectPath = storagePath.split("/").map(encodeURIComponent).join("/");

  return {
    id: typeof row.id === "string" ? row.id : storagePath,
    src: `${storageRoot}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    filename: row.name,
    width: 1600,
    height: 1067,
    title: null,
    altText: null,
    backgroundHex: null,
    palette: [],
    hasPaletteAnalysis: false,
  };
}

async function loadPublishedPhotographs(storageRoot: string, anonKey: string): Promise<PublicPhotograph[]> {
  const photographs: PublicPhotograph[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams({
      select: "id,storage_path,filename,image_width,image_height,title,alt_text,background_hex,palette:arnaud_photo_palette_colours(rank,hex,lab_l,lab_a,lab_b,weight)",
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

  return photographs;
}

async function loadBucketPhotographs(storageRoot: string, anonKey: string): Promise<PublicPhotograph[]> {
  const response = await fetch(`${storageRoot}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prefix: "uploads",
      limit: PAGE_SIZE,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Storage API returned ${response.status}`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Unexpected storage response");

  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const photograph = photographFromStorageObject(row as StorageObjectRow, storageRoot);
    return photograph ? [photograph] : [];
  });
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

  try {
    const photographs = await loadPublishedPhotographs(storageRoot, anonKey);
    return photographs.length > 0 ? photographs : await loadBucketPhotographs(storageRoot, anonKey);
  } catch (error) {
    console.error("Unable to load the public Arnaud photograph catalogue:", error);
    return [];
  }
}
