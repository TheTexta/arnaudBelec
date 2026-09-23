"use client";

import Image from "next/image";
import Link from "next/link";
import { useAnimationFrame } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { findSimilarPhotographs } from "@/lib/photographs/similar-colours";
import { foregroundForBackground } from "@/lib/photographs/page-colours";
import type { PaletteColour, PublicPhotograph } from "@/lib/supabase-public";
import { GradientOrb, type MeasuredBounds } from "./gradient-orb";

const colours = [
  { id: "slate", name: "palette colour 1", hex: "#7995ae", vx: 7.5, vy: 4.5 },
  { id: "rose", name: "palette colour 2", hex: "#dcabb8", vx: -7, vy: 5.5 },
  { id: "indigo", name: "palette colour 3", hex: "#293b70", vx: 6, vy: -7.5 },
  { id: "lilac", name: "palette colour 4", hex: "#a59dbe", vx: -8, vy: -5 },
  { id: "pearl", name: "palette colour 5", hex: "#f0dce3", vx: -6.5, vy: -7 },
  { id: "mint", name: "palette colour 6", hex: "#8ec5b4", vx: 6.5, vy: 5 },
  { id: "amber", name: "palette colour 7", hex: "#d9b47d", vx: -7.5, vy: 6 },
] as const;

type ColourId = (typeof colours)[number]["id"];
type ColourSlot = Omit<(typeof colours)[number], "hex"> & { hex: string };
type GradientColour = ColourSlot & { lab: readonly [number, number, number]; weight: number };

type GalleryPhotograph = PublicPhotograph & {
  figureStyle?: CSSProperties;
  imageClassName?: string;
  imageStyle?: CSSProperties;
};

function hexToLab(hex: string): readonly [number, number, number] {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const x = (channels[0] * 0.4124 + channels[1] * 0.3576 + channels[2] * 0.1805) / 0.95047;
  const y = (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722);
  const z = (channels[0] * 0.0193 + channels[1] * 0.1192 + channels[2] * 0.9505) / 1.08883;
  const pivot = (value: number) => value > 216 / 24389
    ? Math.cbrt(value)
    : ((24389 / 27) * value + 16) / 116;
  const pivotX = pivot(x);
  const pivotY = pivot(y);
  const pivotZ = pivot(z);
  return [116 * pivotY - 16, 500 * (pivotX - pivotY), 200 * (pivotY - pivotZ)];
}

const defaultGradientColours: GradientColour[] = colours.map((colour) => ({
  ...colour,
  lab: hexToLab(colour.hex),
  weight: 1 / colours.length,
}));

const galleryItems = [
  ["slate", 0.95, "25% 51%", "grayscale(1) contrast(1.1)"],
  ["indigo", 1.28, "69% 51%", "hue-rotate(80deg) saturate(.8)"],
  ["pearl", 0.8, "77% 55%", "hue-rotate(240deg) saturate(.55) brightness(1.2)"],
  ["lilac", 1.34, "34% 48%", "hue-rotate(35deg) saturate(.6)"],
  ["rose", 0.84, "42% 61%", "hue-rotate(305deg) saturate(1.25)"],
  ["slate", 1.07, "58% 44%", "grayscale(.75) brightness(.9)"],
  ["pearl", 1.43, "83% 42%", "hue-rotate(260deg) saturate(.55) brightness(1.1)"],
  ["indigo", 0.75, "63% 58%", "hue-rotate(85deg) saturate(.95) brightness(.8)"],
  ["rose", 1.18, "31% 58%", "hue-rotate(310deg) saturate(1.1)"],
  ["lilac", 0.91, "48% 44%", "hue-rotate(25deg) saturate(.85)"],
  ["slate", 0.79, "21% 60%", "grayscale(.55) contrast(1.18)"],
  ["indigo", 1.38, "73% 63%", "hue-rotate(95deg) saturate(.85)"],
  ["rose", 0.86, "32% 45%", "hue-rotate(300deg) saturate(1.3) brightness(1.08)"],
  ["pearl", 1.2, "78% 48%", "hue-rotate(250deg) saturate(.45) brightness(1.2)"],
  ["lilac", 0.73, "43% 57%", "hue-rotate(45deg) saturate(.72)"],
  ["mint", 1.12, "47% 52%", "hue-rotate(145deg) saturate(.8)"],
  ["amber", 0.94, "57% 48%", "sepia(.75) saturate(1.2)"],
  ["mint", 0.86, "35% 56%", "hue-rotate(160deg) saturate(.7)"],
  ["amber", 1.23, "69% 51%", "sepia(.6) saturate(1.3)"],
  ["mint", 1.37, "28% 49%", "hue-rotate(130deg) saturate(.9)"],
  ["amber", 0.78, "74% 61%", "sepia(.8) saturate(1.1)"],
] as const satisfies readonly (readonly [ColourId, number, string, string])[];

function testColour(hex: string): PaletteColour {
  const [labL, labA, labB] = hexToLab(hex);
  return { hex, labL, labA, labB, weight: 1 };
}

const testPaletteByColour = {
  slate: { hex: "#0c0907", labL: 2.6094, labA: 0.5361, labB: 1.0431, weight: 1 },
  rose: { hex: "#ce6140", labL: 54.0709, labA: 40.8578, labB: 38.8667, weight: 1 },
  indigo: { hex: "#35130b", labL: 10.8982, labA: 16.3768, labB: 12.1471, weight: 1 },
  lilac: { hex: "#7e2c1a", labL: 30.1853, labA: 34.514, labB: 29.7925, weight: 1 },
  pearl: { hex: "#e1d0d0", labL: 84.8295, labA: 5.8887, labB: 2.118, weight: 1 },
  mint: testColour("#8ec5b4"),
  amber: testColour("#d9b47d"),
} satisfies Record<ColourId, PaletteColour>;

const testPhotographs: GalleryPhotograph[] = galleryItems.map(([colour, ratio, position, filter], index) => {
  const paletteColour = testPaletteByColour[colour];

  return {
    id: `test-${colour}-${index}`,
    src: "/test-image.jpg",
    filename: "test-image.jpg",
    width: 1680,
    height: 1348,
    title: null,
    altText: "Temporary test image of purple and slate radial gradients",
    backgroundHex: null,
    palette: [paletteColour],
    hasPaletteAnalysis: true,
    figureStyle: { aspectRatio: ratio },
    imageClassName: "block size-full scale-[1.7] object-cover",
    imageStyle: { objectPosition: position, filter },
  };
});

function closestColourAt(
  stage: HTMLElement,
  photo: HTMLElement | null,
  pointerX: number,
  pointerY: number,
): ColourId | null {
  if (photo) {
    const rect = photo.getBoundingClientRect();
    if (pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom) {
      return null;
    }
  }

  let closest: ColourId | null = null;
  let closestDistance = Infinity;

  for (const button of stage.querySelectorAll<HTMLButtonElement>("[data-colour-orb]")) {
    const rect = button.getBoundingClientRect();
    const dx = pointerX - (rect.left + rect.width / 2);
    const dy = pointerY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const colourId = button.dataset.colourOrb as ColourId | undefined;

    if (colourId && distance <= rect.width / 2 && distance < closestDistance) {
      closest = colourId;
      closestDistance = distance;
    }
  }

  return closest;
}

export default function PhotoPage({ photographs }: { photographs: PublicPhotograph[] }) {
  const [selectedColour, setSelectedColour] = useState<ColourId | null>(null);
  const [hoveredColour, setHoveredColour] = useState<ColourId | null>(null);
  const [displayedColour, setDisplayedColour] = useState<ColourId | null>(null);
  const [isFading, setIsFading] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLElement | null>(null);
  const boundsRef = useRef<MeasuredBounds | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredRef = useRef<ColourId | null>(null);

  const updateHoveredColour = useCallback(() => {
    const stage = stageRef.current;
    const pointer = pointerRef.current;
    const nearest = stage && pointer
      ? closestColourAt(stage, photoRef.current, pointer.x, pointer.y)
      : null;

    if (nearest !== hoveredRef.current) {
      hoveredRef.current = nearest;
      setHoveredColour(nearest);
    }
  }, []);

  useAnimationFrame(updateHoveredColour);

  const trackPointer = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    updateHoveredColour();
  };

  const clearPointer = () => {
    pointerRef.current = null;
    updateHoveredColour();
  };

  const selectAtPointer = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !stageRef.current) return;
    const nearest = closestColourAt(stageRef.current, photoRef.current, event.clientX, event.clientY);
    if (nearest) setSelectedColour((current) => current === nearest ? null : nearest);
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
    if (selectedColour === displayedColour) return;

    const fadeStart = window.setTimeout(() => setIsFading(true), 0);
    const swap = window.setTimeout(() => {
      setDisplayedColour(selectedColour);
      setIsFading(false);
    }, 120);

    return () => {
      window.clearTimeout(fadeStart);
      window.clearTimeout(swap);
    };
  }, [selectedColour, displayedColour]);

  const sourcePhotographs: GalleryPhotograph[] = photographs.length > 0
    ? photographs
    : testPhotographs;
  const heroPhotograph = sourcePhotographs[0];
  const pageBackground = heroPhotograph?.backgroundHex ?? "#ffffff";
  const gradientColours = useMemo<GradientColour[]>(() => {
    const palette = heroPhotograph?.palette.slice(0, colours.length) ?? [];

    return colours.map((slot, index) => {
      const paletteColour = palette[index];
      if (!paletteColour) return defaultGradientColours[index];

      return {
        ...slot,
        hex: paletteColour.hex,
        lab: [paletteColour.labL, paletteColour.labA, paletteColour.labB],
        weight: paletteColour.weight,
      };
    });
  }, [heroPhotograph]);

  const hasSupabasePhotographs = photographs.length > 0;
  const heroHref = hasSupabasePhotographs && heroPhotograph
    ? `/photos/${encodeURIComponent(heroPhotograph.filename)}`
    : null;
  const hasAnalysedPhotographs = sourcePhotographs.some((photograph) => photograph.hasPaletteAnalysis);
  const shownPhotographs = useMemo(() => {
    if (!displayedColour || !heroPhotograph) return sourcePhotographs;

    const paletteIndex = colours.findIndex((colour) => colour.id === displayedColour);
    if (paletteIndex < 0) return sourcePhotographs;

    const hasCompletePalette = heroPhotograph.palette.length >= colours.length;
    const selectedGradient = gradientColours[paletteIndex];
    const source = hasCompletePalette ? heroPhotograph : {
      ...heroPhotograph,
      palette: [{
        hex: selectedGradient.hex,
        labL: selectedGradient.lab[0],
        labA: selectedGradient.lab[1],
        labB: selectedGradient.lab[2],
        weight: 1,
      }],
    };

    return findSimilarPhotographs(
      source,
      sourcePhotographs,
      hasCompletePalette ? paletteIndex : 0,
      { includeCurrent: true },
    );
  }, [displayedColour, gradientColours, heroPhotograph, sourcePhotographs]);
  const selectedName = colours.find((colour) => colour.id === selectedColour)?.name;
  const heroAspectRatio = heroPhotograph ? heroPhotograph.width / heroPhotograph.height : 1680 / 1348;
  const heroStyle = {
    aspectRatio: heroAspectRatio,
    "--photo-max-width": `${80 * heroAspectRatio}vh`,
  } as CSSProperties;
  const heroImage = heroPhotograph ? (
    <Image
      key={heroPhotograph.id}
      src={heroPhotograph.src}
      alt={heroPhotograph.altText?.trim() || heroPhotograph.title?.trim() || "Photograph by Arnaud Belec"}
      width={heroPhotograph.width}
      height={heroPhotograph.height}
      priority
      loading="eager"
      sizes="(max-width: 639px) calc(100vw - 32px), 66.667vw"
      className="block h-auto w-full object-contain"
    />
  ) : (
    <Image
      src="/test-image.jpg"
      alt="Temporary test image of purple and slate radial gradients"
      width={1680}
      height={1348}
      priority
      loading="eager"
      sizes="(max-width: 639px) calc(100vw - 32px), 66.667vw"
      className="block h-auto w-full object-contain"
    />
  );
  const setPhotoRef = useCallback((element: HTMLElement | null) => { photoRef.current = element; }, []);
  const heroClassName = "relative z-2 block w-[min(calc(100vw_-_32px),var(--photo-max-width))] cursor-pointer border-0 bg-white p-0 focus-visible:outline-[3px] focus-visible:outline-offset-[6px] focus-visible:outline-current sm:w-[min(66.6667vw,var(--photo-max-width))]";

  return (
    <main
      className="min-h-svh w-full overflow-clip"
      style={{ backgroundColor: pageBackground, color: foregroundForBackground(pageBackground) }}
    >
      <h1 className="sr-only">Arnaud Belec photographs</h1>

      <section
        ref={stageRef}
        className="relative isolate grid h-screen w-screen place-items-center overflow-hidden"
        aria-label="Select a colour to explore photographs"
        onPointerEnter={trackPointer}
        onPointerMove={trackPointer}
        onPointerLeave={clearPointer}
        onPointerDown={selectAtPointer}
      >
        {gradientColours.map((colour) => (
          <GradientOrb
            key={colour.id}
            colour={colour}
            paletteSize={gradientColours.length}
            isSelected={selectedColour === colour.id}
            isHovered={hoveredColour === colour.id}
            boundsRef={boundsRef}
            onKeyboardSelect={() => setSelectedColour((current) => current === colour.id ? null : colour.id)}
          />
        ))}

        {heroHref ? (
          <Link
            ref={setPhotoRef}
            href={heroHref}
            className={heroClassName}
            style={heroStyle}
            aria-label={`View photograph ${heroPhotograph?.title?.trim() || heroPhotograph?.filename}`}
          >
            {heroImage}
          </Link>
        ) : (
          <button
            ref={setPhotoRef}
            className={heroClassName}
            style={heroStyle}
            type="button"
            onClick={() => setSelectedColour(null)}
            aria-label="Show all photographs"
          >
            {heroImage}
          </button>
        )}
      </section>

      <section className="flex flex-col justify-center items-center w-full min-w-[320px]" aria-label="Photograph gallery">
        <p className="sr-only" aria-live="polite">
          {hasSupabasePhotographs
            ? selectedName
              ? `Showing ${shownPhotographs.length} ${selectedName} photographs.`
              : `Showing all ${shownPhotographs.length} photographs.`
            : selectedName
              ? `Showing ${shownPhotographs.length} ${selectedName} analysed test image variations.`
              : `Showing all ${shownPhotographs.length} analysed test image variations.`}
        </p>
        <div className={`columns-3 gap-x-[clamp(8px,0.65vw,16px)] transition-opacity motion-reduce:transition-none max-[900px]:columns-2 max-[900px]:gap-x-2 ${isFading ? "opacity-0 duration-100" : "opacity-100 duration-300"}`}>
          {shownPhotographs.map((photograph) => {
            const image = (
              <Image
                src={photograph.src}
                alt={hasSupabasePhotographs ? photograph.altText?.trim() || photograph.title?.trim() || "Photograph by Arnaud Belec" : ""}
                width={photograph.width}
                height={photograph.height}
                sizes="(max-width: 900px) 50vw, 22vw"
                loading="lazy"
                className={photograph.imageClassName ?? "block h-auto w-full"}
                style={photograph.imageStyle}
              />
            );

            return (
              <figure
                className="mb-[clamp(8px,0.65vw,16px)] block w-full break-inside-avoid overflow-hidden bg-[#b6b4be] max-[900px]:mb-2"
                key={photograph.id}
                style={photograph.figureStyle}
              >
                {hasSupabasePhotographs ? (
                  <Link
                    href={`/photos/${encodeURIComponent(photograph.filename)}`}
                    className="block focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-current"
                    aria-label={`View photograph ${photograph.title?.trim() || photograph.filename}`}
                  >
                    {image}
                  </Link>
                ) : image}
              </figure>
            );
          })}
        </div>
        {hasSupabasePhotographs && displayedColour && shownPhotographs.length === 0 && (
          <p className="px-6 py-16 text-center text-sm opacity-70">
            {hasAnalysedPhotographs
              ? "No photographs match this colour yet."
              : "No analysed palettes match this colour yet. Import photographs with palette analysis to enable colour filtering."}
          </p>
        )}
      </section>
    </main>
  );
}
