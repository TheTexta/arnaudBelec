"use client";

import { useId } from "react";
import { usePublicAudio } from "./PublicAudioProvider";
import styles from "./sound.module.css";

export function SoundControls() {
  const audio = usePublicAudio();
  const statusId = useId();
  const playing = audio.status === "playing" || audio.status === "loading";
  return <section className={styles.controls} aria-label="Optional sound">
    <div className={styles.row}>
      <button type="button" disabled={!audio.available} aria-describedby={statusId} onClick={audio.togglePlayback}>
        {playing ? "Pause music" : "Play music"}
      </button>
      <button type="button" aria-pressed={audio.colourSound} onClick={audio.toggleColourSound}>Colour sound {audio.colourSound ? "on" : "off"}</button>
      <button type="button" aria-pressed={audio.muted} onClick={audio.toggleMute}>{audio.muted ? "Unmute sound" : "Mute sound"}</button>
      <label className={styles.volume}>Volume
        <input type="range" min="0" max="1" step="0.05" value={audio.volume}
          aria-valuetext={`${Math.round(audio.volume * 100)} percent`} onChange={(event) => audio.setVolume(Number(event.target.value))} />
      </label>
    </div>
    <p id={statusId} role="status">{audio.message || (!audio.available ? "No music is configured. Colour sound is optional." :
      audio.status === "loading" ? "Loading music…" : audio.status === "ended" ? "Music ended. Play again whenever you like." :
        audio.status === "playing" ? (audio.muted || audio.volume === 0 ? "Music playing silently." : "Music playing.") : "Sound starts only when you choose.")}</p>
  </section>;
}
