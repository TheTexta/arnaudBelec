import assert from "node:assert/strict";
import test from "node:test";
import { observePaletteBounds } from "../../app/palette-scene";
import type { MeasuredBounds } from "../../app/gradient-orb";

test("scene measures relative photo bounds, revises on resize, and disconnects on cleanup", () => {
  const original = globalThis.ResizeObserver;
  let resize = () => {};
  const observed: Element[] = [];
  let disconnected = false;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { resize = callback; }
    observe(element: Element) { observed.push(element); }
    disconnect() { disconnected = true; }
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  let top = 120;
  const stage = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 900, height: 800 }) } as HTMLElement;
  const photo = { getBoundingClientRect: () => ({ left: 210, top, right: 710, bottom: top + 400 }) } as HTMLElement;
  const bounds: { current: MeasuredBounds | null } = { current: null };
  try {
    const cleanup = observePaletteBounds(stage, photo, bounds);
    assert.deepEqual(observed, [stage, photo]);
    assert.deepEqual(bounds.current, { version: 1, width: 900, height: 800, photo: { left: 200, top: 100, right: 700, bottom: 500 } });
    top = 140;
    resize();
    assert.equal(bounds.current!.version, 2);
    assert.equal(bounds.current!.photo.top, 120);
    cleanup();
    assert.equal(disconnected, true);
  } finally { globalThis.ResizeObserver = original; }
});
