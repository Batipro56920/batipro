import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import { format } from "date-fns";
import { QuoteLineTable } from "./QuoteLineTable";
import { useQuoteStore } from "../store/quoteStore";

export function QuoteDocumentEditor() {
  const draft = useQuoteStore((state) => state.draft);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Description du projet, conditions particulières..." }),
    ],
    content: draft.projectDescription || "<p></p>",
    editorProps: {
      attributes: {
        class: "min-h-32 rounded-2xl border px-4 py-3 text-sm outline-none",
      },
    },
  });

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-5">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Document devis</div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{draft.quoteNumber}</h2>
            <div className="mt-2 text-sm text-slate-500">Date : {format(new Date(), "dd/MM/yyyy")}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm">
            <div className="font-semibold">{draft.clientName || "Client a definir"}</div>
            <div className="mt-1 text-slate-500">{draft.projectAddress || "Adresse chantier a definir"}</div>
          </div>
        </div>
        <div className="mt-5">
          <EditorContent editor={editor} />
        </div>
      </div>
      <QuoteLineTable />
    </section>
  );
}
