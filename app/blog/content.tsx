import type { CSSProperties, ReactNode } from "react";
import { safeLink, type BlogBlock, type BlogInline, type BlogText } from "@/lib/blog/document";

const colours: Record<string, string> = { gray: "#626260", brown: "#79523b", red: "#b42318", orange: "#a3450b", yellow: "#806300", green: "#27633b", blue: "#2255a4", purple: "#7046a1", pink: "#a22b66" };

function textStyle(props: Record<string, unknown>): CSSProperties {
  return {
    color: colours[String(props.textColor)],
    backgroundColor: colours[String(props.backgroundColor)] ? `${colours[String(props.backgroundColor)]}20` : undefined,
    textAlign: ["left", "center", "right", "justify"].includes(String(props.textAlignment)) ? props.textAlignment as CSSProperties["textAlign"] : undefined,
  };
}

function Text({ value }: { value: BlogText }) {
  let result: ReactNode = value.text;
  if (value.styles.code) result = <code>{result}</code>;
  if (value.styles.bold) result = <strong>{result}</strong>;
  if (value.styles.italic) result = <em>{result}</em>;
  if (value.styles.underline) result = <u>{result}</u>;
  if (value.styles.strike) result = <s>{result}</s>;
  return <span style={textStyle(value.styles)}>{result}</span>;
}

function Inline({ content = [] }: { content?: BlogInline[] }) {
  return content.map((value, index) => value.type === "text"
    ? <Text key={index} value={value} />
    : <a key={index} href={safeLink(value.href) ? value.href : undefined} rel="noopener noreferrer">{value.content.map((text, i) => <Text key={i} value={text} />)}</a>);
}

export default function BlogContent({ body, mediaUrls }: { body: BlogBlock[]; mediaUrls?: Record<string, string> }) {
  const output: ReactNode[] = [];
  for (let i = 0; i < body.length; i++) {
    const block = body[i];
    const nested = block.children.length ? <BlogContent body={block.children} mediaUrls={mediaUrls} /> : null;
    const style = textStyle(block.props);
    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const items: ReactNode[] = [];
      const type = block.type;
      while (i < body.length && body[i].type === type) {
        const item = body[i++];
        items.push(<li key={item.id} style={textStyle(item.props)}><Inline content={item.content} />{item.children.length ? <BlogContent body={item.children} mediaUrls={mediaUrls} /> : null}</li>);
      }
      i--;
      output.push(type === "bulletListItem" ? <ul key={block.id}>{items}</ul> : <ol key={block.id}>{items}</ol>);
      continue;
    }
    let element: ReactNode;
    switch (block.type) {
      case "heading": {
        const Heading = `h${Math.min(6, Number(block.props.level ?? 1) + 1)}` as "h2" | "h3" | "h4" | "h5" | "h6";
        element = <Heading style={style}><Inline content={block.content} /></Heading>;
        break;
      }
      case "quote": element = <blockquote style={style}><Inline content={block.content} /></blockquote>; break;
      case "codeBlock": element = <pre><code><Inline content={block.content} /></code></pre>; break;
      case "divider": element = <hr />; break;
      case "image":
      case "video":
      case "audio": {
        const stableUrl = String(block.props.url ?? "");
        const src = mediaUrls ? mediaUrls[stableUrl] : stableUrl;
        const caption = String(block.props.caption ?? "");
        element = <figure>
          {!src ? <p className="journal-media-placeholder">Media not uploaded yet</p> : block.type === "image" ? (
            // Private/signed media redirects deliberately bypass the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={caption || "Draft photograph — add a descriptive caption"} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          ) : block.type === "video" ? <video src={src} controls playsInline preload="metadata" aria-label={caption || String(block.props.name) || "Video"} />
            : <audio src={src} controls preload="metadata" aria-label={caption || String(block.props.name) || "Audio"} />}
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>;
        break;
      }
      default: element = <p style={style}><Inline content={block.content} /></p>;
    }
    output.push(<div key={block.id}>{element}{nested}</div>);
  }
  return <div className="journal-content">{output}</div>;
}
