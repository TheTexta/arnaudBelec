#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { analyseImage, imageMetadata } from "../lib/photographs/analyse-image.mjs";
import {
  MAXIMUM_UPLOAD_BYTES,
  PHOTOGRAPH_BUCKET,
  PHOTOGRAPH_UPLOAD_FORMATS,
} from "../lib/photographs/config.mjs";

nextEnv.loadEnvConfig(process.cwd());

const usage = `Usage: npm run photos:import -- [options] <image> [image ...]

Uploads JPEG, PNG, and WebP photographs to the ${PHOTOGRAPH_BUCKET} bucket and
publishes their image metadata and seven-colour OKLab k-medoids palettes in one database RPC.

Options:
  --manifest <file>       JSON object keyed by an image argument or basename.
                          Values may have title, altText, capturedAt, sortOrder.
  --title <text>          Default title for every supplied image.
  --alt-text <text>       Default alt text for every supplied image.
  --captured-at <date>    Default capture date (YYYY-MM-DD); otherwise EXIF,
                          then a YYYYMMDD- filename prefix, is used.
  --sort-order <integer>  Default sort order for every supplied image.
  --dry-run               Validate and analyze images without uploading.
  --help                  Show this help.

Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
in .env.local or the environment before an upload.
Example: npm run photos:import -- --manifest photos.json photo1.jpg photo2.webp`;

const valueOptions = {
  "--manifest": "manifestPath",
  "--title": "title",
  "--alt-text": "altText",
  "--captured-at": "capturedAt",
  "--sort-order": "sortOrder",
};

function parseArguments(args) {
  const options = { files: [], defaults: {}, manifestPath: null, dryRun: false, help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument in valueOptions) {
      const value = args[++index];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      const key = valueOptions[argument];
      if (key === "manifestPath") options.manifestPath = value;
      else options.defaults[key] = value;
      continue;
    }
    if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    }
    options.files.push(argument);
  }

  if (!options.help && options.files.length === 0) {
    throw new Error("Supply at least one image path. Use --help for usage.");
  }

  return options;
}

async function loadManifest(path) {
  if (!path) return {};

  const value = JSON.parse(await readFile(resolve(path), "utf8"));
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("The manifest must be a JSON object keyed by image path or basename.");
  }
  return value;
}

function manifestEntry(manifest, fileArgument, filename) {
  const value = manifest[fileArgument] ?? manifest[resolve(fileArgument)] ?? manifest[filename] ?? {};
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Invalid manifest metadata for ${filename}.`);
  }
  return value;
}

function optionalText(value, maximumLength, label) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximumLength) {
    throw new Error(`${label} must be ${maximumLength} characters or fewer.`);
  }
  return value.trim();
}

function originalFilename(fileArgument) {
  const filename = basename(fileArgument);
  if (!filename || filename.length > 240 || /[\u0000-\u001f/\\]/.test(filename)) {
    throw new Error("Invalid image filename.");
  }
  return filename;
}

function capturedDate(value, filename, metadataDate) {
  const fromFilename = filename.match(/^(\d{4})(\d{2})(\d{2})-/);
  const result = optionalText(value, 10, "Capture date")
    ?? metadataDate
    ?? (fromFilename ? `${fromFilename[1]}-${fromFilename[2]}-${fromFilename[3]}` : null);

  if (result) {
    const parsed = new Date(`${result}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)
      || Number.isNaN(parsed.valueOf())
      || parsed.toISOString().slice(0, 10) !== result) {
      throw new Error("Captured date must be a valid date using YYYY-MM-DD.");
    }
  }
  return result;
}

function sortOrder(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -2_147_483_648 || parsed > 2_147_483_647) {
    throw new Error("Sort order must be a whole number.");
  }
  return parsed;
}

function clientFromEnvironment() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before uploading.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function prepareImage(fileArgument, defaults, manifest) {
  const filePath = resolve(fileArgument);
  const filename = originalFilename(fileArgument);
  const format = PHOTOGRAPH_UPLOAD_FORMATS[extname(filename).toLowerCase()];
  if (!format) throw new Error("Use a JPG, PNG, or WEBP image.");

  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size === 0 || fileStats.size > MAXIMUM_UPLOAD_BYTES) {
    throw new Error("The image must be a non-empty file of 500 MiB or smaller.");
  }

  const buffer = await readFile(filePath);
  if (buffer.length === 0 || buffer.length > MAXIMUM_UPLOAD_BYTES) {
    throw new Error("The image must be a non-empty file of 500 MiB or smaller.");
  }

  const image = await imageMetadata(buffer);
  if (image.format !== format.sharpFormat) {
    throw new Error("The image file type does not match its contents.");
  }

  const photographId = randomUUID();
  const storagePath = `uploads/${photographId}.${format.extension}`;
  const analysis = await analyseImage(buffer, photographId);
  const metadata = { ...defaults, ...manifestEntry(manifest, fileArgument, filename) };

  return {
    buffer,
    filename,
    format,
    photographId,
    storagePath,
    rpcArguments: {
      p_photograph_id: photographId,
      p_storage_path: storagePath,
      p_filename: filename,
      p_image_width: image.width,
      p_image_height: image.height,
      p_captured_at: capturedDate(metadata.capturedAt, filename, image.capturedAt),
      p_title: optionalText(metadata.title, 200, "Title"),
      p_alt_text: optionalText(metadata.altText, 500, "Alt text"),
      p_sort_order: sortOrder(metadata.sortOrder),
      p_algorithm: analysis.algorithm,
      p_algorithm_iterations: analysis.algorithm_iterations,
      p_sample_longest_side: analysis.sample_longest_side,
      p_palette_size: analysis.palette_size,
      p_analyzed_at: analysis.analyzed_at,
      p_background_hex: analysis.background_hex,
      p_colours: analysis.colours,
    },
  };
}

async function uploadAndPublish(supabase, prepared) {
  const bucket = supabase.storage.from(PHOTOGRAPH_BUCKET);
  const { error: uploadError } = await bucket.upload(prepared.storagePath, prepared.buffer, {
    cacheControl: "31536000",
    contentType: prepared.format.contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  try {
    const { error: publishError } = await supabase.rpc(
      "arnaud_publish_photograph",
      prepared.rpcArguments,
    );
    if (publishError) throw publishError;
  } catch (publishError) {
    let cleanupError;
    try {
      ({ error: cleanupError } = await bucket.remove([prepared.storagePath]));
    } catch (error) {
      cleanupError = error;
    }
    const message = publishError instanceof Error ? publishError.message : String(publishError);
    if (cleanupError) {
      const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      throw new Error(`Metadata publication failed: ${message}. Cleanup also failed: ${cleanupMessage}`);
    }
    throw new Error(`Metadata publication failed: ${message}. Uploaded object was removed.`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }

  const manifest = await loadManifest(options.manifestPath);
  const supabase = options.dryRun ? null : clientFromEnvironment();
  let failures = 0;

  for (const fileArgument of options.files) {
    try {
      const prepared = await prepareImage(fileArgument, options.defaults, manifest);
      if (options.dryRun) {
        console.log(JSON.stringify({ file: fileArgument, ...prepared.rpcArguments }, null, 2));
      } else {
        await uploadAndPublish(supabase, prepared);
        console.log(`Published ${prepared.filename} as ${prepared.storagePath}`);
      }
    } catch (error) {
      failures += 1;
      console.error(`${fileArgument}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures) process.exitCode = 1;
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
