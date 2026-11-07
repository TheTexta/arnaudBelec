import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractCircleOfFashion, parseCircleOfFashion, sourceIds, sourcePage, sourceText } from "./extract-circle-of-fashion.mjs";

const image = id => `<img data-src="https://cdn.myportfolio.com/f5a01f46-fd9e-4866-9cc9-b9f5d38cd68e/${id}_rw_1920.jpg?h=test">`;
const html = `${sourceText}${sourceIds.map(image).join("")}PHASSION${image("separate-series")}`;

test("extracts exactly the ten Circle of Fashion images in source order, not PHASSION", () => {
  const urls = parseCircleOfFashion(html);
  assert.equal(urls.length, 10);
  assert.deepEqual(urls.map(url => new URL(url).pathname.split("/").at(-1)), sourceIds.map(id => `${id}_rw_1920.jpg`));
});

test("refuses changed copy, missing boundaries, reordered/missing/extra images", () => {
  for (const changed of [
    html.replace("Sophie Miretsky", "Changed credit"), html.replace("PHASSION", ""),
    html.replace(image(sourceIds[0]), ""), html.replace("PHASSION", `${image(sourceIds[0])}PHASSION`),
    html.replace(sourceIds[0], "reordered").replace(sourceIds[1], sourceIds[0]).replace("reordered", sourceIds[1]),
  ]) assert.throws(() => parseCircleOfFashion(changed));
});

test("refuses unexpected image hosts, protocols or credentials", () => {
  for (const origin of ["https://example.test", "http://cdn.myportfolio.com", "https://user:password@cdn.myportfolio.com"]) {
    assert.throws(() => parseCircleOfFashion(html.replace("https://cdn.myportfolio.com", origin)));
  }
});

test("an existing destination is preserved, with no image requests or overwrites", async () => {
  await mkdir(new URL("../../.local/", import.meta.url), { recursive: true });
  const directory = await mkdtemp(fileURLToPath(new URL("../../.local/fashion-extraction-test-", import.meta.url)));
  const originalFetch = globalThis.fetch;
  let requests = 0;
  try {
    await writeFile(join(directory, "keep.txt"), "Existing local work");
    globalThis.fetch = async url => {
      requests++; assert.equal(url, sourcePage);
      return new Response(html, { status: 200 });
    };
    await assert.rejects(extractCircleOfFashion(directory), { code: "EEXIST" });
    assert.equal(requests, 1);
    assert.equal(await readFile(join(directory, "keep.txt"), "utf8"), "Existing local work");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
