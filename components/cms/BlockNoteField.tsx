"use client";

import dynamic from "next/dynamic";
import { FieldError, FieldLabel, useAuth, useDocumentInfo, useField } from "@payloadcms/ui";
import type { JSONFieldClientComponent, Validate } from "payload";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_BODY, mediaId, validateBody, type BlogBlock } from "@/lib/blog/document";
import { uploadBlogMedia } from "@/lib/blog/upload-browser";
import { cmsRequest } from "./request";

const Editor = dynamic(() => import("@/app/admin/posts/block-editor"), { ssr: false, loading: () => <p role="status">Loading editor…</p> });
export const BlockNoteField: JSONFieldClientComponent = ({ path, field, readOnly }) => {
  const validate: Validate = useCallback(value => { try { validateBody(value); return true; } catch (error) { return (error as Error).message; } }, []);
  const { value, setValue, disabled, showError } = useField<BlogBlock[]>({ potentiallyStalePath: path, validate });
  const { id } = useDocumentInfo();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const controllers = useRef(new Set<AbortController>());
  useEffect(() => {
    const uploads = controllers.current;
    const warn = (event: BeforeUnloadEvent) => { if (uploads.size) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); uploads.forEach(controller => controller.abort()); };
  }, []);
  const upload = useCallback(async (file: File) => {
    if (!id || !user) throw new Error("Save the draft before uploading media.");
    const controller = new AbortController();
    controllers.current.add(controller);
    try { return await uploadBlogMedia(file, String(id), String(user.id), cmsRequest, setMessage, controller.signal); }
    catch (error) { setMessage((error as Error).message); throw error; }
    finally { controllers.current.delete(controller); }
  }, [id, user]);
  const resolve = useCallback(async (url: string) => {
    const media = mediaId(url);
    if (!media || !id) return "";
    const result = await cmsRequest(`/api/admin/posts/${id}/media`, { method: "POST", body: JSON.stringify({ action: "read", mediaId: media }) });
    if (typeof result.url !== "string") throw new Error("Could not load private media. Sign in again.");
    return result.url;
  }, [id]);
  let body = EMPTY_BODY;
  try { body = validateBody(value ?? EMPTY_BODY); } catch { /* Keep invalid data visible as a field error; never execute it. */ }
  return <div className={`field-type blog-admin cms-blocknote ${showError ? "error" : ""}`}><FieldLabel label={field.label} path={path} required={field.required} /><FieldError path={path} />{!id ? <p>Save this draft once before uploading photographs, video, or audio.</p> : null}<Editor initialContent={body} value={body} editable={!readOnly && !disabled} onChange={blocks => { try { setValue(validateBody(blocks)); } catch (error) { setMessage((error as Error).message); } }} uploadFile={upload} resolveFileUrl={resolve} /><p role="status" aria-live="polite">{message}</p></div>;
};
