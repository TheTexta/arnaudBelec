"use client";
import { useAuth, useDocumentInfo, useForm, useFormFields, useFormProcessing } from "@payloadcms/ui";
import { useEffect, useState } from "react";
import { validateDocument, type BlogDocument } from "@/lib/blog/document";

// Keep the original browser-recovery key/shape so pre-cutover unsent writing is
// recoverable too. This copy is private to the signed-in user's browser.
export function DraftRecovery() {
  const { id, data } = useDocumentInfo();
  const { user } = useAuth();
  const { dispatchFields, setModified } = useForm();
  const processing = useFormProcessing();
  const fields = useFormFields(([fields]) => fields);
  const key = id && user ? `arnaud-blog-draft-v1:${user.id}:${id}` : "";
  const [loaded, setLoaded] = useState<{ key: string; recovery: BlogDocument | null }>({ key: "", recovery: null });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      let recovery: BlogDocument | null = null;
      try {
        const raw = key ? localStorage.getItem(key) : null;
        if (raw) {
          recovery = validateDocument(JSON.parse(raw).document);
          try { if (JSON.stringify(recovery) === JSON.stringify(validateDocument(data))) recovery = null; }
          catch { /* Keep a valid browser copy while server form data loads. */ }
        }
      } catch { /* Optional recovery; invalid browser data is never executed. */ }
      if (active) setLoaded({ key, recovery });
    });
    return () => { active = false; };
    // Only load on document change, not each successful native autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!key || loaded.key !== key || loaded.recovery) return;
    try {
      const current = validateDocument(Object.fromEntries(["title", "slug", "excerpt", "body"].map(name => [name, fields[name]?.value])));
      const saved = validateDocument(data);
      if (JSON.stringify(current) === JSON.stringify(saved)) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify({ version: fields.legacyVersion?.value, document: current }));
    } catch { /* Quota, private browsing, or incomplete form fields are optional. */ }
  }, [key, loaded, fields, data]);
  if (!loaded.recovery || loaded.key !== key) return null;
  function restore() {
    const document = { ...loaded.recovery! };
    if (data?.firstPublishedAt) document.slug = String(data.slug);
    for (const [path, value] of Object.entries(document)) dispatchFields({ type: "UPDATE", path, value });
    setModified(true);
    setLoaded({ key, recovery: null });
  }
  function keepSaved() {
    try { localStorage.removeItem(key); } catch { /* Optional browser storage. */ }
    setLoaded({ key, recovery: null });
  }
  return <div className="blog-admin cms-recovery"><p>This browser has an unsaved recovery copy. Recover it as a private draft, or keep the server’s saved version.</p><div className="blog-actions"><button type="button" className="blog-button blog-button-primary" disabled={processing} onClick={restore}>Recover browser copy</button><button type="button" className="blog-button" disabled={processing} onClick={keepSaved}>Keep saved version</button></div></div>;
}
