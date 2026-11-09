import type { GroupField } from "payload";
import { isPaletteHex, validatePagePalette } from "../site/page-palette";

export function mergePagePalette(original: unknown, next: unknown) {
  if (next === null) return null;
  return { ...(original && typeof original === "object" ? original : {}), ...(next && typeof next === "object" ? next : {}) };
}

export { validatePagePalette };

export function pagePaletteField(): GroupField {
  return { name: "palette", type: "group", label: "Page palette", admin: { description: "Inherit the section palette, or set this page’s background, atmosphere colours and accent. Publish to make changes public." }, fields: [
    { name: "mode", type: "select", defaultValue: "inherit", options: [{ label: "Section palette", value: "inherit" }, { label: "Custom palette", value: "custom" }] },
    ...[["background", "Background"], ["colourA", "Atmosphere colour A"], ["colourB", "Atmosphere colour B"], ["accent", "Accent"]].map(([name, label]) => ({
      name, label, type: "text" as const, maxLength: 7,
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => siblingData?.mode !== "custom" || isPaletteHex(value) || "Use a six-digit hex colour, such as #112233.",
      admin: { condition: (_data: unknown, siblings: Record<string, unknown>) => siblings?.mode === "custom", components: { Field: "/components/cms/PaletteColourField#PaletteColourField" } },
    })),
  ] };
}
