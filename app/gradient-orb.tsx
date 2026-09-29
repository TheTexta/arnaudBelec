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

const ORB_PIXELS = 32;
export const ORB_GRAIN_FRAME_MS = 60;

function drawPixelOrb(canvas: HTMLCanvasElement, hex: string, frame: number, scale: number) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const image = context.createImageData(ORB_PIXELS, ORB_PIXELS);

  for (let y = 0; y < ORB_PIXELS; y++) {
    for (let x = 0; x < ORB_PIXELS; x++) {
      const distance = Math.hypot(x - 15.5, y - 15.5) / scale;
      if (distance > 7.5) continue;

      // Match the screen grain's hash, with each sample enlarged to a 4px square.
      const seed = Math.sin((x - 8) * 12.9898 + (y - 8) * 78.233 + frame * 37.719) * 43758.5453;
      const noise = seed - Math.floor(seed) - 0.5;
      const core = distance <= 3.6;
      const glow = Math.max(0, 1 - Math.max(0, distance - 3.4) / 4.1);
      const highlight = core ? Math.max(0, 1 - distance / 4) * 0.28 : 0;
      const grain = core ? noise * 0.45 : noise * 0.2;
      const light = core ? 0.13 + highlight : 0.08 + glow * 0.12;
      const index = (y * ORB_PIXELS + x) * 4;
      for (const [channel, value] of [red, green, blue].entries()) {
        image.data[index + channel] = Math.max(0, Math.min(255, value * (1 + grain) + (255 - value) * light));
      }
      image.data[index + 3] = core ? 255 : Math.round(185 * glow * (0.85 + noise * 0.3));
    }
  }

  context.putImageData(image, 0, 0);
}

export function gradientDiameterVw(weight: number, paletteSize: number): number {
  const equalShare = 1 / paletteSize;
  const difference = Math.max(0, Math.min(1, weight)) - equalShare;
  const scaledDifference = difference < 0
    ? difference / equalShare
    : difference / (1 - equalShare);

  return 100 + scaledDifference * 25;
}

function orbSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function orbPulseScale(id: string, weight: number, paletteSize: number, time: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;

  const diameter = gradientDiameterVw(weight, paletteSize);
  const frequency = 0.666 * 100 / diameter * (0.95 + orbSeed(`${id}:speed`) * 0.1);
  const amplitude = 0.05 + orbSeed(`${id}:size`) * 0.02;
  const phase = orbSeed(`${id}:phase`) * Math.PI * 2;
  return 1 + Math.sin(time / 1000 * Math.PI * 2 * frequency + phase) * amplitude;
}

export function GradientOrb({
  colour,
  paletteSize,
  isSelected,
  isHovered,
  boundsRef,
  positionsRef,
  onKeyboardSelect,
  onPositionChange,
}: {
  colour: GradientOrbColour;
  paletteSize: number;
  isSelected: boolean;
  isHovered: boolean;
  boundsRef: { current: MeasuredBounds | null };
  positionsRef: { current: Record<string, { x: number; y: number }> };
  onKeyboardSelect: () => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
}) {
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const spawnOpacity = useMotionValue(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastGrainRef = useRef<{ hex: string; frame: number; scale: number } | null>(null);
  const selectionScaleRef = useRef(1);
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

  const updatePosition = useCallback((time: number, delta: number) => {
    const frame = reducedMotionRef.current ? 0 : Math.floor(time / ORB_GRAIN_FRAME_MS);
    const targetSelectionScale = isSelected ? 1.5 : 1;
    let selectionScale = reducedMotionRef.current
      ? targetSelectionScale
      : selectionScaleRef.current + (targetSelectionScale - selectionScaleRef.current) * (1 - Math.exp(-Math.min(delta, 50) * 0.012));
    if (Math.abs(targetSelectionScale - selectionScale) < 0.001) selectionScale = targetSelectionScale;
    selectionScaleRef.current = selectionScale;
    const scale = gradientDiameterVw(colour.weight, paletteSize) / 100 * selectionScale
      * orbPulseScale(colour.id, colour.weight, paletteSize, time, reducedMotionRef.current);
    if (canvasRef.current && (lastGrainRef.current?.hex !== colour.hex || lastGrainRef.current.frame !== frame || lastGrainRef.current.scale !== scale)) {
      drawPixelOrb(canvasRef.current, colour.hex, frame, scale);
      lastGrainRef.current = { hex: colour.hex, frame, scale };
    }

    const bounds = boundsRef.current;
    if (!bounds) return;

    const particle = particleRef.current;
    const previousBounds = previousBoundsRef.current;
    if (previousBounds?.version !== bounds.version) {
      if (previousBounds) {
        particle.x *= bounds.width / previousBounds.width;
        particle.y *= bounds.height / previousBounds.height;
      } else {
        const occupied = Object.entries(positionsRef.current)
          .filter(([id]) => id !== colour.id)
          .map(([, position]) => position);
        const start = randomParticlePosition(bounds, occupied);
        particle.x = start.x;
        particle.y = start.y;
      }
      containParticle(particle, bounds);
      previousBoundsRef.current = bounds;
    }

    if (!reducedMotionRef.current) advanceParticle(particle, bounds, delta);
    offsetX.set(particle.x);
    offsetY.set(particle.y);
    onPositionChange?.(colour.id, particle.x, particle.y);
    spawnOpacity.set(1);
  }, [boundsRef, colour.hex, colour.id, colour.weight, isSelected, offsetX, offsetY, onPositionChange, paletteSize, positionsRef, spawnOpacity]);

  useAnimationFrame(updatePosition);

  const diameterVw = gradientDiameterVw(colour.weight, paletteSize);

  return (
    <motion.div
      className="pointer-events-none absolute top-0 left-0 z-1 mix-blend-screen"
      style={{ x: offsetX, y: offsetY, opacity: spawnOpacity }}
    >
      <button
        className="group pointer-events-auto grid aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[width] duration-[700ms] focus-visible:outline-none motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]"
        style={{ width: `${diameterVw}vw`, "--orb-focus-size": `${64 * diameterVw / 100 * (isSelected ? 1.5 : 1)}px` } as CSSProperties}
        type="button"
        data-colour-orb={colour.id}
        data-hovered={isHovered}
        aria-label={`Show ${colour.name} photographs`}
        aria-pressed={isSelected}
        onClick={(event) => {
          if (event.detail === 0) onKeyboardSelect();
        }}
      >
        <canvas
          ref={canvasRef}
          width={ORB_PIXELS}
          height={ORB_PIXELS}
          aria-hidden="true"
          className="pixel-orb size-32"
          data-active={isSelected || isHovered}
          style={{ "--orb-colour": colour.hex } as CSSProperties}
        />
      </button>
    </motion.div>
  );
}
