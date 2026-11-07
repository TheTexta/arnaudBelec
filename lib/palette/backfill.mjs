import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { analyseImage } from "../photographs/analyse-image.mjs";
import { PHOTOGRAPH_BUCKET, MAXIMUM_INPUT_PIXELS, MAXIMUM_UPLOAD_BYTES } from "../photographs/config.mjs";
import { assertPath, objectProvider } from "../photographs/storage.mjs";
import { BackfillError } from "./backfill-error.mjs";
import { MMCQ_VIBRANT_ALGORITHM, MMCQ_SAMPLE_LONGEST_SIDE } from "./config.mjs";
import { rgbToHex, rgbToLab, rgbToOklab } from "./oklab-k-medoids.mjs";
import { MMCQ_MINIMUM_DISTANCE } from "./mmcq-vibrant.mjs";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

export async function analyserRuntime() {
  const files = ["config.mjs", "mmcq-vibrant.mjs", "oklab-k-medoids.mjs", "edge-background.mjs", "backfill.mjs", "backfill-storage.mjs", "backfill-error.mjs",
    "../photographs/analyse-image.mjs", "../photographs/config.mjs", "../photographs/storage.mjs", "../../scripts/reanalyse-photographs.mjs"];
  return { node: process.version, sharp: sharp.versions,
    files: Object.fromEntries(await Promise.all(files.map(async file => [file, sha256(await readFile(new URL(file, import.meta.url)))]))) };
}

export function parseBackfillArgs(args) {
  const [command = "help", ...options] = args;
  if (["help", "--help"].includes(command) && !options.length) return { command: "help" };
  if (!["prepare", "verify", "apply", "rollback"].includes(command)) throw new BackfillError("Choose prepare, verify, apply or rollback; see help.");
  const parsed = { command };
  for (const option of options) {
    const match = /^--(run|sha256|confirm)=(.+)$/.exec(option);
    if (!match || Object.hasOwn(parsed, match[1])) throw new BackfillError("Invalid or repeated backfill option; see help.");
    parsed[match[1]] = match[2];
  }
  if (!parsed.run) throw new BackfillError("Supply --run=PRIVATE_DIRECTORY.");
  if (command === "prepare" && (parsed.sha256 || parsed.confirm)) throw new BackfillError("Prepare cannot apply a run or accept confirmation.");
  if (command !== "prepare" && !/^[a-f0-9]{64}$/.test(parsed.sha256 ?? "")) throw new BackfillError("Supply the independently recorded --sha256=RUN_SHA256.");
  if (["apply", "rollback"].includes(command) && parsed.confirm !== "arnaudbelec") throw new BackfillError("Palette writes require --confirm=arnaudbelec.");
  if (command === "verify" && parsed.confirm) throw new BackfillError("Verify is read-only and does not accept confirmation.");
  return parsed;
}

function validatePalette(analysis, colours, background, strict = false) {
  const modern = analysis.algorithm === MMCQ_VIBRANT_ALGORITHM;
  if (!modern && analysis.algorithm !== "oklab-kmedoids-chroma-background-v2") throw new BackfillError("Unsupported saved palette model; stop for a separate recovery plan.");
  if (analysis.algorithm_iterations !== (modern ? 2 : 10) ||
    !(modern ? [96, 256] : [96]).includes(analysis.sample_longest_side) ||
    analysis.palette_size !== colours.length || colours.length < 1 || colours.length > 7 || (!modern && colours.length !== 7) ||
    !/^#[0-9a-f]{6}$/i.test(background ?? "") || !Number.isFinite(Date.parse(analysis.analyzed_at))) throw new BackfillError("Invalid saved palette metadata.");
  const seen = new Set();
  for (const [index, colour] of colours.entries()) {
    const rgb = [colour.red, colour.green, colour.blue];
    if (colour.rank !== index + 1 || rgb.some(v => !Number.isInteger(v) || v < 0 || v > 255) ||
      colour.hex?.toLowerCase() !== rgbToHex(rgb) || !Number.isFinite(colour.weight) || colour.weight < 0 || colour.weight > 1 ||
      (modern && (seen.has(colour.hex.toLowerCase()) || colour.weight === 0)) ||
      [colour.lab_l, colour.lab_a, colour.lab_b].some(v => !Number.isFinite(v))) throw new BackfillError("Invalid saved palette colour.");
    if (strict) {
      const lab = rgbToLab(rgb);
      if ([colour.lab_l, colour.lab_a, colour.lab_b].some((v, i) => Math.abs(v - lab[i]) > 0.000001)) throw new BackfillError("Palette coordinates are not CIELAB.");
      const oklab = rgbToOklab(rgb);
      for (const previous of colours.slice(0, index)) {
        const other = rgbToOklab([previous.red, previous.green, previous.blue]);
        if (Math.hypot(...oklab.map((v, i) => v - other[i])) < MMCQ_MINIMUM_DISTANCE) throw new BackfillError("Palette colours are not distinct.");
      }
    }
    seen.add(colour.hex.toLowerCase());
  }
  if (Math.abs(colours.reduce((sum, c) => sum + c.weight, 0) - 1) > 0.000007) throw new BackfillError("Palette weights do not sum to one.");
}

function validateSnapshot(snapshot, strict = false) {
  if (!/^[a-f0-9]{32}$/.test(snapshot?.schema ?? "") ||
    ![snapshot.photographs, snapshot.analyses, snapshot.colours].every(Array.isArray)) throw new BackfillError("Invalid palette snapshot.");
  const photos = new Map(snapshot.photographs.map(p => [p.id, p]));
  if (!photos.size || photos.size !== snapshot.photographs.length) throw new BackfillError("Empty or duplicate catalogue.");
  const analyses = new Set();
  for (const analysis of snapshot.analyses) {
    const photo = photos.get(analysis.photograph_id);
    if (!photo || analyses.has(photo.id)) throw new BackfillError("Unexpected palette analysis identity.");
    const colours = snapshot.colours.filter(c => c.photograph_id === photo.id).sort((a, b) => a.rank - b.rank);
    validatePalette(analysis, colours, photo.background_hex, strict);
    if (strict && (analysis.algorithm !== MMCQ_VIBRANT_ALGORITHM || analysis.sample_longest_side !== MMCQ_SAMPLE_LONGEST_SIDE)) throw new BackfillError("The run does not contain the current analyser output.");
    analyses.add(photo.id);
  }
  if (snapshot.colours.some(c => !analyses.has(c.photograph_id)) || (strict && analyses.size !== photos.size)) throw new BackfillError("Incomplete palette snapshot.");
}

export function validatePreparedRun(run) {
  if (run?.version !== 1 || run.project !== PHOTOGRAPH_BUCKET ||
    typeof run.origin !== "string" || !run.runtime || !Array.isArray(run.originals)) throw new BackfillError("Invalid Arnaud palette run.");
  validateSnapshot(run.before);
  validateSnapshot(run.after, true);
  if (canonical(run.before.photographs) !== canonical(run.after.photographs) || run.before.schema !== run.after.schema) throw new BackfillError("A palette run cannot change photographs or schema.");
  if (run.originals.length !== run.before.photographs.length) throw new BackfillError("Incomplete original-file verification.");
  const ids = new Set();
  for (const source of run.originals) {
    const photo = run.before.photographs.find(p => p.id === source.photographId);
    if (!photo || ids.has(photo.id) || source.path !== photo.storage_path || source.provider !== objectProvider(photo.storage_provider) ||
      !/^[a-f0-9]{64}$/.test(source.sha256 ?? "") || !Number.isSafeInteger(source.size) || source.size < 1 || source.size > MAXIMUM_UPLOAD_BYTES ||
      !(source.etag === null || typeof source.etag === "string")) throw new BackfillError("Invalid original-file identity.");
    assertPath(source.path);
    ids.add(photo.id);
  }
}

/** No writes: the same production analyser prepares all rows before any apply. */
export async function preparePaletteRun(before, readOriginal, origin, runtime, analyse = analyseImage) {
  validateSnapshot(before);
  const after = { schema: before.schema, photographs: structuredClone(before.photographs), analyses: [], colours: [] };
  const originals = [], previews = [];
  for (const photo of before.photographs) {
    assertPath(photo.storage_path);
    if (!/^#[0-9a-f]{6}$/i.test(photo.background_hex ?? "")) throw new BackfillError("Backfill requires an existing page background; no photograph rows will be changed.");
    const { bytes, ...identity } = await readOriginal(photo);
    if (sha256(bytes) !== identity.sha256 || bytes.length !== identity.size) throw new BackfillError("Original bytes failed checksum verification.");
    const analysis = await analyse(bytes, photo.id, { backgroundHex: photo.background_hex });
    const { background_hex, colours, ...metadata } = analysis;
    if (background_hex !== photo.background_hex) throw new BackfillError("The analyser changed the saved background.");
    after.analyses.push(metadata);
    after.colours.push(...colours.map(colour => ({ photograph_id: photo.id, ...colour })));
    originals.push({ photographId: photo.id, ...identity });
    const preview = await sharp(bytes, { limitInputPixels: MAXIMUM_INPUT_PIXELS }).rotate()
      .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    previews.push({ id: photo.id, image: `data:image/jpeg;base64,${preview.toString("base64")}` });
  }
  const run = { version: 1, project: PHOTOGRAPH_BUCKET, origin, runtime, before, after, originals, previews };
  validatePreparedRun(run);
  return run;
}

export async function verifyOriginals(run, readOriginal) {
  for (const expected of run.originals) {
    const photo = run.before.photographs.find(p => p.id === expected.photographId);
    const { bytes, ...identity } = await readOriginal(photo);
    if (sha256(bytes) !== expected.sha256 || bytes.length !== expected.size ||
      canonical(identity) !== canonical(Object.fromEntries(Object.entries(expected).filter(([key]) => key !== "photographId")))) {
      throw new BackfillError("An original changed since preparation. Stop; do not edit the frozen run.");
    }
  }
}

export async function transitionPaletteRun(service, run, command, readOriginal, runtime) {
  if (!["verify", "apply", "rollback"].includes(command)) throw new BackfillError("Invalid palette transition command.");
  validatePreparedRun(run);
  const call = async verify => {
    const reverse = command === "rollback";
    const { data, error } = await service.rpc("arnaud_apply_palette_snapshot", {
      p_expected: reverse ? run.after : run.before, p_desired: reverse ? run.before : run.after, p_verify: verify,
    });
    if (error) throw new BackfillError("Palette request failed or its outcome is uncertain. Run verify with the original SHA-256 pin before retrying.");
    return data;
  };
  const state = await call(true);
  if (!["before", "after", "stale"].includes(state)) throw new BackfillError("Unexpected palette verification result; stop before any write.");
  if (command === "verify") return state;
  if (state === "after") return "already_applied";
  if (state !== "before") throw new BackfillError("Stale palette run. Stop for a separately reviewed recovery plan.");
  if (canonical(run.runtime) !== canonical(runtime)) throw new BackfillError("Analyser/runtime changed. Prepare a new run; do not rewrite this one.");
  await verifyOriginals(run, readOriginal);
  // SQL rechecks the entire catalogue, both palette tables and schema under locks.
  const result = await call(false);
  if (!["applied", "already_applied"].includes(result)) throw new BackfillError("Unexpected palette transition result; verify before retrying.");
  return result;
}

const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
export function paletteReviewHtml(run) {
  const swatches = (snapshot, id) => snapshot.colours.filter(c => c.photograph_id === id).sort((a, b) => a.rank - b.rank)
    .map(c => `<li><span style="background:${escape(c.hex)}"></span>${escape(c.hex)} · ${(c.weight * 100).toFixed(1)}%</li>`).join("");
  return `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Arnaud palette comparison — not applied</title>
    <style>body{font:16px system-ui;margin:32px;background:#eee;color:#111}article{border-top:1px solid;padding:24px 0;display:flex;gap:24px;flex-wrap:wrap}img{max-width:320px;height:auto;object-fit:contain}ul{list-style:none;padding:0}li{display:flex;align-items:center;gap:8px;margin:4px 0}span{display:inline-block;width:40px;height:24px}</style>
    <h1>Arnaud palette comparison</h1><p>Local preview only. Original files and saved backgrounds are unchanged. Weights describe background-filtered populations.</p>
    ${run.before.photographs.map(photo => `<article><img alt="Local review preview" src="${escape(run.previews.find(p => p.id === photo.id)?.image ?? "")}"><div><h2>${escape(photo.filename)}</h2><p>Saved background: ${escape(photo.background_hex)}</p><h3>Before</h3><ul>${swatches(run.before, photo.id)}</ul></div><div><h3>MMCQ · up to seven</h3><ul>${swatches(run.after, photo.id)}</ul></div></article>`).join("")}`;
}
