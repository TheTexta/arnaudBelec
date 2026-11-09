import type { ReactNode } from "react";
import type { PagePalette } from "@/lib/site/page-palette";
import { paletteStyle } from "@/lib/site/palette-style";
import { PublicAtmosphere } from "@/components/site-effects/PublicAtmosphere";
import "./site.css";

export function PalettePreview({ palette, preset, children }: { palette: PagePalette | null; preset: "journal" | "fashion"; children: ReactNode }) {
  if (!palette) return children;
  return <div className="page-palette-preview site-page-palette" style={paletteStyle(palette)}>
    <PublicAtmosphere preset={preset} palette={palette} />
    <div className="page-palette-preview-content">{children}</div>
  </div>;
}
