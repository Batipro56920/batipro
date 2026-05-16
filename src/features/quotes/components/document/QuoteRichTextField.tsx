import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
};

export function QuoteRichTextField({ value, placeholder, onCommit }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "min-h-24 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm outline-none focus:border-blue-200",
      },
    },
    onBlur: ({ editor: current }) => onCommit(current.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value || "<p></p>");
  }, [editor, value]);

  return <EditorContent editor={editor} />;
}
