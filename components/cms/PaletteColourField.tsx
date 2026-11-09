"use client";

import { TextField, useField } from "@payloadcms/ui";
import type { TextFieldClientProps } from "payload";
import { isPaletteHex } from "@/lib/site/page-palette";
import "./palette-colour-field.css";

export function PaletteColourField(props: TextFieldClientProps) {
  const { value, setValue } = useField<string>({ path: props.path });
  return <div className="cms-page-colour">
    <TextField {...props} />
    <input type="color" aria-label={`${typeof props.field.label === "string" ? props.field.label : "Page colour"} picker`} value={isPaletteHex(value) ? value : "#000000"} disabled={props.readOnly} onChange={event => setValue(event.target.value)} />
  </div>;
}
