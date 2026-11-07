"use client";

/* eslint-disable @next/next/no-img-element -- Native CMS preview URLs keep their existing access-checked delivery. */
import { useEffect, useState } from "react";
import { FieldError, FieldLabel, TextField, useField } from "@payloadcms/ui";
import type { SelectFieldClientProps, TextFieldClientProps } from "payload";
import { validHexColour } from "@/lib/site/homepage";
import "./homepage-fields.css";

export function ColourField(props: TextFieldClientProps) {
  const { value, setValue } = useField<string>({ path: props.path });
  return <div className="cms-home-colour">
    <TextField {...props} />
    <input type="color" aria-label={`${typeof props.field.label === "string" ? props.field.label : "Homepage colour"} picker`} value={validHexColour(value) ? value : "#000000"} disabled={props.readOnly} onChange={event => setValue(event.target.value)} />
  </div>;
}

export function ImageSourceField({ path, field, readOnly }: SelectFieldClientProps) {
  const { value, setValue, showError } = useField<string>({ path });
  const id = `field-${path.replaceAll(".", "__")}`;
  return <div className="field-type cms-home-source">
    <FieldLabel htmlFor={id} label={field.label} />
    <FieldError path={path} showError={showError} />
    <select id={id} value={value || "none"} disabled={readOnly} onChange={event => setValue(event.target.value)}>
      <option value="none">Text link only</option><option value="photograph">Published photograph</option><option value="media">Media library</option>
    </select>
  </div>;
}

type Photograph = { id: string; src: string; label: string; alt: string };
export function PhotographField({ path, field, readOnly }: TextFieldClientProps) {
  const { value, setValue, showError } = useField<string>({ path });
  const [photos, setPhotos] = useState<Photograph[]>([]);
  const [status, setStatus] = useState("Loading published photographs…");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/cms/globals/site-settings/homepage-photographs", { credentials: "same-origin", signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to load photographs. Check your connection and try again.");
      const result = await response.json();
      if (!controller.signal.aborted) { setPhotos(result.photographs); setStatus(result.photographs.length ? "" : "No published photographs are available."); }
    }).catch(error => { if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "Unable to load photographs."); });
    return () => controller.abort();
  }, [attempt]);
  return <fieldset className="field-type cms-home-photographs">
    <legend>{typeof field.label === "string" ? field.label : "Photograph"}</legend>
    <FieldError path={path} showError={showError} />
    {status ? <p role="status">{status}</p> : null}
    {status.startsWith("Unable") ? <button type="button" onClick={() => { setStatus("Loading published photographs…"); setAttempt(attempt + 1); }}>Try again</button> : null}
    <div className="cms-home-photograph-options" role="group" aria-label={typeof field.label === "string" ? field.label : "Published photographs"}>
      {photos.map(photo => <button key={photo.id} type="button" disabled={readOnly} aria-pressed={value === photo.id} onClick={() => setValue(photo.id)}>
        <img src={photo.src} alt="" loading="lazy" /><span>{photo.label}</span>
      </button>)}
    </div>
    {value && !status && !photos.some(photo => photo.id === value) ? <p role="status">The selected photograph is unavailable. Choose another before publishing.</p> : null}
    {value ? <button type="button" disabled={readOnly} onClick={() => setValue("")}>Clear photograph</button> : null}
  </fieldset>;
}
