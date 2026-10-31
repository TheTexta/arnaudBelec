export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const MEDIA_FORMATS: Record<string, { extension: string; contentType: string }> = {
  jpg: { extension: "jpg", contentType: "image/jpeg" }, jpeg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" }, webp: { extension: "webp", contentType: "image/webp" },
  mp4: { extension: "mp4", contentType: "video/mp4" }, webm: { extension: "webm", contentType: "video/webm" },
  mp3: { extension: "mp3", contentType: "audio/mpeg" }, ogg: { extension: "ogg", contentType: "audio/ogg" },
  wav: { extension: "wav", contentType: "audio/wav" },
};

export function validateMedia(input: Record<string, unknown>) {
  const { filename, size } = input;
  if (typeof filename !== "string" || !filename.length || filename.length > 240 || /[\u0000-\u001f/\\]/.test(filename)) throw new Error("Use a valid filename of up to 240 characters.");
  const format = MEDIA_FORMATS[filename.split(".").pop()?.toLowerCase() ?? ""];
  if (!format) throw new Error("Use JPG, PNG, WebP, MP4, WebM, MP3, Ogg, or WAV files. SVG and HTML are not accepted.");
  if (!Number.isSafeInteger(size) || Number(size) < 1 || Number(size) > MAX_MEDIA_BYTES) throw new Error("Media must be between 1 byte and 100 MiB. Compress larger video before uploading.");
  return { filename, size: Number(size), ...format };
}

export function matchesMediaType(bytes: Uint8Array, type: string) {
  const hex = (start: number, expected: number[]) => expected.every((value, i) => bytes[start + i] === value);
  const ascii = (start: number, expected: string) => [...expected].every((char, i) => bytes[start + i] === char.charCodeAt(0));
  switch (type) {
    case "image/jpeg": return hex(0, [0xff, 0xd8, 0xff]);
    case "image/png": return hex(0, [137, 80, 78, 71, 13, 10, 26, 10]);
    case "image/webp": return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "video/mp4": return ascii(4, "ftyp");
    case "video/webm": return hex(0, [0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/mpeg": return ascii(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/ogg": return ascii(0, "OggS");
    case "audio/wav": return ascii(0, "RIFF") && ascii(8, "WAVE");
    default: return false;
  }
}
