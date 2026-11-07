import assert from "node:assert/strict";
import test from "node:test";
import { ColourInstrument } from "./instrument";
import { CHORD_SECONDS, MAX_CHORD_VOICES } from "./colour-chords";

test("instrument drops rapid repeats, applies envelopes and closes its resources (mock nodes only)", async () => {
  const voices: { onended: (() => void) | null; stops: number[]; disconnected: boolean }[] = [];
  const ramps: number[][] = [];
  let closed = false;
  const context = {
    currentTime: 0, state: "running", destination: {},
    createGain() {
      const scheduled: number[] = [];
      ramps.push(scheduled);
      return {
        gain: { cancelScheduledValues() {}, setTargetAtTime(value: number) { scheduled.push(value); },
          setValueAtTime(value: number) { scheduled.push(value); },
          linearRampToValueAtTime(value: number) { scheduled.push(value); },
          exponentialRampToValueAtTime(value: number) { scheduled.push(value); } },
        connect() { return this; }, disconnect() {},
      };
    },
    createOscillator() {
      const node = { onended: null as (() => void) | null, stops: [] as number[], disconnected: false,
        type: "", frequency: { value: 0 }, connect(target: unknown) { return target; },
        disconnect() { this.disconnected = true; }, start() {}, stop(when = 0) { this.stops.push(when); } };
      voices.push(node);
      return node;
    },
    async resume() {}, async close() { closed = true; },
  };
  const instrument = new ColourInstrument(context as unknown as AudioContext);
  await instrument.resume();
  instrument.setVolume(9);
  assert.equal(ramps[0].at(-1), 1);
  instrument.play(-1);
  assert.equal(voices.length, 0);
  instrument.play(0);
  instrument.play(1);
  assert.equal(voices.length, MAX_CHORD_VOICES);
  assert.ok(voices.every((voice) => voice.stops[0] === CHORD_SECONDS));
  assert.ok(ramps.slice(1).every((values) => values[0] === 0 && values.at(-1) === 0));
  voices.forEach((voice) => voice.onended?.());
  assert.ok(voices.every((voice) => voice.disconnected));
  context.currentTime = CHORD_SECONDS;
  instrument.play(1);
  assert.equal(voices.length, MAX_CHORD_VOICES * 2);
  instrument.dispose();
  assert.ok(voices.slice(MAX_CHORD_VOICES).every((voice) => voice.stops.length === 2));
  assert.equal(closed, true);
});
