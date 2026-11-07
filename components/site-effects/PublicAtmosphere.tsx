"use client";

import { useEffect, useRef } from "react";
import { ATMOSPHERE_PROFILES, atmosphereFallback, type AtmospherePreset } from "../../lib/visual/atmosphere";
import type { createAtmosphereRenderer } from "./atmosphere-renderer";
import "./public-atmosphere.css";

export function PublicAtmosphere({ preset, className = "" }: { preset: AtmospherePreset; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: ReturnType<typeof createAtmosphereRenderer> | null = null;
    let cancelled = false;
    let contextLost = false;
    let frame = 0;
    let previous = 0;
    let seconds = 0;
    const pointer = { x: 0.5, y: 0.5, strength: 0 };
    const target = { x: 0.5, y: 0.5, strength: 0 };
    const fallback = () => { canvas.style.visibility = "hidden"; };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    };
    const schedule = () => {
      if (!cancelled && !document.hidden && !contextLost && renderer && !frame) frame = requestAnimationFrame(draw);
    };
    const draw = (now: number) => {
      frame = 0;
      if (cancelled || document.hidden || contextLost || !renderer) return;
      const delta = previous ? Math.min(now - previous, 50) / 1000 : 0;
      previous = now;
      const reduced = preference.matches;
      if (!reduced) seconds += delta;
      const ease = 1 - Math.exp(-delta * 5);
      pointer.x += (target.x - pointer.x) * ease;
      pointer.y += (target.y - pointer.y) * ease;
      pointer.strength = reduced ? 0 : pointer.strength + (target.strength - pointer.strength) * ease;
      try {
        const rendered = renderer.render(seconds, reduced, pointer);
        canvas.style.visibility = rendered ? "visible" : "hidden";
        if (rendered && !reduced) schedule();
      } catch {
        fallback();
        renderer.dispose();
        renderer = null;
      }
    };
    const onVisibility = () => { stop(); schedule(); };
    const onPreference = () => {
      target.strength = 0;
      pointer.strength = 0;
      stop();
      schedule();
    };
    const onPointer = (event: PointerEvent) => {
      if (preference.matches || event.pointerType === "touch" || document.hidden) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      target.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      target.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      target.strength = preset === "journal" ? 6 : 18;
    };
    const clearPointer = () => { target.strength = 0; };
    const onPointerOut = (event: PointerEvent) => { if (!event.relatedTarget) clearPointer(); };
    const onLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      stop();
      fallback();
    };
    const onRestored = () => { contextLost = false; schedule(); };
    const resize = new ResizeObserver(schedule);
    resize.observe(canvas);
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", schedule);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("pointercancel", clearPointer, { passive: true });
    window.addEventListener("blur", clearPointer);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    // No Three.js in the initial component chunk. CSS is usable before it arrives.
    void import("./atmosphere-renderer").then(({ createAtmosphereRenderer }) => {
      if (cancelled) return;
      renderer = createAtmosphereRenderer(canvas, preset);
      schedule();
    }).catch(fallback);

    return () => {
      cancelled = true;
      stop();
      resize.disconnect();
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("pointercancel", clearPointer);
      window.removeEventListener("blur", clearPointer);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      renderer?.dispose();
      fallback();
    };
  }, [preset]);

  return (
    <div
      className={`public-atmosphere ${className}`}
      aria-hidden="true"
      inert
      style={{ backgroundColor: ATMOSPHERE_PROFILES[preset].background, backgroundImage: atmosphereFallback(preset) }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
