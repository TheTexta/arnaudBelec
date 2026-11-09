export type VideoSource = "upload" | "youtube" | "none";

export function effectiveVideoSource(value: unknown, hasUploadedFilm: boolean): VideoSource {
  return value === "youtube" || value === "none" || value === "upload" ? value : hasUploadedFilm ? "upload" : "none";
}

export function youtubeVideoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  if (input.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (host === "youtu.be" && parts.length === 1) id = parts[0];
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) id = url.searchParams.get("v");
      else if (parts.length === 2 && ["embed", "shorts", "live"].includes(parts[0])) id = parts[1];
    } else if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host) && parts.length === 2 && parts[0] === "embed") id = parts[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function canonicalYoutubeUrl(value: unknown): string | null {
  const id = youtubeVideoId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
