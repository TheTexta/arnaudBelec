"use client";
import { PopupList, useDocumentInfo, useFormFields, useFormProcessing } from "@payloadcms/ui";
import { useState } from "react";
import { cmsRequest } from "./request";

export function UnpublishButton() {
  const { id, hasPublishedDoc, hasPublishPermission } = useDocumentInfo();
  const version = useFormFields(([fields]) => fields.legacyVersion?.value);
  const processing = useFormProcessing();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function unpublish() {
    if (!window.confirm("Unpublish this article? Saved drafts, media originals, and revisions will be retained.")) return;
    setBusy(true); setError("");
    try {
      await cmsRequest(`/api/cms/posts/${id}`, { method: "PATCH", body: JSON.stringify({ _status: "draft", legacyVersion: version }) });
      window.location.reload();
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  if (!id || !hasPublishedDoc || !hasPublishPermission) return null;
  return <><PopupList.Button onClick={unpublish} disabled={busy || processing}>{busy ? "Unpublishing…" : "Unpublish"}</PopupList.Button>{error ? <p role="alert">{error}</p> : null}</>;
}
