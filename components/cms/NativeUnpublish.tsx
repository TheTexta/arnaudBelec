"use client";
import { PopupList, UnpublishButton, useDocumentInfo, useFormModified, useFormProcessing, useFormBackgroundProcessing } from "@payloadcms/ui";

// Use the stock action, confirmation, form reset and request. Only prevent it
// from discarding unsaved/in-flight writing. Status-only Unpublish preserves the
// content revision, so the stock reset remains a valid next-edit baseline.
export function NativeUnpublish() {
  const { hasPublishedDoc } = useDocumentInfo();
  const modified = useFormModified();
  const processing = useFormProcessing();
  const background = useFormBackgroundProcessing();
  if (hasPublishedDoc && (modified || processing || background)) return <PopupList.Button disabled>Unpublish · wait for saving</PopupList.Button>;
  return <UnpublishButton />;
}
