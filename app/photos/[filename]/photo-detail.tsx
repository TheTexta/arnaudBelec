"use client";

import Image from "next/image";
import Link from "next/link";
import { useAnimationFrame } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { GradientOrb, type GradientOrbColour, type MeasuredBounds } from "@/app/gradient-orb";
import { findSimilarPhotographs } from "@/lib/photographs/similar-colours";
import { foregroundForBackground } from "@/lib/photographs/page-colours";
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

function closestGradientAt(
  stage: HTMLElement,
  photo: HTMLElement | null,
  pointerX: number,
  pointerY: number,
): number | null {
  if (photo) {
    const rect = photo.getBoundingClientRect();
    if (pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom) {
      return null;
    }
  }

  let closest: number | null = null;
  let closestDistance = Infinity;

  for (const button of stage.querySelectorAll<HTMLButtonElement>("[data-colour-orb]")) {
    const rect = button.getBoundingClientRect();
    const distance = Math.hypot(pointerX - (rect.left + rect.width / 2), pointerY - (rect.top + rect.height / 2));
    const index = Number(button.dataset.colourOrb);
    if (Number.isInteger(index) && distance <= rect.width / 2 && distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
  }

  return closest;
}

export default function PhotoDetail({
  photograph,
  photographs,
}: {
  photograph: PublicPhotograph;
  photographs: PublicPhotograph[];
}) {
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number | null>(null);
  const [hoveredPaletteIndex, setHoveredPaletteIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const stageRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLButtonElement>(null);
  const boundsRef = useRef<MeasuredBounds | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasPalette = photograph.palette.length === gradientSlots.length;
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

  const updateHoveredGradient = useCallback(() => {
    const stage = stageRef.current;
    const pointer = pointerRef.current;
    const nearest = stage && pointer
      ? closestGradientAt(stage, photoRef.current, pointer.x, pointer.y)
      : null;

    if (nearest !== hoveredRef.current) {
      hoveredRef.current = nearest;
      setHoveredPaletteIndex(nearest);
    }
  }, []);

  useAnimationFrame(updateHoveredGradient);

  const trackPointer = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    updateHoveredGradient();
  };

  const clearPointer = () => {
    pointerRef.current = null;
    updateHoveredGradient();
  };

  const selectAtPointer = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !stageRef.current) return;
    const nearest = closestGradientAt(stageRef.current, photoRef.current, event.clientX, event.clientY);
    if (nearest !== null) {
      setSelectedPaletteIndex((current) => current === nearest ? null : nearest);
      setVisibleCount(PAGE_SIZE);
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    const photo = photoRef.current;
    if (!stage || !photo) return;

    const measure = () => {
      const stageRect = stage.getBoundingClientRect();
      const photoRect = photo.getBoundingClientRect();
      boundsRef.current = {
        version: (boundsRef.current?.version ?? 0) + 1,
        width: stageRect.width,
        height: stageRect.height,
        photo: {
          left: photoRect.left - stageRect.left,
          top: photoRect.top - stageRect.top,
          right: photoRect.right - stageRect.left,
          bottom: photoRect.bottom - stageRect.top,
        },
      };
    };

    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(photo);
    measure();
    return () => observer.disconnect();
  }, []);

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
      <Link
        href="/"
        className="fixed top-4 left-4 z-20 rounded-sm bg-white/90 px-2 py-1 text-sm font-medium text-black underline decoration-transparent underline-offset-4 backdrop-blur-sm transition-[text-decoration-color] hover:decoration-current focus-visible:decoration-current focus-visible:outline-none"
        aria-label="Arnaud Belec — back to all photographs"
      >
        Arnaud Belec
      </Link>

      <section
        ref={stageRef}
        className="relative isolate grid h-svh w-full place-items-center overflow-hidden"
        aria-label="Photograph and its palette gradients"
        onPointerEnter={trackPointer}
        onPointerMove={trackPointer}
        onPointerLeave={clearPointer}
        onPointerDown={selectAtPointer}
      >
        {gradients.map((colour, index) => (
          <GradientOrb
            key={colour.id}
            colour={colour}
            paletteSize={gradients.length}
            isSelected={selectedPaletteIndex === index}
            isHovered={hoveredPaletteIndex === index}
            boundsRef={boundsRef}
            onKeyboardSelect={() => {
              setSelectedPaletteIndex((current) => current === index ? null : index);
              setVisibleCount(PAGE_SIZE);
            }}
          />
        ))}

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
            aria-label="Show photographs matching all seven colours"
          >
            <Image
              src={photograph.src}
              alt={imageAlt}
              width={photograph.width}
              height={photograph.height}
              priority
              sizes="(max-width: 639px) calc(100vw - 32px), 66.667vw"
              className="block h-full w-full object-contain"
            />
          </button>
        </figure>
      </section>

      <div className="px-4 sm:px-[calc(100vw/6)]">
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
