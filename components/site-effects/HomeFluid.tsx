"use client";

import { useEffect, useRef } from "react";
import { homeFallback, type HomePalette } from "@/lib/site/homepage";
import type { createFluidRenderer, FluidPointer } from "@/lib/visual/fluid-renderer";

export function HomeFluid({ palette }: { palette: HomePalette }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { fluidA, fluidB, background } = palette;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: ReturnType<typeof createFluidRenderer> | null = null;
    let frame = 0, previous = 0, seconds = 0, stopped = false, lost = false, initializedPointer = false;
    const pointer: FluidPointer = { x: .5, y: .5, dx: 0, dy: 0, moved: false };
    const fallback = () => { canvas.style.visibility = "hidden"; };
    const cancel = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; pointer.moved = false; initializedPointer = false; };
    const draw = (now: number) => {
      frame = 0;
      if (stopped || lost || document.hidden || motion.matches || !renderer) return;
      const delta = previous ? Math.min((now - previous) / 1000, 1 / 30) : 0;
      previous = now; seconds += delta;
      try {
        renderer.render(delta, seconds, pointer); pointer.moved = false;
        canvas.style.visibility = "visible";
        frame = requestAnimationFrame(draw);
      } catch { cancel(); fallback(); renderer.dispose(); renderer = null; }
    };
    const start = () => { if (!stopped && !lost && !motion.matches && !document.hidden && renderer && !frame) frame = requestAnimationFrame(draw); };
    const initialize = () => {
      if (motion.matches || renderer || stopped || lost) return;
      void import("@/lib/visual/fluid-renderer").then(module => {
        if (stopped || renderer || lost || motion.matches) return;
        try { renderer = module.createFluidRenderer(canvas, { fluidA, fluidB, background }); start(); }
        catch { fallback(); }
      }).catch(fallback);
    };
    const onPointer = (event: PointerEvent) => {
      if (motion.matches || document.hidden || event.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      if (initializedPointer) {
        pointer.dx = Math.max(-.08, Math.min(.08, x - pointer.x));
        pointer.dy = Math.max(-.08, Math.min(.08, y - pointer.y));
        pointer.moved = true;
      }
      pointer.x = x; pointer.y = y; initializedPointer = true;
    };
    const clearPointer = () => { initializedPointer = false; pointer.moved = false; };
    const onOut = (event: PointerEvent) => { if (!event.relatedTarget) clearPointer(); };
    const visibility = () => { cancel(); start(); };
    const preference = () => { cancel(); fallback(); if (motion.matches) { renderer?.dispose(); renderer = null; } else initialize(); };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancel(); fallback(); };
    const contextRestored = () => { renderer?.dispose(); renderer = null; lost = false; initialize(); };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("blur", clearPointer);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", preference);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);
    initialize();
    return () => {
      stopped = true; cancel(); renderer?.dispose();
      window.removeEventListener("pointermove", onPointer); window.removeEventListener("pointerout", onOut); window.removeEventListener("blur", clearPointer);
      document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", preference);
      canvas.removeEventListener("webglcontextlost", contextLost); canvas.removeEventListener("webglcontextrestored", contextRestored);
    };
  }, [fluidA, fluidB, background]);
  return <div className="home-fluid site-atmosphere" aria-hidden="true" inert style={{ backgroundColor: background, backgroundImage: homeFallback(palette) }}><canvas ref={canvasRef} /></div>;
}
