#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

import {
  MAXIMUM_UPLOAD_BYTES,
  PHOTOGRAPH_BUCKET,
} from "../lib/photographs/config.mjs";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

function clientFromEnvironment() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before setting up Storage.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function verifyBucket(bucket) {
  const actualMimeTypes = Array.isArray(bucket.allowed_mime_types)
    ? [...bucket.allowed_mime_types].sort()
    : null;
  const expectedMimeTypes = [...allowedMimeTypes].sort();
  const compatible = bucket.id === PHOTOGRAPH_BUCKET
    && bucket.name === PHOTOGRAPH_BUCKET
    && bucket.public === true
    && Number(bucket.file_size_limit) === MAXIMUM_UPLOAD_BYTES
    && JSON.stringify(actualMimeTypes) === JSON.stringify(expectedMimeTypes);

  if (!compatible) {
    throw new Error(
      `Bucket ${PHOTOGRAPH_BUCKET} exists with incompatible settings. `
      + `Expected public=true, file_size_limit=${MAXIMUM_UPLOAD_BYTES}, `
      + `allowed_mime_types=${JSON.stringify(allowedMimeTypes)}. `
      + `Found ${JSON.stringify({
        public: bucket.public,
        file_size_limit: bucket.file_size_limit,
        allowed_mime_types: bucket.allowed_mime_types,
      })}.`,
    );
  }
}

async function main() {
  const supabase = clientFromEnvironment();
  let { data: bucket, error } = await supabase.storage.getBucket(PHOTOGRAPH_BUCKET);

  if (error?.status === 404) {
    const { error: createError } = await supabase.storage.createBucket(PHOTOGRAPH_BUCKET, {
      public: true,
      fileSizeLimit: MAXIMUM_UPLOAD_BYTES,
      allowedMimeTypes,
    });
    if (createError && createError.status !== 409) {
      throw new Error(`Could not create bucket ${PHOTOGRAPH_BUCKET}: ${createError.message}`);
    }
    ({ data: bucket, error } = await supabase.storage.getBucket(PHOTOGRAPH_BUCKET));
  }

  if (error || !bucket) {
    throw new Error(`Could not read bucket ${PHOTOGRAPH_BUCKET}: ${error?.message ?? "empty response"}`);
  }

  verifyBucket(bucket);
  console.log(`Bucket ${PHOTOGRAPH_BUCKET} is ready (public, 500 MiB, JPEG/PNG/WebP).`);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
