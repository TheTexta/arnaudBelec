"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PaletteScene } from "@/app/palette-scene";
import type { GradientOrbColour } from "@/app/gradient-orb";
import { findSimilarPhotographs } from "@/lib/photographs/similar-colours";
import { foregroundForBackground } from "@/lib/photographs/page-colours";
import { imagePlaceholder } from "@/lib/photographs/image-placeholder";
import { playColourChord } from "@/lib/audio/colour-chords";
import type { PublicPhotograph } from "@/lib/supabase-public";

const PAGE_SIZE = 36;
const gradientSlots = [
  { id: "0", name: "palette colour 1", vx: 7.5, vy: 4.5 },
  { id: "1", name: "palette colour 2", vx: -7, vy: 5.5 },
  { id: "2", name: "palette colour 3", vx: 6, vy: -7.5 },
  { id: "3", name: "palette colour 4", vx: -8, vy: -5 },
  { id: "4", name: "palette colour 5", vx: -6.5, vy: -7 },
  { id: "5", name: "palette colour 6", vx: 6.5, vy: 5 },
  { id: "6", name: "palette colour 7", vx: -7.5, vy: 6 },
] as const;

export default function PhotoDetail({
  photograph,
  photographs,
}: {
  photograph: PublicPhotograph;
  photographs: PublicPhotograph[];
}) {
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const stageRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLButtonElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasPalette = photograph.palette.length > 0;
  const gradients = useMemo<GradientOrbColour[]>(
    () => photograph.palette.slice(0, gradientSlots.length).map((colour, index) => ({
      ...gradientSlots[index],
      hex: colour.hex,
      weight: colour.weight,
    })),
    [photograph.palette],
  );
  const similarPhotographs = useMemo(
    () => hasPalette
      ? findSimilarPhotographs(photograph, photographs, selectedPaletteIndex)
      : photographs.filter((item) => item.id !== photograph.id),
    [hasPalette, photograph, photographs, selectedPaletteIndex],
  );
  const imageAlt = photograph.altText?.trim() || photograph.title?.trim() || "Photograph by Arnaud Belec";

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || visibleCount >= similarPhotographs.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, similarPhotographs.length));
      }
    }, { rootMargin: "600px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [similarPhotographs.length, visibleCount]);

  return (
    <main
      className="min-h-svh overflow-clip"
      style={{
        backgroundColor: photograph.backgroundHex ?? "#ffffff",
        color: foregroundForBackground(photograph.backgroundHex),
      }}
    >

      <section
        ref={stageRef}
        className="relative isolate grid h-svh w-full place-items-center"
        aria-label="Photograph and its palette gradients"
      >
        <PaletteScene
          backgroundColour={photograph.backgroundHex ?? "#ffffff"}
          colours={gradients}
          selectedId={selectedPaletteIndex?.toString() ?? null}
          stageRef={stageRef}
          photoRef={photoRef}
          onSelect={(_id, index) => {
            playColourChord(index);
            setSelectedPaletteIndex(current => current === index ? null : index);
            setVisibleCount(PAGE_SIZE);
          }}
        />

        <figure
          className="relative z-2 w-[min(calc(100vw_-_32px),var(--photo-max-width))] sm:w-[min(66.6667vw,var(--photo-max-width))]"
          style={{
            aspectRatio: photograph.width / photograph.height,
            "--photo-max-width": `${80 * photograph.width / photograph.height}vh`,
          } as CSSProperties}
        >
          <button
            ref={photoRef}
            type="button"
            disabled={selectedPaletteIndex === null}
            onClick={() => {
              setSelectedPaletteIndex(null);
              setVisibleCount(PAGE_SIZE);
            }}
            className="block h-full w-full cursor-pointer border-0 bg-white p-0 focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-current disabled:cursor-default"
            aria-label="Show photographs matching the full palette"
          >
            <Image
              key={photograph.id}
              src={photograph.src}
              alt={imageAlt}
              width={photograph.width}
              height={photograph.height}
              placeholder={imagePlaceholder(photograph.backgroundHex)}
              priority
              loading="eager"
              sizes="(max-width: 639px) calc(100vw - 32px), 66.667vw"
              className="block h-full w-full object-contain"
            />
          </button>
        </figure>
      </section>

      <div className="relative z-3 px-4 sm:px-[calc(100vw/6)]">
        <Link href="/photos" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">All photographs</Link>
        <section className="pt-4 pb-12" aria-label="Similar photographs">
          <h1 className="sr-only">{photograph.title?.trim() || photograph.filename}</h1>
          <h2 className="sr-only">Similar photographs</h2>
          {similarPhotographs.length > 0 ? (
            <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-3">
              {similarPhotographs.slice(0, visibleCount).map((item) => (
                <figure key={item.id}>
                  <Link
                    href={`/photos/${encodeURIComponent(item.filename)}`}
                    className="block focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-current"
                    aria-label={`View photograph ${item.title?.trim() || item.filename}`}
                  >
                    <Image
                      src={item.src}
                      alt={item.altText?.trim() || item.title?.trim() || "Photograph by Arnaud Belec"}
                      width={item.width}
                      height={item.height}
                      placeholder={imagePlaceholder(item.backgroundHex)}
                      sizes="(max-width: 640px) 50vw, 22vw"
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  </Link>
                </figure>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm opacity-70">No similar photographs yet.</p>
          )}
          {visibleCount < similarPhotographs.length && (
            <>
              <div ref={loadMoreRef} className="h-px" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="mx-auto mt-6 block cursor-pointer border-b border-current px-2 py-1 text-sm focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                Load more photographs
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
