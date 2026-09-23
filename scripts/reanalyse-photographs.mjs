#!/usr/bin/env node

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { analyseImage } from "../lib/photographs/analyse-image.mjs";
import { PHOTOGRAPH_BUCKET, PHOTOGRAPH_PALETTE_SIZE } from "../lib/photographs/config.mjs";

nextEnv.loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
if (args.some((argument) => argument !== "--dry-run")) {
  throw new Error("Usage: npm run photos:reanalyze -- [--dry-run]");
}
const dryRun = args.includes("--dry-run");
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function publishedPhotographs() {
  const photographs = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("arnaud_photographs")
      .select("id,storage_path,filename")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    photographs.push(...data);
    if (data.length < pageSize) break;
  }

  return photographs;
}

async function main() {
  const photographs = await publishedPhotographs();
  const prepared = [];

  // Analyse every stored image before replacing any database rows.
  for (const photograph of photographs) {
    const { data, error } = await supabase.storage
      .from(PHOTOGRAPH_BUCKET)
      .download(photograph.storage_path);
    if (error) throw new Error(`${photograph.filename}: ${error.message}`);

    const analysis = await analyseImage(
      Buffer.from(await data.arrayBuffer()),
      photograph.id,
    );
    if (analysis.colours.length !== PHOTOGRAPH_PALETTE_SIZE) {
      throw new Error(`${photograph.filename}: incomplete colour analysis.`);
    }

    prepared.push({ photograph, analysis });
    console.log(`Analysed ${photograph.filename}: ${analysis.colours.length} colours; background ${analysis.background_hex}`);
  }

  if (dryRun) {
    console.log(`Dry run complete: ${prepared.length} photographs; no database rows changed.`);
    return;
  }

  for (const { photograph, analysis } of prepared) {
    const { error } = await supabase.rpc("arnaud_replace_photo_palette", {
      p_photograph_id: photograph.id,
      p_algorithm: analysis.algorithm,
      p_algorithm_iterations: analysis.algorithm_iterations,
      p_sample_longest_side: analysis.sample_longest_side,
      p_palette_size: analysis.palette_size,
      p_analyzed_at: analysis.analyzed_at,
      p_background_hex: analysis.background_hex,
      p_colours: analysis.colours,
    });
    if (error) throw new Error(`${photograph.filename}: ${error.message}`);

    const { data: colours, error: readError } = await supabase
      .from("arnaud_photo_palette_colours")
      .select("rank")
      .eq("photograph_id", photograph.id)
      .order("rank");
    if (readError || colours?.length !== PHOTOGRAPH_PALETTE_SIZE ||
      colours.some((colour, index) => colour.rank !== index + 1)) {
      throw new Error(`${photograph.filename}: seven-colour verification failed: ${readError?.message ?? "unexpected ranks"}`);
    }

    const { data: metadata, error: metadataError } = await supabase
      .from("arnaud_photo_palette_analyses")
      .select("algorithm,palette_size")
      .eq("photograph_id", photograph.id)
      .single();
    if (metadataError || metadata?.algorithm !== analysis.algorithm ||
      metadata.palette_size !== PHOTOGRAPH_PALETTE_SIZE) {
      throw new Error(`${photograph.filename}: palette metadata verification failed: ${metadataError?.message ?? "unexpected algorithm or size"}`);
    }

    const { data: updatedPhotograph, error: backgroundError } = await supabase
      .from("arnaud_photographs")
      .select("background_hex")
      .eq("id", photograph.id)
      .single();
    if (backgroundError || updatedPhotograph?.background_hex !== analysis.background_hex) {
      throw new Error(`${photograph.filename}: background colour verification failed: ${backgroundError?.message ?? "unexpected colour"}`);
    }

    console.log(`Updated ${photograph.filename}`);
  }

  console.log(`Updated ${prepared.length} published photographs to seven colours.`);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
