"use client";

import Image from "next/image";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { PaletteColour, PublicPhotograph } from "@/lib/supabase-public";
import { advanceParticle, containParticle, type CollisionBounds, type Particle } from "./gradient-physics";

const colours = [
  { id: "slate", name: "Slate blue", hex: "#7995ae", x: 0.06, y: 0.2, vx: 7.5, vy: 4.5 },
  { id: "rose", name: "Dusty rose", hex: "#dcabb8", x: 0.88, y: 0.13, vx: -7, vy: 5.5 },
  { id: "indigo", name: "Indigo", hex: "#293b70", x: 0.06, y: 0.79, vx: 6, vy: -7.5 },
  { id: "lilac", name: "Lilac", hex: "#a59dbe", x: 0.49, y: 0.96, vx: -8, vy: -5 },
  { id: "pearl", name: "Pearl pink", hex: "#f0dce3", x: 0.98, y: 0.83, vx: -6.5, vy: -7 },
] as const;

type ColourId = (typeof colours)[number]["id"];
type ColourSlot = Omit<(typeof colours)[number], "hex"> & { hex: string };
type GradientColour = ColourSlot & { lab: readonly [number, number, number]; weight: number };

type ClassifiedPhotograph = PublicPhotograph & {
  colour: ColourId | null;
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

function gradientDiameterVw(weight: number): number {
  const equalShare = 1 / colours.length;
  const difference = Math.max(0, Math.min(1, weight)) - equalShare;
  const scaledDifference = difference < 0
    ? difference / equalShare
    : difference / (1 - equalShare);

  return 100 + scaledDifference * 25;
}

function nearestGradient(palette: PaletteColour[], gradients: GradientColour[]): ColourId | null {
  const visibleColours = palette.filter((colour) => colour.weight > 0);
  if (visibleColours.length === 0) return null;

  let closest: ColourId = gradients[0].id;
  let closestDistance = Infinity;

  for (const gradient of gradients) {
    // A palette colour's share weights its CIE Lab distance to the gradient.
    const distance = visibleColours.reduce((sum, colour) => {
      const [lightness, greenRed, blueYellow] = gradient.lab;
      return sum + colour.weight * Math.hypot(
        colour.labL - lightness,
        colour.labA - greenRed,
        colour.labB - blueYellow,
      );
    }, 0);
    if (distance < closestDistance) {
      closest = gradient.id;
      closestDistance = distance;
    }
  }

  return closest;
}

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
] as const satisfies readonly (readonly [ColourId, number, string, string])[];

const testPaletteByColour = {
  slate: { hex: "#0c0907", labL: 2.6094, labA: 0.5361, labB: 1.0431, weight: 1 },
  rose: { hex: "#ce6140", labL: 54.0709, labA: 40.8578, labB: 38.8667, weight: 1 },
  indigo: { hex: "#35130b", labL: 10.8982, labA: 16.3768, labB: 12.1471, weight: 1 },
  lilac: { hex: "#7e2c1a", labL: 30.1853, labA: 34.514, labB: 29.7925, weight: 1 },
  pearl: { hex: "#e1d0d0", labL: 84.8295, labA: 5.8887, labB: 2.118, weight: 1 },
} satisfies Record<ColourId, PaletteColour>;

const testPhotographs: ClassifiedPhotograph[] = galleryItems.map(([colour, ratio, position, filter], index) => {
  const paletteColour = testPaletteByColour[colour];

  return {
    id: `test-${colour}-${index}`,
    src: "/test-image.jpg",
    filename: "test-image.jpg",
    width: 1680,
    height: 1348,
    title: null,
    altText: "Temporary test image of purple and slate radial gradients",
    palette: [paletteColour],
    hasPaletteAnalysis: true,
    colour,
    figureStyle: { aspectRatio: ratio },
    imageClassName: "block size-full scale-[1.7] object-cover",
    imageStyle: { objectPosition: position, filter },
  };
});

type MeasuredBounds = CollisionBounds & { version: number };

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

function GradientOrb({
  colour,
  isSelected,
  isHovered,
  boundsRef,
  onKeyboardSelect,
}: {
  colour: GradientColour;
  isSelected: boolean;
  isHovered: boolean;
  boundsRef: { current: MeasuredBounds | null };
  onKeyboardSelect: () => void;
}) {
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const particleRef = useRef<Particle>({ x: 0, y: 0, vx: colour.vx, vy: colour.vy });
  const previousBoundsRef = useRef<MeasuredBounds | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => { reducedMotionRef.current = preference.matches; };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  const updatePosition = useCallback((_: number, delta: number) => {
    const bounds = boundsRef.current;
    if (!bounds) return;

    const particle = particleRef.current;
    const previousBounds = previousBoundsRef.current;
    if (previousBounds?.version !== bounds.version) {
      if (previousBounds) {
        particle.x *= bounds.width / previousBounds.width;
        particle.y *= bounds.height / previousBounds.height;
      } else {
        particle.x = colour.x * bounds.width;
        particle.y = colour.y * bounds.height;
      }
      containParticle(particle, bounds);
      previousBoundsRef.current = bounds;
    }

    if (!reducedMotionRef.current) advanceParticle(particle, bounds, delta);
    offsetX.set(particle.x - colour.x * bounds.width);
    offsetY.set(particle.y - colour.y * bounds.height);
  }, [boundsRef, colour, offsetX, offsetY]);

  useAnimationFrame(updatePosition);

  return (
    <motion.div
      className="pointer-events-none absolute z-1"
      style={{ left: `${colour.x * 100}%`, top: `${colour.y * 100}%`, x: offsetX, y: offsetY }}
    >
      <button
        className="group pointer-events-auto grid aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[width] duration-[700ms] focus-visible:outline-none motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]"
        style={{ width: `${gradientDiameterVw(colour.weight)}vw` }}
        type="button"
        data-colour-orb={colour.id}
        data-hovered={isHovered}
        aria-label={`Show ${colour.name} photographs`}
        aria-pressed={isSelected}
        onClick={(event) => {
          if (event.detail === 0) onKeyboardSelect();
        }}
      >
        <span
          aria-hidden="true"
          className={`orb-glow pointer-events-none absolute inset-0 rounded-full opacity-70 blur-[clamp(18px,3vw,65px)] transition-[scale] duration-[450ms] motion-reduce:transition-none ${isSelected ? "scale-[2]" : "scale-100"}`}
          style={{ "--orb-colour": colour.hex } as CSSProperties}
        />
        <span
          aria-hidden="true"
          className={[
            "relative size-5 rounded-full border border-white/95 bg-white/15 shadow-[0_1px_12px_rgba(29,35,55,0.15)] transition-[opacity,scale] duration-[250ms] group-focus-visible:shadow-[0_0_0_3px_#fff,0_1px_12px_rgba(29,35,55,0.15)] motion-reduce:transition-none",
            isSelected || isHovered
              ? "scale-100 opacity-100"
              : "scale-[.65] opacity-35 group-focus-visible:scale-100 group-focus-visible:opacity-100",
          ].join(" ")}
        />
      </button>
    </motion.div>
  );
}

export default function PhotoPage({ photographs }: { photographs: PublicPhotograph[] }) {
  const [selectedColour, setSelectedColour] = useState<ColourId | null>(null);
  const [hoveredColour, setHoveredColour] = useState<ColourId | null>(null);
  const [displayedColour, setDisplayedColour] = useState<ColourId | null>(null);
  const [isFading, setIsFading] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLButtonElement>(null);
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

  const sourcePhotographs: (PublicPhotograph | ClassifiedPhotograph)[] = photographs.length > 0
    ? photographs
    : testPhotographs;
  const heroPhotograph = sourcePhotographs[0];
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

  const classifiedPhotographs = useMemo<ClassifiedPhotograph[]>(
    () => {
      if (photographs.length === 0) return testPhotographs;

      return photographs.map((photograph) => ({
        ...photograph,
        colour: nearestGradient(photograph.palette, gradientColours),
      }));
    },
    [gradientColours, photographs],
  );
  const hasSupabasePhotographs = photographs.length > 0;
  const hasAnalysedPhotographs = classifiedPhotographs.some((photograph) => photograph.hasPaletteAnalysis);
  const shownPhotographs = displayedColour
    ? classifiedPhotographs.filter((photograph) => photograph.colour === displayedColour)
    : classifiedPhotographs;
  const selectedName = colours.find((colour) => colour.id === selectedColour)?.name;

  return (
    <main className="w-full overflow-clip">
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
            isSelected={selectedColour === colour.id}
            isHovered={hoveredColour === colour.id}
            boundsRef={boundsRef}
            onKeyboardSelect={() => setSelectedColour((current) => current === colour.id ? null : colour.id)}
          />
        ))}

        <button
          ref={photoRef}
          className="relative z-2 block aspect-[3/2] w-[min(66.6667vw,calc(150vh_-_72px))] cursor-pointer overflow-hidden border-0 bg-[#121117] p-0 focus-visible:outline-[3px] focus-visible:outline-offset-[6px] focus-visible:outline-white max-[900px]:w-[min(calc(100vw_-_48px),calc(150vh_-_72px))]"
          type="button"
          onClick={() => setSelectedColour(null)}
          aria-label="Show all photographs"
          title="Show all photographs"
        >
          {heroPhotograph ? (
            <Image
              key={heroPhotograph.id}
              src={heroPhotograph.src}
              alt={heroPhotograph.altText?.trim() || heroPhotograph.title?.trim() || "Photograph by Arnaud Belec"}
              width={heroPhotograph.width}
              height={heroPhotograph.height}
              priority
              loading="eager"
              sizes="(max-width: 900px) calc(100vw - 48px), 66vw"
              className={"imageClassName" in heroPhotograph ? heroPhotograph.imageClassName : "block size-full object-cover"}
              style={"imageStyle" in heroPhotograph ? heroPhotograph.imageStyle : undefined}
            />
          ) : (
            <Image
              src="/test-image.jpg"
              alt="Temporary test image of purple and slate radial gradients"
              width={1680}
              height={1348}
              priority
              loading="eager"
              sizes="(max-width: 900px) calc(100vw - 48px), 66vw"
              className="block size-full scale-[1.58] object-cover object-[50%_53%]"
            />
          )}
        </button>
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
          {shownPhotographs.map((photograph) => (
            <figure
              className="mb-[clamp(8px,0.65vw,16px)] block w-full break-inside-avoid overflow-hidden bg-[#b6b4be] max-[900px]:mb-2"
              key={photograph.id}
              style={photograph.figureStyle}
            >
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
            </figure>
          ))}
        </div>
        {hasSupabasePhotographs && displayedColour && shownPhotographs.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-[#55515c]">
            {hasAnalysedPhotographs
              ? "No photographs match this colour yet."
              : "No analysed palettes match this colour yet. Import photographs with palette analysis to enable colour filtering."}
          </p>
        )}
      </section>
    </main>
  );
}
