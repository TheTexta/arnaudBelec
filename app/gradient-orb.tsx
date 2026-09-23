"use client";

import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { advanceParticle, containParticle, randomParticlePosition, type CollisionBounds, type Particle } from "./gradient-physics";

export type GradientOrbColour = {
  id: string;
  name: string;
  hex: string;
  weight: number;
  vx: number;
  vy: number;
};

export type MeasuredBounds = CollisionBounds & { version: number };

function gradientDiameterVw(weight: number, paletteSize: number): number {
  const equalShare = 1 / paletteSize;
  const difference = Math.max(0, Math.min(1, weight)) - equalShare;
  const scaledDifference = difference < 0
    ? difference / equalShare
    : difference / (1 - equalShare);

  return 100 + scaledDifference * 25;
}

export function GradientOrb({
  colour,
  paletteSize,
  isSelected,
  isHovered,
  boundsRef,
  onKeyboardSelect,
}: {
  colour: GradientOrbColour;
  paletteSize: number;
  isSelected: boolean;
  isHovered: boolean;
  boundsRef: { current: MeasuredBounds | null };
  onKeyboardSelect: () => void;
}) {
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const spawnOpacity = useMotionValue(0);
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
        const start = randomParticlePosition(bounds);
        particle.x = start.x;
        particle.y = start.y;
      }
      containParticle(particle, bounds);
      previousBoundsRef.current = bounds;
    }

    if (!reducedMotionRef.current) advanceParticle(particle, bounds, delta);
    offsetX.set(particle.x);
    offsetY.set(particle.y);
    spawnOpacity.set(1);
  }, [boundsRef, offsetX, offsetY, spawnOpacity]);

  useAnimationFrame(updatePosition);

  return (
    <motion.div
      className="pointer-events-none absolute top-0 left-0 z-1"
      style={{ x: offsetX, y: offsetY, opacity: spawnOpacity }}
    >
      <button
        className="group pointer-events-auto grid aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[width] duration-[700ms] focus-visible:outline-none motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]"
        style={{ width: `${gradientDiameterVw(colour.weight, paletteSize)}vw` }}
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
