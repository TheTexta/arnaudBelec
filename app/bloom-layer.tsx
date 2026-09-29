"use client";

import { useAnimationFrame } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { gradientDiameterVw, type GradientOrbColour } from "./gradient-orb";
import type { createBloomRenderer } from "./bloom-renderer";

export type OrbPositions = Record<string, { x: number; y: number }>;

export function BloomLayer({
  colours,
  positionsRef,
  selectedId,
  hoveredId,
  backgroundColour,
}: {
  colours: GradientOrbColour[];
  positionsRef: RefObject<OrbPositions>;
  selectedId: string | null;
  hoveredId: string | null;
  backgroundColour: string;
}) {
  const glowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const layerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createBloomRenderer> | null>(null);
  const reducedMotionRef = useRef(false);
  const [stack, setStack] = useState<{ selectedId: string | null; ids: string[] }>({ selectedId: null, ids: [] });

  // Retain selection history: move an existing entry to the top without duplicates.
  // Updating on a prop change keeps the shader and fallback in sync before paint.
  if (selectedId !== stack.selectedId) {
    setStack({
      selectedId,
      ids: selectedId === null ? stack.ids : [...stack.ids.filter((id) => id !== selectedId), selectedId],
    });
  }

  const stackedColours = useMemo(() => {
    const byId = new Map(colours.map((colour) => [colour.id, colour]));
    // Untouched colours stay below the stack; omit entries removed from the palette.
    return [
      ...colours.filter((colour) => !stack.ids.includes(colour.id)),
      ...stack.ids.flatMap((id) => {
        const colour = byId.get(id);
        return colour ? [colour] : [];
      }),
    ];
  }, [colours, stack.ids]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => { reducedMotionRef.current = preference.matches; };
    updatePreference();
    preference.addEventListener("change", updatePreference);

    // Keep CSS visible while the separate Three.js chunk loads, or if WebGL fails.
    void import("./bloom-renderer").then(({ createBloomRenderer }) => {
      if (!cancelled) rendererRef.current = createBloomRenderer(canvas);
    }).catch(() => { /* The CSS fallback remains interactive through the HTML orbs. */ });

    return () => {
      cancelled = true;
      preference.removeEventListener("change", updatePreference);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useAnimationFrame((time, delta) => {
    if (document.hidden) return;
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!layer || !canvas || !fallback) return;

    const stage = layer.getBoundingClientRect();
    let rendered = false;
    try {
      rendered = rendererRef.current?.render({
        colours: stackedColours,
        positions: positionsRef.current,
        selectedId,
        hoveredId,
        backgroundColour,
        stageLeft: stage.left,
        stageTop: stage.top,
        time,
        delta,
        reducedMotion: reducedMotionRef.current,
      }) ?? false;
    } catch {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    }
    const mode = rendered ? "webgl" : "css";
    if (layer.dataset.renderer !== mode) {
      layer.dataset.renderer = mode;
      if (layer.parentElement) layer.parentElement.dataset.orbRenderer = mode;
      canvas.style.visibility = rendered ? "visible" : "hidden";
      fallback.style.display = rendered ? "none" : "block";
    }
    if (rendered) return;

    for (const colour of colours) {
      const glow = glowRefs.current[colour.id];
      const position = positionsRef.current[colour.id];
      if (!glow || !position) continue;
      glow.style.opacity = "0.8";
      glow.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`;
    }
  });

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <canvas ref={canvasRef} className="invisible fixed inset-0 h-full w-full" />
      <div ref={fallbackRef} className="absolute inset-0">
        {stackedColours.map((colour) => (
          <div
            key={colour.id}
            ref={(element) => { glowRefs.current[colour.id] = element; }}
            className="absolute top-0 left-0 aspect-square opacity-0"
            style={{ width: `${gradientDiameterVw(colour.weight, colours.length)}vw`, "--orb-colour": colour.hex } as CSSProperties}
          >
            <span className={`orb-glow absolute inset-0 rounded-full blur-[clamp(20px,3vw,70px)] transition-transform duration-[450ms] motion-reduce:transition-none ${selectedId === colour.id ? "scale-[2]" : "scale-100"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
