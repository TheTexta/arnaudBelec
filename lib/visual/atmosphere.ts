export type AtmospherePreset = "home" | "journal" | "video" | "fashion";

type AtmosphereProfile = {
  background: string;
  colours: readonly [string, string, string, string, string, string, string];
  washOpacity: number;
  accentOpacity: number;
};

// The first five colours carry the field; cobalt and yellow are small, intermittent
// interruptions, never full-page washes. Journal retains its warm reading ground.
export const ATMOSPHERE_PROFILES: Readonly<Record<AtmospherePreset, AtmosphereProfile>> = {
  home: {
    background: "#e3e3dc",
    colours: ["#dbe4ec", "#c8d5e6", "#d3c8e0", "#dfc4c7", "#eee2b5", "#244ce8", "#f5d632"],
    washOpacity: 0.64,
    accentOpacity: 0.64,
  },
  journal: {
    background: "#090807",
    colours: ["#b6a18b", "#8093a4", "#9e8d9f", "#a57e78", "#c0a574", "#5772ac", "#c6aa65"],
    washOpacity: 0.045,
    accentOpacity: 0.035,
  },
  video: {
    background: "#dce0e5",
    colours: ["#d0deea", "#bfcfe0", "#c7c1db", "#d9c9d6", "#e6dfc2", "#3054cf", "#e6cb51"],
    washOpacity: 0.58,
    accentOpacity: 0.46,
  },
  fashion: {
    background: "#e7ded9",
    colours: ["#e4d8d2", "#cedae4", "#d7c7de", "#dfbdc6", "#ede1b9", "#3355cb", "#e6cc4b"],
    washOpacity: 0.6,
    accentOpacity: 0.44,
  },
};

const FIELD_CENTRES = [[0.08, 0.22], [0.77, 0.15], [0.86, 0.7], [0.14, 0.85], [0.48, 0.56], [0.8, 0.38], [0.22, 0.66]] as const;

/** Deterministic layout; motion is accumulated only while visible by the owner. */
export function atmosphereField(index: number, seconds: number, reducedMotion: boolean) {
  const centre = FIELD_CENTRES[index];
  const t = reducedMotion ? 0 : seconds;
  const phase = index * 1.73;
  const accent = index >= 5;
  // Accents emerge briefly, on separate long cycles. No large electric wash.
  const cycle = Math.sin(t * 0.095 + phase);
  const opacity = accent ? Math.max(0, (cycle - 0.88) / 0.12) : 1;
  return {
    x: centre[0] + (Math.sin(t * 0.035 + phase) - Math.sin(phase)) * 0.075,
    y: centre[1] + (Math.cos(t * 0.028 + phase) - Math.cos(phase)) * 0.065,
    radius: accent ? 0.065 : 0.68 + index * 0.035,
    opacity,
    lightScale: accent ? opacity * 0.42 : 0,
  };
}

/** A plain gradient fallback, not a substitute claiming to reproduce WebGL grain. */
export function atmosphereFallback(preset: AtmospherePreset): string {
  const profile = ATMOSPHERE_PROFILES[preset];
  return profile.colours.slice(0, 5).map((hex, index) => {
    const field = atmosphereField(index, 0, true);
    const alpha = Math.round(profile.washOpacity * 255).toString(16).padStart(2, "0");
    return `radial-gradient(ellipse at ${field.x * 100}% ${field.y * 100}%, ${hex}${alpha}, ${hex}00 72%)`;
  }).reverse().join(", ");
}
