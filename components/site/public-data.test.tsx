import assert from "node:assert/strict";
import { test } from "node:test";
import { toPublicProject, toPublicSiteSettings } from "@/lib/site/public";
import { arrangeVideos } from "@/lib/site/video-page";
import { pagePalette, paletteInk, colourContrast } from "@/lib/site/page-palette";
import { paletteStyle } from "@/lib/site/palette-style";
import { atmosphereProfile, atmosphereFallback } from "@/lib/visual/atmosphere";

const palette = { mode: "custom", background: "#19232f", colourA: "#dcb2bd", colourB: "#dfd79c", accent: "#a8cce6" };
const film = { id: "film", verified: true, filename: "original.mp4", mimeType: "video/mp4", storageKey: "private/original", sha256: "secret-hash", url: "https://private.test/original" };

test("public playback preserves legacy uploads but never serializes inactive film/storage metadata", () => {
  assert.equal(toPublicProject({ film }, "video").videoSource, "upload");
  assert.equal(toPublicProject({ film }, "video").film?.url, "/api/cms/media/file/original.mp4");
  assert.equal(toPublicProject({}, "video").videoSource, "none");
  for (const videoSource of ["youtube", "none"]) {
    const project = toPublicProject({ film, videoSource, youtubeUrl: "https://youtu.be/abcdefghijk" }, "video");
    assert.equal(project.film, null);
    assert.equal(project.youtubeId, videoSource === "youtube" ? "abcdefghijk" : null);
    assert.doesNotMatch(JSON.stringify(project), /private\/original|secret-hash|private.test|original.mp4/);
  }
  assert.equal(toPublicProject({ videoSource: "youtube", youtubeUrl: "https://evil.test/embed/abcdefghijk" }, "video").youtubeId, null);
});

test("only Fashion projects map page palettes; invalid and inherited palettes retain section defaults", () => {
  assert.deepEqual(toPublicProject({ palette }, "fashion").palette, pagePalette(palette));
  assert.equal(toPublicProject({ palette }, "video").palette, null);
  assert.equal(pagePalette({ ...palette, colourA: "red" }), null);
  assert.equal(pagePalette({ ...palette, mode: "inherit" }), null);
});

test("landing mapping retains only selection IDs and fresh published results determine visibility", () => {
  const settings = toPublicSiteSettings({ videoPage: { heading: "Films", intro: "Exact copy.", featuredVideo: { id: "two", secret: "unpublished" }, orderedVideos: [{ video: "one" }, { video: { id: "two" } }, { video: "one" }, { video: "draft" }] } });
  assert.deepEqual(settings.videoPage, { heading: "Films", intro: "Exact copy.", featuredVideoId: "two", orderedVideoIds: ["one", "two", "draft"] });
  const projects = ["one", "two", "three"].map(id => toPublicProject({ id, slug: id }, "video"));
  assert.deepEqual(arrangeVideos(projects, settings.videoPage).map(video => video.id), ["two", "one", "three"]);
  assert.deepEqual(arrangeVideos(projects.filter(video => video.id !== "two"), settings.videoPage).map(video => video.id), ["one", "three"]);
  assert.doesNotMatch(JSON.stringify(settings), /unpublished/);
});

test("custom atmosphere and all text roles remain contrast-safe on dark, light and midtone grounds", () => {
  for (const background of ["#000000", "#ffffff", "#19232f", "#e7ded9", "#757575", "#777777", "#ff00ff", "#00ff00"]) {
    const custom = pagePalette({ ...palette, background, colourA: "#000000", colourB: "#ffffff", accent: "#ff00ff" })!;
    const ink = paletteInk(background);
    const style = paletteStyle(custom) as Record<string, string>;
    const profile = atmosphereProfile("fashion", custom);
    for (const surface of [background, ...profile.colours]) {
      assert.ok(colourContrast(surface, ink) >= 4.5);
      assert.ok(colourContrast(surface, style["--page-accent"]) >= 4.5);
    }
    assert.ok(atmosphereFallback("journal", custom).includes(profile.colours[0]));
    assert.equal(style.backgroundColor, background);
  }
  const custom = pagePalette(palette)!;
  assert.notDeepEqual(atmosphereProfile("fashion", custom).colours, atmosphereProfile("fashion").colours);
  assert.ok(atmosphereProfile("fashion", custom).colours.some(colour => colour !== custom.background));
  assert.equal(paletteStyle(null), undefined);
});
