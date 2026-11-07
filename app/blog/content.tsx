import { LinkJSXConverter, RichText, type JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";
import type { DefaultNodeTypes } from "@payloadcms/richtext-lexical";
import type { Post } from "@/payload-types";
import { OriginalVideo } from "@/components/media/OriginalVideo";

const converters: JSXConvertersFunction<DefaultNodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref: ({ linkNode }) => {
    const doc = linkNode.fields.doc;
    if (doc?.relationTo !== "posts" || typeof doc.value !== "object" || !doc.value || typeof doc.value.slug !== "string") return "#";
    return `/blog/${encodeURIComponent(doc.value.slug)}`;
  } }),
  upload: ({ node }) => {
    if (node.relationTo !== "media" || typeof node.value !== "object" || !node.value) return null;
    const media = node.value;
    if (typeof media.url !== "string" || !media.url.startsWith("/api/cms/media/file/")) return null;
    const caption = typeof media.caption === "string" ? media.caption : "";
    const alt = typeof media.alt === "string" ? media.alt : "";
    const mime = typeof media.mimeType === "string" ? media.mimeType : "";
    return <figure>
      {mime.startsWith("image/") ? (
        // Access-controlled redirects deliberately bypass the public image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={alt} width={media.width ?? undefined} height={media.height ?? undefined} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : mime.startsWith("video/") ? <OriginalVideo src={media.url} label={caption || media.filename || "Video"} />
        : mime.startsWith("audio/") ? <audio src={media.url} controls preload="metadata" aria-label={caption || media.filename || "Audio"} /> : null}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>;
  },
});

export default function BlogContent({ body }: { body: Post["body"] }) {
  return body ? <div className="journal-content"><RichText data={body} converters={converters} /></div> : null;
}
