export function foregroundForBackground(backgroundHex: string | null): "#000000" | "#ffffff" {
  if (!backgroundHex || !/^#[0-9a-fA-F]{6}$/.test(backgroundHex)) return "#000000";

  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(backgroundHex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance < 0.179 ? "#ffffff" : "#000000";
}
