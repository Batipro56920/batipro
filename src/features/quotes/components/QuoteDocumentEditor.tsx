import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { QuoteLineTable } from "./QuoteLineTable";
import { useQuoteStore } from "../store/quoteStore";
import type { QuoteLineKind } from "../types";

export function QuoteDocumentEditor() {
  const draft = useQuoteStore((state) => state.draft);
  const setDraft = useQuoteStore((state) => state.setDraft);
  const addLine = useQuoteStore((state) => state.addLine);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Description du projet, conditions particulieres..." }),
    ],
    content: draft.projectDescription || "<p></p>",
    editorProps: {
      attributes: {
        class: "min-h-24 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm outline-none focus:border-blue-200",
      },
    },
    onUpdate: ({ editor: nextEditor }) => setDraft({ projectDescription: nextEditor.getHTML() }),
  });

  function addQuickLine(kind: QuoteLineKind) {
    addLine({
      id: crypto.randomUUID(),
      persisted: false,
      parentId: null,
      kind,
      designation: kind === "section" ? "Nouvelle section" : kind === "subsection" ? "Nouvelle sous-section" : kind === "text" ? "Texte libre" : "Nouvelle ligne",
      quantity: kind === "text" || kind === "page_break" || kind === "section" || kind === "subsection" ? 0 : 1,
      unit: kind === "labor" ? "h" : "u",
      unitPriceHt: 0,
      vatRate: 20,
      purchaseCostHt: 0,
      order: draft.lines.length + 1,
    });
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Document devis</div>
            <input className="mt-1 w-full rounded-xl border border-transparent px-0 py-1 text-2xl font-semibold text-slate-950 outline-none focus:border-slate-200 focus:px-3" value={draft.quoteNumber} onChange={(event) => setDraft({ quoteNumber: event.target.value })} />
            <div className="mt-2 text-sm text-slate-500">Date : {format(new Date(), "dd/MM/yyyy")} · Validite : {draft.validUntil || "a definir"}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm">
            <input className="w-full rounded-lg border border-transparent bg-transparent font-semibold outline-none focus:border-slate-200 focus:bg-white" value={draft.clientName} onChange={(event) => setDraft({ clientName: event.target.value })} placeholder="Client" />
            <input className="mt-1 w-full rounded-lg border border-transparent bg-transparent text-slate-500 outline-none focus:border-slate-200 focus:bg-white" value={draft.projectAddress} onChange={(event) => setDraft({ projectAddress: event.target.value })} placeholder="Adresse chantier" />
          </div>
        </div>
        <div className="mt-5">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            ["material", "+ Fourniture"],
            ["labor", "+ Main d'oeuvre"],
            ["composite", "+ Ouvrage"],
            ["section", "+ Section"],
            ["subsection", "+ Sous-section"],
            ["text", "+ Texte"],
            ["page_break", "+ Saut de page"],
          ].map(([kind, label]) => (
            <button key={kind} className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => addQuickLine(kind as QuoteLineKind)}>
              <Plus className="mr-1 inline h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <QuoteLineTable />
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="font-semibold text-slate-950">Conditions de paiement</h2>
        <textarea className="mt-3 min-h-24 w-full rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm outline-none focus:border-blue-200" placeholder="Acompte, echeances, gestion dechets, notes de bas de page..." />
      </div>
    </section>
  );
}
