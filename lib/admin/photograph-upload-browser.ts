import { Upload } from "tus-js-client";
import { MMCQ_SAMPLE_LONGEST_SIDE } from "../palette/config.mjs";
import type { PhotographUploadAdapter } from "./photograph-upload";

export const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function imageSample(file: File) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase is not configured.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    if (width < 1 || height < 1 || width * height > 120_000_000) {
      throw new Error("The image dimensions are invalid or exceed the 120-million-pixel limit.");
    }
    const scale = Math.min(1, MMCQ_SAMPLE_LONGEST_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser could not create an image sample.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const sample = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the image sample.")), "image/png");
    });
    return { sample, width, height };
  } finally {
    bitmap.close();
  }
}

export const photographUploadBrowser: PhotographUploadAdapter = {
  sample: imageSample,
  // Resolve storage only during a browser operation, never during SSR.
  recovery: {
    getItem: key => sessionStorage.getItem(key),
    setItem: (key, value) => sessionStorage.setItem(key, value),
    removeItem: key => sessionStorage.removeItem(key),
  },
  async r2(file, ticket, request, progress, signal) {
    const { uploadR2File } = await import("./r2-browser");
    signal.throwIfAborted();
    await uploadR2File(file, ticket, request, progress, signal);
  },
  supabase(file, prepared, progress, signal) {
    return new Promise<void>((resolve, reject) => {
      const finish = () => signal.removeEventListener("abort", abort);
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const upload = new Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        headers: { apikey: SUPABASE_ANON_KEY!, "x-signature": prepared.token },
        metadata: { bucketName: "arnaudbelec", objectName: prepared.path, contentType: MIME_BY_EXTENSION[extension], cacheControl: "31536000" },
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        storeFingerprintForResuming: false,
        onProgress: (sent, total) => progress(Math.round(sent / total * 100)),
        onError: error => { finish(); reject(error); },
        onSuccess: () => { finish(); resolve(); },
      });
      const abort = () => { finish(); void upload.abort().catch(() => {}); reject(signal.reason); };
      signal.addEventListener("abort", abort, { once: true });
      upload.start();
    });
  },
};
