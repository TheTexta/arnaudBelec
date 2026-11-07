import { CHORD_PEAK, CHORD_SECONDS, chordNotes, MAX_CHORD_VOICES, safeVolume } from "./colour-chords";
import { midiFrequency } from "./colour-chords";

/** Created only by the provider's explicit Colour sound enable gesture. */
export class ColourInstrument {
  private output: GainNode;
  private voices = new Set<OscillatorNode>();
  private busyUntil = 0;

  constructor(private context: AudioContext) {
    this.output = context.createGain();
    this.output.connect(context.destination);
  }

  async resume() { await this.context.resume(); }

  setVolume(volume: number) {
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(safeVolume(volume), now, 0.02);
  }

  play(index: number) {
    const now = this.context.currentTime;
    // Drop rapid repeats rather than accumulating voices or queued sounds.
    if (this.context.state !== "running" || now < this.busyUntil) return;
    const notes = chordNotes(index).slice(0, MAX_CHORD_VOICES);
    if (!notes.length) return;
    this.busyUntil = now + CHORD_SECONDS;
    for (const note of notes) {
      const voice = this.context.createOscillator();
      const envelope = this.context.createGain();
      voice.type = "sine";
      voice.frequency.value = midiFrequency(note);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(CHORD_PEAK, now + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + CHORD_SECONDS - 0.02);
      envelope.gain.linearRampToValueAtTime(0, now + CHORD_SECONDS);
      voice.connect(envelope).connect(this.output);
      this.voices.add(voice);
      voice.onended = () => {
        voice.disconnect();
        envelope.disconnect();
        this.voices.delete(voice);
      };
      voice.start(now);
      voice.stop(now + CHORD_SECONDS);
    }
  }

  dispose() {
    for (const voice of this.voices) voice.stop();
    this.output.disconnect();
    void this.context.close().catch(() => {});
  }
}
