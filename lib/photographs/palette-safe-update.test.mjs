import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("safe-update follow-up changes only the two deletes to frozen-catalogue predicates", async () => {
  const before = await readFile(new URL("../../supabase/migrations/20261105000000_add_arnaud_mmcq_palettes.sql", import.meta.url), "utf8");
  const after = await readFile(new URL("../../supabase/migrations/20261106000000_scope_arnaud_palette_backfill_deletes.sql", import.meta.url), "utf8");
  const body = sql => sql.slice(sql.indexOf("(p_expected jsonb"), sql.indexOf("\nnotify pgrst"));
  const predicate = "\n    where photograph_id in (select r.id from jsonb_populate_recordset(null::public.arnaud_photographs,v_expected->'photographs') r)";
  const expected = body(before).replace("delete from public.arnaud_photo_palette_colours;", `delete from public.arnaud_photo_palette_colours${predicate};`)
    .replace("delete from public.arnaud_photo_palette_analyses;", `delete from public.arnaud_photo_palette_analyses${predicate};`);
  assert.equal(body(after).trim(), expected.trim());
  assert.equal((after.match(/delete from public\.arnaud_photo_palette_/g) ?? []).length, 2);
  assert.ok(!/where\s+true/i.test(after));
});
