"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BloomLayer, type OrbPositions } from "./bloom-layer";
import { eligiblePhotographs, selectPresentationPhotographs, type PhotoGroups, type PhotoMode } from "@/lib/photographs/presentation";
import { foregroundForBackground } from "@/lib/photographs/page-colours";
import { imagePlaceholder } from "@/lib/photographs/image-placeholder";
import { playColourChord } from "@/lib/audio/colour-chords";
import type { PublicPhotograph } from "@/lib/supabase-public";
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
type GradientColour = ColourSlot & { weight: number };

type GalleryPhotograph = PublicPhotograph & {
  figureStyle?: CSSProperties;
  imageClassName?: string;
  imageStyle?: CSSProperties;
};

const photoModes = [
  { id: "all", label: "All" },
  { id: "colour", label: "Colour" },
  { id: "monochrome", label: "Black & white" },
] as const;

export default function PhotoPage({ photographs, photoGroups }: {
  photographs: PublicPhotograph[];
  photoGroups?: PhotoGroups;
}) {
  const [mode, setMode] = useState<PhotoMode>("all");
  const modeButtonsRef = useRef<Record<PhotoMode, HTMLButtonElement | null>>({ all: null, colour: null, monochrome: null });
  const changeMode = useCallback((nextMode: PhotoMode) => {
    setMode(nextMode);
    modeButtonsRef.current[nextMode]?.focus();
  }, []);
  const eligible = useMemo(() => eligiblePhotographs(photographs, mode, photoGroups), [photographs, mode, photoGroups]);
  const monochromePreview = useMemo(() => eligiblePhotographs(photographs, "monochrome", photoGroups)[0], [photographs, photoGroups]);

  const background = eligible[0]?.backgroundHex ?? "#ffffff";
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 z-4 flex justify-center px-4 py-3" style={{ color: foregroundForBackground(background) }}>
        <div role="group" aria-label="Photograph selection" className="flex flex-wrap justify-center" style={{ backgroundColor: background }}>
          {photoModes.map(({ id, label }) => (
            <button
              key={id}
              ref={(element) => { modeButtonsRef.current[id] = element; }}
              type="button"
              aria-pressed={mode === id}
              onClick={() => changeMode(id)}
              className={`min-h-11 cursor-pointer px-3 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${mode === id ? "underline" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <PhotoArchive key={mode} photographs={eligible} mode={mode} onModeChange={changeMode} monochromePreview={monochromePreview} />
    </div>
  );
}

function PhotoArchive({ photographs, mode, onModeChange, monochromePreview }: {
  photographs: PublicPhotograph[];
  mode: PhotoMode;
  onModeChange: (mode: PhotoMode) => void;
  monochromePreview?: PublicPhotograph;
}) {
  const [selectedColour, setSelectedColour] = useState<ColourId | null>(null);
  const [hoveredColour, setHoveredColour] = useState<ColourId | null>(null);
  const [displayedColour, setDisplayedColour] = useState<ColourId | null>(null);
  const [isFading, setIsFading] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLElement | null>(null);
  const boundsRef = useRef<MeasuredBounds | null>(null);
  const orbPositionsRef = useRef<OrbPositions>({});
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

  const sourcePhotographs: GalleryPhotograph[] = photographs;
  const heroPhotograph = sourcePhotographs[0];
  const pageBackground = heroPhotograph?.backgroundHex ?? "#ffffff";
  const gradientColours = useMemo<GradientColour[]>(() => {
    const palette = heroPhotograph?.palette.slice(0, colours.length) ?? [];

    return palette.map((paletteColour, index) => ({
      ...colours[index],
      hex: paletteColour.hex,
      weight: paletteColour.weight,
    }));
  }, [heroPhotograph]);

  const hasSupabasePhotographs = photographs.length > 0;
  const heroHref = hasSupabasePhotographs && heroPhotograph
    ? `/photos/${encodeURIComponent(heroPhotograph.filename)}`
    : null;
  const hasAnalysedPhotographs = sourcePhotographs.some((photograph) => photograph.hasPaletteAnalysis);
  const shownPhotographs = useMemo(() => {
    if (!displayedColour || !heroPhotograph) return sourcePhotographs;

    const paletteIndex = colours.findIndex((colour) => colour.id === displayedColour);
    if (paletteIndex < 0 || paletteIndex >= gradientColours.length) return sourcePhotographs;

    return selectPresentationPhotographs(
      sourcePhotographs,
      heroPhotograph,
      paletteIndex,
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
      placeholder={imagePlaceholder(heroPhotograph.backgroundHex)}
      priority
      loading="eager"
      sizes="(max-width: 639px) calc(100vw - 32px), 66.667vw"
      className="block h-auto w-full object-contain"
    />
  ) : null;
  const setPhotoRef = useCallback((element: HTMLElement | null) => { photoRef.current = element; }, []);
  const updateOrbPosition = useCallback((id: string, x: number, y: number) => {
    orbPositionsRef.current[id] = { x, y };
  }, []);
  const heroClassName = "relative z-2 block w-[min(calc(100vw_-_32px),var(--photo-max-width))] cursor-pointer border-0 bg-white p-0 focus-visible:outline-[3px] focus-visible:outline-offset-[6px] focus-visible:outline-current sm:w-[min(66.6667vw,var(--photo-max-width))]";

  return (
    <main
      className="relative min-h-svh w-full overflow-clip"
      style={{ backgroundColor: pageBackground, color: foregroundForBackground(pageBackground) }}
    >
      {heroPhotograph ? <h1 className="sr-only">Photographs</h1> : null}
      <section
        ref={stageRef}
        className="relative isolate grid h-screen w-screen place-items-center"
        aria-label="Select a colour to explore photographs"
      >
        {heroPhotograph ? <BloomLayer
          backgroundColour={pageBackground}
          colours={gradientColours}
          positionsRef={orbPositionsRef}
          selectedId={selectedColour}
          hoveredId={hoveredColour}
        /> : null}
        {heroPhotograph ? gradientColours.map((colour) => (
          <GradientOrb
            key={colour.id}
            colour={colour}
            paletteSize={gradientColours.length}
            isSelected={selectedColour === colour.id}
            isHovered={hoveredColour === colour.id}
            stageRef={stageRef}
            boundsRef={boundsRef}
            positionsRef={orbPositionsRef}
            onPositionChange={updateOrbPosition}
            onHoverChange={(hovered) => setHoveredColour((current) => hovered ? colour.id : current === colour.id ? null : current)}
            onSelect={() => {
              playColourChord(colours.findIndex((slot) => slot.id === colour.id));
              setSelectedColour((current) => current === colour.id ? null : colour.id);
            }}
          />
        )) : null}

        {heroPhotograph ? (
          heroHref ? (
            <Link
              ref={setPhotoRef}
              href={heroHref}
              className={heroClassName}
              style={heroStyle}
              aria-label={`View photograph ${heroPhotograph.title?.trim() || heroPhotograph.filename}`}
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
          )
        ) : (
          <div
            ref={setPhotoRef}
            className="relative z-2 max-w-md px-6 text-center"
          >
            <h1 className="text-xl">{mode === "all" ? "No photographs available yet." : `No ${mode === "colour" ? "colour" : "black & white"} photographs selected yet.`}</h1>
            {mode !== "all" ? (
              <>
                <p className="mt-3 text-sm">Explore the full archive while this selection takes shape.</p>
                <button type="button" onClick={() => onModeChange("all")} className="mt-4 min-h-11 cursor-pointer px-3 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">Show all photographs</button>
              </>
            ) : null}
          </div>
        )}
        {heroPhotograph && mode !== "monochrome" && monochromePreview && monochromePreview.id !== heroPhotograph.id ? (
          <button
            type="button"
            onClick={() => onModeChange("monochrome")}
            onPointerDown={(event) => event.stopPropagation()}
            className="group absolute bottom-4 right-4 z-3 flex min-h-11 cursor-pointer items-end gap-3 p-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ backgroundColor: pageBackground }}
          >
            <span className="pb-1 underline underline-offset-4">Explore black & white</span>
            <span className="block origin-bottom-right transition-transform duration-200 ease-out group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:hidden [@media(hover:none)]:hidden">
              <Image
                src={monochromePreview.src}
                alt=""
                width={monochromePreview.width}
                height={monochromePreview.height}
                placeholder={imagePlaceholder(monochromePreview.backgroundHex)}
                sizes="56px"
                className="block max-h-24 w-auto max-w-12 object-contain"
              />
            </span>
          </button>
        ) : null}
      </section>

      <section className="relative z-3 flex flex-col justify-center items-center w-full min-w-[320px] py-4" aria-label="Photograph gallery">
        <p className="sr-only" aria-live="polite">
          {selectedName
            ? `Showing ${shownPhotographs.length} ${selectedName} photographs.`
            : `Showing ${shownPhotographs.length} photographs in ${photoModes.find(({ id }) => id === mode)?.label}.`}
        </p>
        <div className={`columns-3 gap-x-[clamp(8px,0.65vw,16px)] transition-opacity motion-reduce:transition-none max-[900px]:columns-2 max-[900px]:gap-x-2 ${isFading ? "opacity-0 duration-100" : "opacity-100 duration-300"}`}>
          {shownPhotographs.map((photograph) => {
            const image = (
              <Image
                src={photograph.src}
                alt={hasSupabasePhotographs ? photograph.altText?.trim() || photograph.title?.trim() || "Photograph by Arnaud Belec" : ""}
                width={photograph.width}
                height={photograph.height}
                placeholder={imagePlaceholder(photograph.backgroundHex)}
                sizes="(max-width: 900px) 50vw, 22vw"
                loading={photograph.id === heroPhotograph?.id ? "eager" : "lazy"}
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
        {displayedColour && shownPhotographs.length === 0 && (
          <p className="px-6 py-16 text-center text-sm opacity-70">
            {hasAnalysedPhotographs
              ? "No photographs match this colour yet."
              : "No analysed palettes match this colour yet."}
          </p>
        )}
      </section>
      <footer className="relative z-3 px-6 py-8 text-center text-sm">
        <Link href="/blog" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Journal</Link>
      </footer>
    </main>
  );
}
