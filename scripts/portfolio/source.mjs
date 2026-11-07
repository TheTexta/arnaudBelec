// Parse the public Adobe Portfolio markup as data; never execute source scripts.
export const origin = "https://arnaudnaudbel.myportfolio.com";
export const ownerPath = "/f5a01f46-fd9e-4866-9cc9-b9f5d38cd68e/";

export function decode(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code) => {
    if (code[0] !== "#") return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[code.toLowerCase()];
    const number = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : "\ufffd";
  });
}

export function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(match => [match[1].toLowerCase(), decode(match[3])]));
}

export function text(html) {
  return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(?:p|div|h[1-6])>/gi, "\n").replace(/<[^>]*>/g, ""))
    .replace(/[\t \r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function imageId(value) {
  const url = new URL(value);
  if (url.origin !== "https://cdn.myportfolio.com" || !url.pathname.startsWith(ownerPath) || url.username || url.password) throw new Error("Unexpected Adobe image origin/owner.");
  const match = url.pathname.slice(ownerPath.length).match(/^([a-f\d-]{36})(?:_[^/]*)?\.(jpe?g|png|webp|gif)$/i);
  if (!match || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(match[1])) throw new Error("Unexpected Adobe image path.");
  return match[1];
}

function renditionWidth(url) {
  const path = new URL(url).pathname;
  return Number(path.match(/_rw_(\d+)\./)?.[1] || path.match(/_(?:rwc|carw)_[\dx]+x(\d+)\./)?.[1] || 0);
}

export function bestRendition(urls) {
  return [...new Set(urls)].sort((a, b) => renditionWidth(b) - renditionWidth(a))[0];
}

function richTextBlocks(body) {
  const blocks = [];
  for (const start of body.matchAll(/<div\b[^>]*>/gi)) {
    if (!(attributes(start[0]).class || "").split(/\s+/).includes("rich-text")) continue;
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = start.index + start[0].length;
    let depth = 1, next;
    while ((next = tags.exec(body))) {
      depth += next[0].startsWith("</") ? -1 : 1;
      if (!depth) { blocks.push({ offset: start.index, text: text(body.slice(start.index + start[0].length, next.index)) }); break; }
    }
  }
  return blocks;
}

export function parsePage(html, path) {
  if (/<title>\s*Password Protected Page\s*<\/title>/i.test(html)) return { path, title: "Password Protected Page", protected: true,
    images: [], texts: [], youtube: [], adobe: [], css: [], metaImages: [], links: [], plainText: "Password-protected page. No protected content was accessed." };
  const rawBody = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (rawBody == null) throw new Error(`Missing page body: ${path}`);
  // Adobe repeats grid images inside inert lightbox script templates. These are
  // renditions, not visible gallery occurrences. Preserve offsets for source copy.
  const body = rawBody.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, match => " ".repeat(match.length));
  const images = [], lightboxes = new Map(), backgroundVideos = new Set();
  for (const match of body.matchAll(/<div\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if ((attrs.class || "").split(/\s+/).includes("js-lightbox") && attrs["data-src"]) lightboxes.set(imageId(attrs["data-src"]), attrs["data-src"]);
  }
  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const urls = [attrs["data-src"], attrs.src, ...[attrs["data-srcset"], attrs.srcset].filter(Boolean).flatMap(set => set.split(",").map(item => item.trim().split(/\s+/)[0]))]
      .filter(url => url && !url.startsWith("data:"));
    const imageUrls = urls.filter(url => /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(url));
    if (!imageUrls.length) continue;
    const ids = [...new Set(imageUrls.map(imageId))];
    if (ids.length !== 1) throw new Error("One image advertises different Adobe assets.");
    images.push({ id: ids[0], offset: match.index, urls: [...new Set(imageUrls)], previewUrl: imageUrls.find(url => /_rw_600\./.test(url)) || bestRendition(imageUrls), alt: attrs.alt || "" });
  }
  for (const match of body.matchAll(/https:\/\/cdn\.myportfolio\.com\/v1\/ccvproxy\/([\w-]+)\?/g)) backgroundVideos.add(match[1]);
  const embeds = [...body.matchAll(/<iframe\b[^>]*>/gi)].map(match => attributes(match[0]).src).filter(Boolean);
  const youtube = [], adobe = [...backgroundVideos];
  for (const value of embeds) {
    const url = new URL(value);
    if (url.origin === "https://www.youtube.com" && /^\/embed\/[\w-]{11}$/.test(url.pathname)) youtube.push(url.pathname.split("/").at(-1));
    else if (url.origin === "https://www-ccv.adobe.io" && /^\/v1\/player\/ccv\/[\w-]+\/embed$/.test(url.pathname)) adobe.push(url.pathname.split("/").at(-2));
    else throw new Error(`Unreviewed embedded provider: ${url.origin}`);
  }
  const css = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(attrs => attrs.rel === "stylesheet" && attrs.href?.startsWith("https://cdn.myportfolio.com/")).map(attrs => attrs.href);
  const metaImages = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0])).filter(attrs => attrs.property === "og:image").map(attrs => attrs.content).filter(Boolean);
  return { path, title: text(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ""), protected: /<title>\s*Password Protected Page\s*<\/title>/i.test(html),
    images: images.map(image => ({ ...image, lightboxUrl: lightboxes.get(image.id) || null })), texts: richTextBlocks(body), youtube: [...new Set(youtube)], adobe: [...new Set(adobe)], css, metaImages,
    links: [...body.matchAll(/<a\b[^>]*>/gi)].map(match => attributes(match[0]).href).filter(Boolean), plainText: text(body) };
}

export function parseSitemap(xml) {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(decode(match[1])));
  if (!urls.length || urls.length > 60) throw new Error("Unexpected sitemap size; review before crawling.");
  if (urls.some(url => url.origin !== origin || url.search || url.hash || url.username || url.password)) throw new Error("Unexpected sitemap origin/URL.");
  return [...new Set(urls.map(url => url.pathname))];
}

export function cssImages(css) {
  return [...css.matchAll(/url\(\s*(["']?)([^\s)"']+)\1\s*\)/gi)].map(match => decode(match[2])).filter(url => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)).map(url => ({ id: imageId(url), url }));
}

export function parsePlayer(html, id) {
  const json = html.match(/window\.ccv\$serverData\s*=\s*({[^\n]+})\s*;/)?.[1];
  if (!json) throw new Error("Adobe player metadata not found.");
  const data = JSON.parse(json);
  if (data.status !== "ok" || data.ccvid !== id) throw new Error("Adobe player identity/status changed.");
  return data;
}

export function adobeUrl(value, parent, id) {
  const url = new URL(value, parent || undefined);
  if (url.origin !== "https://cdn-prod-ccv.adobe.com" || !url.pathname.startsWith(`/${id}/rend/`) || url.username || url.password) throw new Error("Unexpected Adobe video source.");
  if (!url.search && parent) url.search = new URL(parent).search;
  return url.href;
}

export function hlsVariant(playlist, parent, id) {
  const lines = playlist.trim().split(/\r?\n/), variants = [];
  if (lines[0] !== "#EXTM3U") throw new Error("Invalid HLS master playlist.");
  if (/#EXT-X-MEDIA:|(?:[:,])AUDIO=/.test(playlist)) throw new Error("Separate HLS audio renditions need explicit support; refusing a potentially silent copy.");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#EXT-X-STREAM-INF:.*RESOLUTION=(\d+)x(\d+)/);
    if (match && lines[i + 1] && !lines[i + 1].startsWith("#")) variants.push({ width: Number(match[1]), height: Number(match[2]), url: adobeUrl(lines[i + 1], parent, id) });
  }
  const best = variants.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!best || best.width > 8192 || best.height > 8192) throw new Error("Unreviewed HLS resolution.");
  return best;
}

export function hlsSegments(playlist, parent, id) {
  const lines = playlist.trim().split(/\r?\n/);
  if (lines[0] !== "#EXTM3U" || !lines.includes("#EXT-X-ENDLIST") || /#EXT-X-(?:KEY|MAP|BYTERANGE|STREAM-INF)/.test(playlist)) throw new Error("Only unencrypted, complete MPEG-TS VOD playlists are supported.");
  if (lines.some(line => line.startsWith("#") && !/^#(?:EXTM3U$|EXT-X-(?:VERSION|TARGETDURATION|MEDIA-SEQUENCE):\d+$|EXT-X-PLAYLIST-TYPE:VOD$|EXTINF:[\d.]+,$|EXT-X-ENDLIST$)/.test(line))) throw new Error("Unreviewed HLS directive.");
  const urls = lines.filter(line => line && !line.startsWith("#")).map(line => adobeUrl(line, parent, id));
  if (!urls.length || urls.length > 100 || urls.some(url => !new URL(url).pathname.endsWith(".ts"))) throw new Error("Unexpected HLS segment membership.");
  return urls;
}
