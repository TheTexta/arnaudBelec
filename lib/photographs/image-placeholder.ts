/** Inline colour preview: no extra request, removed by Next Image after loading. */
export function imagePlaceholder(backgroundHex: string | null): `data:image/${string}` {
  const colour = backgroundHex && /^#[0-9a-f]{6}$/i.test(backgroundHex) ? backgroundHex : "#b6b4be";
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="${colour}" d="M0 0h1v1H0z"/></svg>`)}`;
}
