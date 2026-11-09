"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicMedia } from "@/lib/site/types";
import { canPlayChord, COLOUR_CHORD_EVENT, safeVolume } from "@/lib/audio/colour-chords";
import { ColourInstrument } from "@/lib/audio/instrument";
import { hasActiveExternalMedia, subscribeExternalMedia } from "@/lib/audio/external-media";

type Status = "off" | "loading" | "playing" | "paused" | "ended" | "error";
type AudioControls = {
  available: boolean; status: Status; message: string; muted: boolean;
  volume: number; colourSound: boolean;
  togglePlayback: () => void; toggleMute: () => void;
  setVolume: (value: number) => void; toggleColourSound: () => void;
};
const AudioState = createContext<AudioControls | null>(null);

export function usePublicAudio() {
  const audio = useContext(AudioState);
  if (!audio) throw new Error("usePublicAudio requires PublicAudioProvider in the public shell.");
  return audio;
}

export function PublicAudioProvider({ track, children }: { track: PublicMedia | null; children: ReactNode }) {
  const player = useRef<HTMLAudioElement>(null);
  const instrument = useRef<ColourInstrument | null>(null);
  const otherMedia = useRef(new Set<HTMLMediaElement>());
  const mounted = useRef(false);
  const playRequest = useRef(0);
  const enablingColour = useRef(false);
  const [status, setStatus] = useState<Status>("off");
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [colourSound, setColourSound] = useState(false);
  const [trackUrl, setTrackUrl] = useState(track?.url);
  if (trackUrl !== track?.url) {
    setTrackUrl(track?.url);
    setStatus("off");
    setMessage("");
  }
  const available = Boolean(track?.url && track.mimeType.startsWith("audio/"));
  const current = useRef({ muted, volume, colourSound });
  const attachPlayer = useCallback((node: HTMLAudioElement | null) => {
    if (player.current && player.current !== node) player.current.pause();
    player.current = node;
    if (node) { node.volume = current.current.volume; node.muted = current.current.muted; }
  }, []);
  useEffect(() => { current.current = { muted, volume, colourSound }; }, [muted, volume, colourSound]);

  useEffect(() => {
    mounted.current = true;
    const ambient = player.current;
    const mediaSet = otherMedia.current;
    const unsubscribeExternal = subscribeExternalMedia(() => {
      if (hasActiveExternalMedia()) {
        playRequest.current++;
        player.current?.pause();
        if (player.current) setStatus("paused");
        setMessage("Music paused for other media. Play music again when you’re ready.");
        instrument.current?.setVolume(0);
      } else if (!hasOtherMedia()) {
        const state = current.current;
        instrument.current?.setVolume(state.muted || !state.colourSound ? 0 : state.volume);
      }
    });
    const play = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement) || media === player.current) return;
      mediaSet.add(media);
      const ownPlayer = player.current;
      playRequest.current++;
      if (ownPlayer && !ownPlayer.paused) {
        setMessage("Music paused for other media. Play music again when you’re ready.");
      }
      ownPlayer?.pause();
      if (ownPlayer) setStatus("paused");
      instrument.current?.setVolume(0);
    };
    const finish = (event: Event) => {
      if (event.target instanceof HTMLMediaElement) otherMedia.current.delete(event.target);
      if (!hasOtherMedia()) {
        const state = current.current;
        instrument.current?.setVolume(state.muted || !state.colourSound ? 0 : state.volume);
      }
    };
    const chord = (event: Event) => {
      const state = current.current;
      if (canPlayChord(state.colourSound, state.muted, state.volume, hasOtherMedia())) {
        instrument.current?.setVolume(state.volume);
        instrument.current?.play((event as CustomEvent<number>).detail);
      }
    };
    document.addEventListener("play", play, true);
    document.addEventListener("pause", finish, true);
    document.addEventListener("ended", finish, true);
    window.addEventListener(COLOUR_CHORD_EVENT, chord);
    return () => {
      mounted.current = false;
      unsubscribeExternal();
      document.removeEventListener("play", play, true);
      document.removeEventListener("pause", finish, true);
      document.removeEventListener("ended", finish, true);
      window.removeEventListener(COLOUR_CHORD_EVENT, chord);
      ambient?.pause();
      instrument.current?.dispose();
      instrument.current = null;
      mediaSet.clear();
    };
  }, []);

  function hasOtherMedia() {
    for (const media of otherMedia.current) {
      if (!media.isConnected || media.paused || media.ended) otherMedia.current.delete(media);
    }
    // Also catch media already playing when the provider mounted.
    return hasActiveExternalMedia() || otherMedia.current.size > 0 || Array.from(document.querySelectorAll("audio, video"))
      .some((media) => media instanceof HTMLMediaElement && media !== player.current && !media.paused && !media.ended);
  }

  useEffect(() => {
    if (player.current) { player.current.volume = volume; player.current.muted = muted; }
    instrument.current?.setVolume(muted || !colourSound || hasOtherMedia() ? 0 : volume);
  }, [volume, muted, colourSound]);

  async function togglePlayback() {
    const audio = player.current;
    if (!audio || !available) return;
    if (!audio.paused || status === "loading") { playRequest.current++; audio.pause(); setStatus("paused"); return; }
    if (hasOtherMedia()) { setMessage("Pause the other audio or video before playing music."); return; }
    setMessage("");
    setStatus("loading");
    const request = ++playRequest.current;
    try {
      // Retry through the canonical CMS endpoint, not a remembered signed URL.
      if (audio.error) audio.load();
      await audio.play();
    } catch {
      if (mounted.current && request === playRequest.current && audio === player.current) {
        audio.pause(); setStatus("error"); setMessage("Music could not play. Select Play music to retry.");
      }
    }
  }

  async function toggleColourSound() {
    if (colourSound) { setColourSound(false); return; }
    if (enablingColour.current) return;
    enablingColour.current = true;
    try {
      if (!instrument.current) instrument.current = new ColourInstrument(new AudioContext());
      await instrument.current.resume();
      if (mounted.current) { setColourSound(true); setMessage("Colour sound enabled. Select a photo colour to hear a chord."); }
    } catch {
      if (mounted.current) setMessage("Colour sound is unavailable in this browser. Music controls still work independently.");
    } finally { enablingColour.current = false; }
  }

  return <AudioState.Provider value={{ available, status, message, muted, volume, colourSound,
    togglePlayback: () => { void togglePlayback(); }, toggleMute: () => setMuted((value) => !value),
    setVolume: (value) => setVolume(safeVolume(value)), toggleColourSound: () => { void toggleColourSound(); } }}>
    {children}
    {available ? <audio key={track!.url} ref={attachPlayer} src={track!.url} preload="none"
      onPlaying={() => { setStatus("playing"); setMessage(""); }}
      onPause={() => setStatus("paused")} onEnded={() => setStatus("ended")}
      onWaiting={() => { if (!player.current?.paused) setStatus("loading"); }}
      onError={() => { setStatus("error"); setMessage("Music is unavailable. Select Play music to retry."); }} /> : null}
  </AudioState.Provider>;
}
