import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicMedia, PublicProject } from "@/lib/site/types";

// Keep Next's link/CSS bundler interop out of Node; browser checks use real Next.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".css")) return { url: "data:text/javascript,export default {};", shortCircuit: true };
    if (specifier === "next/link") return {
      url: `data:text/javascript,${encodeURIComponent(`import { createElement } from ${JSON.stringify(import.meta.resolve("react"))}; export default function Link({children, ...props}) { return createElement("a", props, children); }`)}`,
      shortCircuit: true,
    };
    return nextResolve(specifier, context);
  },
});
const { ProjectDetail } = await import("./ProjectDetail");
hooks.deregister();

const images: PublicMedia[] = Array.from({ length: 10 }, (_, index) => ({
  id: `fixture-image-${index + 1}`, url: `/api/cms/media/file/fixture-${index + 1}.jpg`,
  filename: `fixture-${index + 1}.jpg`, mimeType: "image/jpeg", alt: `Synthetic garment photograph ${index + 1}`,
  caption: "", width: 1920, height: 3416,
}));
const project: PublicProject = {
  id: "fixture-project", kind: "fashion", title: "Synthetic fashion study", slug: "synthetic-fashion-study",
  excerpt: "An exact project introduction with its collaboration credit.",
  body: { root: { type: "root", direction: null, format: "", indent: 0, version: 1, children: [] } },
  cover: images[0], film: null, gallery: images.slice(1), turntableFrames: [], credits: "", year: "2025", firstPublishedAt: null,
};

test("Fashion introduction appears once, before its first photograph", () => {
  const html = renderToStaticMarkup(<ProjectDetail project={project} />);
  assert.equal(html.split(project.excerpt).length - 1, 1);
  assert.ok(html.indexOf(project.excerpt) < html.indexOf(`src="${images[0].url}"`));
  assert.match(html, /href="\/fashion"/);
  assert.match(html, /site-project-detail--fashion/);
});

test("Fashion keeps all ten photographs in order with dimensions, alt text and lazy gallery loading", () => {
  const html = renderToStaticMarkup(<ProjectDetail project={project} />);
  assert.equal((html.match(/<img /g) || []).length, 10);
  assert.equal((html.match(/loading="eager"/g) || []).length, 1);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 9);
  let previous = -1;
  for (const image of images) {
    const position = html.indexOf(`src="${image.url}"`);
    assert.ok(position > previous); previous = position;
    assert.ok(html.includes(`alt="${image.alt}"`));
  }
  assert.equal((html.match(/width="1920" height="3416"/g) || []).length, 10);
  assert.ok(!html.includes("<video"));
  assert.ok(!html.includes("garment views"));
});

test("Fashion private preview retains its explicit unpublished notice and project credits", () => {
  const html = renderToStaticMarkup(<ProjectDetail project={{ ...project, credits: "Supplied project credits" }} preview />);
  assert.match(html, /site-project-preview--fashion/);
  assert.match(html, /Unpublished changes are not visible on the public site/);
  assert.match(html, /Supplied project credits/);
});

test("Video preserves native playback and its introduction after the film", () => {
  const film = { ...images[0], mimeType: "video/mp4", filename: "fixture.mp4", url: "/api/cms/media/file/fixture.mp4" };
  const html = renderToStaticMarkup(<ProjectDetail project={{ ...project, kind: "video", film }} />);
  assert.ok(html.indexOf("<video") < html.indexOf(project.excerpt));
  assert.equal(html.split(project.excerpt).length - 1, 1);
  assert.match(html, /controls=""/);
  assert.match(html, /href="\/video"/);
  assert.ok(!html.includes("site-project-detail--fashion"));
});

test("text-only Fashion projects retain their empty-media state without fabricated photographs", () => {
  const html = renderToStaticMarkup(<ProjectDetail project={{ ...project, cover: null, gallery: [] }} />);
  assert.match(html, /Images and media for this project are not available yet/);
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes(project.excerpt));
});
