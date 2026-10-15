import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPublicPhotographs } from "../supabase-public";

test("mixed and pre-migration catalogues preserve page identities and resolve the correct originals", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test";
  const id = "12345678-1234-1234-1234-123456789abc";
  const base = { id, storage_path: `uploads/${id}.jpg`, filename: "original.jpg", image_width: 100, image_height: 80, title: "Title", alt_text: "Alt", background_hex: "#112233", palette: [] };
  try {
    for (const provider of [undefined, "supabase", "r2"]) {
      globalThis.fetch = async input => {
        assert.match(String(input), /rest\/v1\/arnaud_photographs/);
        return Response.json([{ ...base, ...(provider ? { storage_provider: provider } : {}) }]);
      };
      const [photo] = await loadPublicPhotographs();
      assert.equal(photo.id, id);
      assert.equal(photo.filename, base.filename);
      assert.equal(photo.backgroundHex, base.background_hex);
      assert.equal(photo.src, provider === "r2" ? `https://media.dextery.dev/arnaudbelec/${base.storage_path}` : `https://supabase.example.test/storage/v1/object/public/arnaudbelec/${base.storage_path}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  }
});
