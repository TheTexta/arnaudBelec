export const PHOTOGRAPH_BUCKET = "arnaudbelec";

export const MAXIMUM_UPLOAD_BYTES = 524_288_000;
export const MAXIMUM_INPUT_PIXELS = 120_000_000;

export const PHOTOGRAPH_UPLOAD_FORMATS = {
  ".jpg": { contentType: "image/jpeg", extension: "jpg", sharpFormat: "jpeg" },
  ".jpeg": { contentType: "image/jpeg", extension: "jpg", sharpFormat: "jpeg" },
  ".png": { contentType: "image/png", extension: "png", sharpFormat: "png" },
  ".webp": { contentType: "image/webp", extension: "webp", sharpFormat: "webp" },
};
