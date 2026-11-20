"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { BloomLayer, type OrbPositions } from "./bloom-layer";
import { GradientOrb, type GradientOrbColour, type MeasuredBounds } from "./gradient-orb";

export function observePaletteBounds(stage: HTMLElement, photo: HTMLElement, bounds: RefObject<MeasuredBounds | null>) {
  const measure = () => {
    const stageRect = stage.getBoundingClientRect();
    const photoRect = photo.getBoundingClientRect();
    bounds.current = {
      version: (bounds.current?.version ?? 0) + 1,
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
}

/** Route-owned photo/layout and selection; scene-owned measurement and animation refs. */
export function PaletteScene({ colours, backgroundColour, selectedId, onSelect, stageRef, photoRef }: {
  colours: GradientOrbColour[];
  backgroundColour: string;
  selectedId: string | null;
  onSelect: (id: string, index: number) => void;
  stageRef: RefObject<HTMLElement | null>;
  photoRef: RefObject<HTMLElement | null>;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const boundsRef = useRef<MeasuredBounds | null>(null);
  const positionsRef = useRef<OrbPositions>({});
  const updatePosition = useCallback((id: string, x: number, y: number) => {
    positionsRef.current[id] = { x, y };
  }, []);
  useEffect(() => {
    const stage = stageRef.current;
    const photo = photoRef.current;
    if (!stage || !photo) return;
    return observePaletteBounds(stage, photo, boundsRef);
  }, [stageRef, photoRef]);

  return <>
    <BloomLayer backgroundColour={backgroundColour} colours={colours} positionsRef={positionsRef} selectedId={selectedId} hoveredId={hoveredId} />
    {colours.map((colour, index) => <GradientOrb
      key={colour.id}
      colour={colour}
      paletteSize={colours.length}
      isSelected={selectedId === colour.id}
      isHovered={hoveredId === colour.id}
      stageRef={stageRef}
      boundsRef={boundsRef}
      positionsRef={positionsRef}
      onPositionChange={updatePosition}
      onHoverChange={hovered => setHoveredId(current => hovered ? colour.id : current === colour.id ? null : current)}
      onSelect={() => onSelect(colour.id, index)}
    />)}
  </>;
}
