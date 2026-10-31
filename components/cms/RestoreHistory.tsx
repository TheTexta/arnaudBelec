"use client";
import { useDocumentInfo } from "@payloadcms/ui";
import { useState } from "react";
import { cmsRequest } from "./request";

export function RestoreHistory() {
  const { id } = useDocumentInfo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function restore() {
    setBusy(true); setError("");
    try {
      const revision = await cmsRequest(`/api/cms/legacy-revisions/${id}`);
      const post = await cmsRequest(`/api/cms/posts/${revision.postId}?draft=true`);
      if (!window.confirm(`Recover revision ${revision.revision} as a new private draft? The live article stays unchanged.`)) return;
      const result = await cmsRequest("/api/cms/recover-history", { method: "POST", body: JSON.stringify({ id, version: post.legacyVersion }) });
      // Refresh the server document and native form after recovery.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/cms/collections/posts/${result.id}`);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <div><button type="button" className="btn btn--style-primary" disabled={!id || busy} onClick={restore}>{busy ? "Recovering…" : "Recover as private draft"}</button>{error ? <p role="alert">{error}</p> : null}</div>;
}
