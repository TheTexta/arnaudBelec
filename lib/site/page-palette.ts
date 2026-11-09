export type PagePalette = { background: string; colourA: string; colourB: string; accent: string };
export const isPaletteHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function validatePagePalette(value: unknown): true | string {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return "Choose the section palette or a custom palette.";
  const input = value as Record<string, unknown>;
  if (input.mode == null || input.mode === "inherit") return true;
  if (input.mode !== "custom") return "Choose the section palette or a custom palette.";
  return ["background", "colourA", "colourB", "accent"].every(key => isPaletteHex(input[key])) || "Use a six-digit hex colour for every custom palette field.";
}

export function pagePalette(value: unknown): PagePalette | null {
  if (!value || typeof value !== "object" || (value as { mode?: unknown }).mode !== "custom" || validatePagePalette(value) !== true) return null;
  const input = value as Record<string, string>;
  return { background: input.background.toLowerCase(), colourA: input.colourA.toLowerCase(), colourB: input.colourB.toLowerCase(), accent: input.accent.toLowerCase() };
}

export function colourLuminance(hex: string) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

export function colourContrast(a: string, b: string) {
  const first = colourLuminance(a), second = colourLuminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

export const paletteInk = (background: string) => colourContrast(background, "#000000") >= colourContrast(background, "#ffffff") ? "#000000" : "#ffffff";
