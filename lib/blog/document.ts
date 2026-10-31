// Shared data-only document contract. Public pages never import the editor.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MEDIA_URL = /^\/blog\/media\/([0-9a-f-]{36})$/;
export const BLOCK_TYPES = ["paragraph", "heading", "bulletListItem", "numberedListItem", "quote", "codeBlock", "divider", "image", "video", "audio"] as const;
export type BlogText = { type: "text"; text: string; styles: Record<string, boolean | string> };
export type BlogInline = BlogText | { type: "link"; href: string; content: BlogText[] };
export type BlogBlock = {
  id: string;
  type: typeof BLOCK_TYPES[number];
  props: Record<string, string | number | boolean>;
  content?: BlogInline[];
  children: BlogBlock[];
};
export type BlogDocument = { title: string; slug: string; excerpt: string; body: BlogBlock[] };
export type BlogPost = BlogDocument & {
  id: string; version: number; updated_at: string; first_published_at: string | null;
  publication: { source_version: number; slug: string } | null;
};
export const EMPTY_BODY: BlogBlock[] = [{ id: "opening", type: "paragraph", props: {}, content: [], children: [] }];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid document structure.");
  return value as Record<string, unknown>;
}

export function safeLink(href: unknown): href is string {
  if (typeof href !== "string" || href.length > 2000 || /[\u0000-\u0020\\]/.test(href)) return false;
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href);
}

function text(value: unknown): BlogText {
  const input = record(value);
  if (input.type !== "text" || typeof input.text !== "string") throw new Error("Unsupported text content.");
  const styles: BlogText["styles"] = {};
  for (const [key, value] of Object.entries(record(input.styles ?? {}))) {
    if (["bold", "italic", "underline", "strike", "code"].includes(key) && typeof value === "boolean") styles[key] = value;
    else if (["textColor", "backgroundColor"].includes(key) && typeof value === "string" && /^[a-z]+$/.test(value)) styles[key] = value;
    else throw new Error("Unsupported text formatting.");
  }
  return { type: "text", text: input.text, styles };
}

export function validateBody(value: unknown): BlogBlock[] {
  if (!Array.isArray(value) || !value.length || JSON.stringify(value).length > 800_000) throw new Error("The post is empty or exceeds the document size limit.");
  let count = 0;
  const ids = new Set<string>();
  function blocks(items: unknown[], depth: number): BlogBlock[] {
    if (depth > 6) throw new Error("Use no more than six levels of nested blocks.");
    return items.map((item) => {
      if (++count > 500) throw new Error("A post can contain up to 500 blocks.");
      const block = record(item);
      if (typeof block.id !== "string" || !/^[\w-]{1,100}$/.test(block.id) || ids.has(block.id)) throw new Error("Invalid or duplicate block ID.");
      ids.add(block.id);
      if (!(BLOCK_TYPES as readonly unknown[]).includes(block.type)) throw new Error("This block type is not supported in the journal.");
      const type = block.type as BlogBlock["type"];
      const input = record(block.props ?? {});
      const props: BlogBlock["props"] = {};
      for (const key of ["textAlignment", "textColor", "backgroundColor", "level", "language", "url", "name", "caption", "previewWidth", "showPreview", "isToggleable"]) {
        const prop = input[key];
        if (prop === undefined) continue;
        if (typeof prop !== "string" && typeof prop !== "number" && typeof prop !== "boolean") throw new Error("Invalid block settings.");
        if (typeof prop === "string" && prop.length > 2000) throw new Error("A block setting is too long.");
        if (typeof prop === "number" && (!Number.isFinite(prop) || prop < 0 || prop > 4096)) throw new Error("Invalid block size.");
        props[key] = prop;
      }
      if (type === "heading" && props.level !== undefined && ![1, 2, 3, 4, 5, 6].includes(Number(props.level))) throw new Error("Invalid heading level.");
      if (props.textAlignment !== undefined && !["left", "center", "right", "justify"].includes(String(props.textAlignment))) throw new Error("Invalid alignment.");
      const media = ["image", "video", "audio"].includes(type);
      if (media && props.url !== undefined && props.url !== "" && (typeof props.url !== "string" || !mediaId(props.url))) throw new Error("Upload media using the editor; external media URLs are not supported.");
      const content = media || type === "divider" ? undefined : (Array.isArray(block.content) ? block.content : []).map((value): BlogInline => {
        const inline = record(value);
        if (inline.type === "text") return text(inline);
        if (inline.type !== "link" || !safeLink(inline.href) || !Array.isArray(inline.content)) throw new Error("Use a valid http, https, email, telephone, or relative link.");
        return { type: "link", href: inline.href, content: inline.content.map(text) };
      });
      if (block.children !== undefined && !Array.isArray(block.children)) throw new Error("Invalid nested blocks.");
      return { id: block.id, type, props, ...(content ? { content } : {}), children: blocks((block.children ?? []) as unknown[], depth + 1) };
    });
  }
  return blocks(value, 0);
}

export function validateDocument(value: unknown): BlogDocument {
  const input = record(value);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug : "";
  const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim() : "";
  if (!title || title.length > 200) throw new Error("Add a title of up to 200 characters.");
  if (slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === "media") throw new Error("Use a URL name with lowercase letters, numbers, and single hyphens (other than ‘media’).");
  if (excerpt.length > 500) throw new Error("Keep the excerpt under 500 characters.");
  return { title, slug, excerpt, body: validateBody(input.body) };
}

export function mediaId(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const id = MEDIA_URL.exec(url)?.[1];
  return id && UUID.test(id) ? id : null;
}

export function documentMedia(body: BlogBlock[]): { id: string; type: string }[] {
  return body.flatMap(block => {
    const id = ["image", "video", "audio"].includes(block.type) ? mediaId(block.props.url) : null;
    return [...(id ? [{ id, type: block.type }] : []), ...documentMedia(block.children)];
  });
}

export function assertPublishable(body: BlogBlock[]) {
  let hasContent = false;
  function visit(blocks: BlogBlock[]) {
    for (const block of blocks) {
      if (["image", "video", "audio"].includes(block.type)) {
        if (!mediaId(block.props.url)) throw new Error("Upload or remove every empty media block before publishing.");
        if (block.type === "image" && !String(block.props.caption ?? "").trim()) throw new Error("Add a descriptive caption to each photograph before publishing. It is also used as its alt text.");
        hasContent = true;
      }
      if (block.content?.some(inline => inline.type === "text" ? inline.text.trim() : inline.content.some(t => t.text.trim()))) hasContent = true;
      visit(block.children);
    }
  }
  visit(body);
  if (!hasContent) throw new Error("Write something or add media before publishing.");
}
