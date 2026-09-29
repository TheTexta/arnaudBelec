import { extname } from "node:path";
import { MAXIMUM_UPLOAD_BYTES, MAXIMUM_INPUT_PIXELS, PHOTOGRAPH_UPLOAD_FORMATS } from "@/lib/photographs/config.mjs";

export type UploadFormat = { contentType: string; extension: string; sharpFormat: string };

export function validateFilename(value: unknown): { filename: string; format: UploadFormat } {
  if (typeof value !== "string" || !value || value.length > 240 || /[\u0000-\u001f/\\]/.test(value)) {
    throw new Error("Choose a file with a valid name of 240 characters or fewer.");
  }
  const format = PHOTOGRAPH_UPLOAD_FORMATS[extname(value).toLowerCase() as keyof typeof PHOTOGRAPH_UPLOAD_FORMATS];
  if (!format) throw new Error("Use a JPG, PNG, or WebP image.");
  return { filename: value, format };
}

export function validateFileSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAXIMUM_UPLOAD_BYTES) {
    throw new Error("The image must be a non-empty file of 500 MiB or smaller.");
  }
  return value;
}

export function validateDimensions(width: unknown, height: unknown): { width: number; height: number } {
  if (typeof width !== "number" || typeof height !== "number" || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 1 || height < 1 || width * height > MAXIMUM_INPUT_PIXELS) {
    throw new Error("The image dimensions are invalid or exceed the 120-million-pixel limit.");
  }
  return { width, height };
}

export function optionalText(value: unknown, maximumLength: number, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximumLength) {
    throw new Error(`${label} must be ${maximumLength} characters or fewer.`);
  }
  return value.trim() || null;
}

export function capturedDate(value: unknown, filename: string): string | null {
  const fromFilename = filename.match(/^(\d{4})(\d{2})(\d{2})-/);
  const result = optionalText(value, 10, "Capture date")
    ?? (fromFilename ? `${fromFilename[1]}-${fromFilename[2]}-${fromFilename[3]}` : null);
  if (!result) return null;

  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.valueOf())
    || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error("Capture date must be a valid date using YYYY-MM-DD.");
  }
  return result;
}

export function sortOrder(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -2_147_483_648 || parsed > 2_147_483_647) {
    throw new Error("Sort order must be a whole number.");
  }
  return parsed;
}
