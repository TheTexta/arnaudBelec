"use client";

import { BlockNoteSchema, defaultBlockSpecs, type PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { BlogBlock } from "@/lib/blog/document";
import { validateBody } from "@/lib/blog/document";
import { useEffect, useRef } from "react";
import "@blocknote/mantine/style.css";

const schema = BlockNoteSchema.create({ blockSpecs: {
  paragraph: defaultBlockSpecs.paragraph, heading: defaultBlockSpecs.heading,
  bulletListItem: defaultBlockSpecs.bulletListItem, numberedListItem: defaultBlockSpecs.numberedListItem,
  quote: defaultBlockSpecs.quote, codeBlock: defaultBlockSpecs.codeBlock, divider: defaultBlockSpecs.divider,
  image: defaultBlockSpecs.image, video: defaultBlockSpecs.video, audio: defaultBlockSpecs.audio,
} });

export default function BlockEditor({ initialContent, value, onChange, uploadFile, resolveFileUrl, editable }: {
  initialContent: BlogBlock[];
  value?: BlogBlock[];
  onChange: (body: BlogBlock[]) => void;
  uploadFile: (file: File) => Promise<string>;
  resolveFileUrl: (url: string) => Promise<string>;
  editable: boolean;
}) {
  const editor = useCreateBlockNote({ schema, initialContent: initialContent as PartialBlock<typeof schema.blockSchema>[], uploadFile, resolveFileUrl });
  const replacing = useRef(false);
  useEffect(() => {
    if (!value) return;
    try { if (JSON.stringify(validateBody(editor.document)) === JSON.stringify(value)) return; }
    catch { /* Restore the validated field value after rejected pasted content. */ }
    replacing.current = true;
    try { editor.replaceBlocks(editor.document, value as PartialBlock<typeof schema.blockSchema>[]); }
    finally { replacing.current = false; }
  }, [editor, value]);
  return <div className="blog-editor-surface"><BlockNoteView editor={editor} theme="dark" editable={editable} onChange={() => { if (!replacing.current) onChange(editor.document as unknown as BlogBlock[]); }} /></div>;
}
