import { APIError } from "payload";

export function contentMedia(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("root" in value)) throw new APIError("Write a journal entry before publishing.", 400);
  if (Buffer.byteLength(JSON.stringify(value)) > 1024 * 1024) throw new APIError("The journal entry is too large.", 400);
  const ids = new Set<string>();
  let count = 0;
  function visit(node: unknown) {
    if (!node || typeof node !== "object" || ++count > 10000) throw new APIError("The journal document is invalid or too large.", 400);
    const item = node as Record<string, unknown>;
    if (item.type === "upload") {
      const id = typeof item.value === "object" && item.value ? (item.value as { id?: unknown }).id : item.value;
      if (item.relationTo !== "media" || typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new APIError("Finish or remove every empty media insertion.", 400);
      ids.add(id);
    }
    if (Array.isArray(item.children)) item.children.forEach(visit);
  }
  const root = (value as { root: { type?: string; children?: unknown[] } }).root;
  if (!root || root.type !== "root" || !Array.isArray(root.children)) throw new APIError("The rich-text document is invalid.", 400);
  visit(root);
  return [...ids];
}
