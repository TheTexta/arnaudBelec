import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeEntrance } from "./HomeEntrance";
import { ProjectMedia } from "./ProjectMedia";
import { SiteNavigation } from "./SiteNavigation";
import { defaultSiteSettings, type PublicMedia } from "@/lib/site/types";
import type { PublicPhotograph } from "@/lib/supabase-public";
import { defaultHomepage, homePreview } from "@/lib/site/homepage";

// Deliberately synthetic test data: never passed to a public route or shipped as portfolio content.
function photo(id: string): PublicPhotograph {
  return { id, src: `/test-only/${id}.jpg`, filename: `${id} image.jpg`, title: `Test ${id}`, altText: `Alt ${id}`, width: 1200, height: 800, backgroundHex: null, palette: [], hasPaletteAnalysis: false };
}

test("empty entrance provides all real routes without inventing a featured image", () => {
  const html = renderToStaticMarkup(<HomeEntrance photographs={[]} settings={defaultSiteSettings} />);
  for (const route of ["/photos", "/blog", "/video", "/fashion"]) assert.ok(html.includes(`href="${route}"`));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("test-image"));
});

test("entrance selects the exact configured photograph without replacing catalogue metadata", () => {
  const photographs = [photo("first"), photo("featured")];
  const homepage = defaultHomepage();
  homepage.photography = { source: "photograph", photographId: "featured", image: null };
  const preview = homePreview(homepage.photography, photographs);
  assert.equal(preview?.src, photographs[1].src);
  assert.equal(preview?.alt, photographs[1].altText);
});

test("missing or cleared section selections never substitute a different photograph", () => {
  assert.equal(homePreview({ source: "photograph", photographId: "removed", image: null }, [photo("first")]), null);
  assert.equal(homePreview({ source: "none", photographId: "first", image: null }, [photo("first")]), null);
});

test("navigation identifies nested project routes without matching unrelated prefixes", () => {
  const active = renderToStaticMarkup(<SiteNavigation pathname="/video/a-film" />);
  assert.match(active, /<a (?=[^>]*href="\/video")(?=[^>]*aria-current="page")[^>]*>/);
  assert.equal((active.match(/aria-current=/g) || []).length, 1);
  const unrelated = renderToStaticMarkup(<SiteNavigation pathname="/videography" />);
  assert.ok(!unrelated.includes("aria-current"));
});

const media: PublicMedia = { id: "test-film", url: "/api/cms/media/file/test-film.mp4", filename: "test-film.mp4", mimeType: "video/mp4", alt: "Test film", caption: "", width: 1920, height: 1080 };

test("films use native controls with no autoplay and no nested project link", () => {
  const html = renderToStaticMarkup(<ProjectMedia media={media} href="/video/test-film" />);
  assert.ok(html.includes("<video"));
  assert.ok(html.includes('controls=""'));
  assert.ok(html.includes('playsInline=""'));
  assert.ok(html.includes('preload="metadata"'));
  assert.ok(!/autoplay/i.test(html));
  assert.ok(!html.includes('href="/video/test-film"'));
});

test("unsupported media has a working original-file fallback", () => {
  const html = renderToStaticMarkup(<ProjectMedia media={{ ...media, mimeType: "application/octet-stream" }} />);
  assert.ok(html.includes("This media could not be displayed."));
  assert.ok(html.includes(`href="${media.url}"`));
  assert.ok(html.includes('role="status"'));
});
