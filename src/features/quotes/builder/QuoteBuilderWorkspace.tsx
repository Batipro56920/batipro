import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Download, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { DEFAULT_QUOTE_LIBRARY } from "./quoteBuilderLibrary";
import { downloadQuoteBuilderPdf } from "./quoteBuilderPdf";
import { useQuoteBuilderStore } from "./quoteBuilderStore";
import type { QuoteBuilderFlatRow, QuoteBuilderNode, QuoteLibraryItem } from "./types";

type Props = {
  onClose: () => void;
};

export function QuoteBuilderWorkspace({ onClose }: Props) {
  const quote = useQuoteBuilderStore((state) => state.quote);
  const saveState = useQuoteBuilderStore((state) => state.saveState);
  const error = useQuoteBuilderStore((state) => state.error);
  const updateQuote = useQuoteBuilderStore((state) => state.updateQuote);
  const updateNode = useQuoteBuilderStore((state) => state.updateNode);
  const setActiveParent = useQuoteBuilderStore((state) => state.setActiveParent);
  const addSection = useQuoteBuilderStore((state) => state.addSection);
  const addSubsection = useQuoteBuilderStore((state) => state.addSubsection);
  const addItem = useQuoteBuilderStore((state) => state.addItem);
  const removeNode = useQuoteBuilderStore((state) => state.removeNode);
  const moveNode = useQuoteBuilderStore((state) => state.moveNode);
  const saveDraft = useQuoteBuilderStore((state) => state.saveDraft);
  const save = useQuoteBuilderStore((state) => state.save);
  const [query, setQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(() => quote ? flattenQuoteBuilder(quote.nodes) : [], [quote]);
  const totals = useMemo(() => quote ? calculateQuoteBuilderTotals(quote) : null, [quote]);
  const library = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return DEFAULT_QUOTE_LIBRARY;
    return DEFAULT_QUOTE_LIBRARY.filter((item) => [item.title, item.family, item.kind].some((part) => part.toLowerCase().includes(value)));
  }, [query]);

  const columns = useMemo<ColumnDef<QuoteBuilderFlatRow>[]>(() => [
    { id: "drag", header: "", cell: () => <GripVertical className="h-4 w-4 text-slate-400" /> },
    { accessorKey: "number", header: "N°", cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.number}</span> },
    { id: "title", header: "Designation", cell: ({ row }) => <TitleCell row={row.original} onSelectParent={setActiveParent} onChange={(patch) => updateNode(row.original.id, patch)} /> },
    { id: "quantity", header: "Qte", cell: ({ row }) => row.original.node.type === "item" ? <NumberInput value={row.original.node.quantity} onChange={(quantity) => updateNode(row.original.id, { quantity } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "unit", header: "Unite", cell: ({ row }) => row.original.node.type === "item" ? <UnitSelect value={row.original.node.unit} onChange={(unit) => updateNode(row.original.id, { unit } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "unitPriceHt", header: "PU HT", cell: ({ row }) => row.original.node.type === "item" ? <NumberInput value={row.original.node.unitPriceHt} onChange={(unitPriceHt) => updateNode(row.original.id, { unitPriceHt } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "vat", header: "TVA", cell: ({ row }) => row.original.node.type === "item" ? <VatSelect value={row.original.node.vatRate} onChange={(vatRate) => updateNode(row.original.id, { vatRate } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "total", header: "Total HT", cell: ({ row }) => <span className="font-semibold text-slate-900">{row.original.node.type === "item" ? formatCurrency(row.original.totalHt) : ""}</span> },
    { id: "actions", header: "", cell: ({ row }) => <button type="button" onClick={() => removeNode(row.original.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> },
  ], [removeNode, setActiveParent, updateNode]);

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id });

  if (!quote || !totals) return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du builder devis...</div>;

  function onDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    moveNode(String(event.active.id), String(event.over.id));
  }

  function insertLibraryItem(item: QuoteLibraryItem) {
    addItem(item.kind);
    window.setTimeout(() => {
      const current = useQuoteBuilderStore.getState().quote;
      const last = current ? flattenQuoteBuilder(current.nodes).filter((row) => row.node.type === "item").at(-1) : null;
      if (!last) return;
      useQuoteBuilderStore.getState().updateNode(last.id, {
        title: item.title,
        kind: item.kind,
        unit: item.unit,
        unitPriceHt: item.unitPriceHt,
        vatRate: item.vatRate,
        description: item.description,
        sourceLibraryId: item.id,
      } as Partial<QuoteBuilderNode>);
    }, 0);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={iconButtonClass}><ArrowLeft className="h-4 w-4" /></button>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Quote Builder V1</div>
              <input className="mt-1 rounded-lg border border-transparent bg-transparent text-xl font-bold text-slate-950 outline-none hover:border-slate-200 focus:border-blue-300" value={quote.number} onChange={(event) => updateQuote({ number: event.target.value })} />
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{saveStateLabel(saveState)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addSection} className={secondaryButtonClass}><Plus className="h-4 w-4" /> Section</button>
            <button type="button" onClick={addSubsection} className={secondaryButtonClass}><Plus className="h-4 w-4" /> Sous-section</button>
            <button type="button" onClick={() => addItem("fourniture")} className={primaryButtonClass}><Plus className="h-4 w-4" /> Ligne</button>
            <button type="button" onClick={() => saveDraft()} className={secondaryButtonClass}>Brouillon</button>
            <button type="button" onClick={() => void save()} className={secondaryButtonClass}><Save className="h-4 w-4" /> Enregistrer</button>
            <button type="button" onClick={() => downloadQuoteBuilderPdf(quote)} className={secondaryButtonClass}><Download className="h-4 w-4" /> PDF</button>
          </div>
        </div>
        {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      </header>

      <main className="grid gap-4 p-5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Bibliotheque</h2>
          <input className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300" placeholder="Rechercher ouvrage, fourniture..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="mt-4 space-y-2">
            {library.map((item) => (
              <button key={item.id} type="button" onClick={() => insertLibraryItem(item)} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50">
                <div className="font-semibold text-slate-950">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500">{item.family} - {item.unit} - {formatCurrency(item.unitPriceHt)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-2">
            <Field label="Client" value={quote.clientName} onChange={(clientName) => updateQuote({ clientName })} />
            <Field label="Adresse chantier" value={quote.siteAddress} onChange={(siteAddress) => updateQuote({ siteAddress })} />
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Description projet</label>
              <textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-300" value={quote.description} onChange={(event) => updateQuote({ description: event.target.value })} />
            </div>
          </div>

          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
              <table className="hidden w-full text-sm md:table">
                <thead className="bg-blue-600 text-left text-xs uppercase tracking-[0.14em] text-white">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id} className="px-3 py-3">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <SortableRow key={row.id} id={row.id} row={row.original}>
                      {row.getVisibleCells().map((cell) => <td key={cell.id} className="border-b border-slate-100 px-3 py-2 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                    </SortableRow>
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>

          <div className="space-y-3 p-4 md:hidden">
            {rows.map((row) => <MobileRow key={row.id} row={row} onChange={(patch) => updateNode(row.id, patch)} onRemove={() => removeNode(row.id)} />)}
          </div>

          <div className="grid gap-4 border-t border-slate-200 p-5 md:grid-cols-2">
            <TextPanel title="Conditions de paiement" value={quote.paymentTerms} onChange={(paymentTerms) => updateQuote({ paymentTerms })} />
            <TextPanel title="Mentions legales" value={quote.legalMentions} onChange={(legalMentions) => updateQuote({ legalMentions })} />
            <TextPanel title="Notes de bas de page" value={quote.footerNotes} onChange={(footerNotes) => updateQuote({ footerNotes })} />
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 xl:sticky xl:top-20">
          <h2 className="font-semibold text-slate-950">Totaux</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <TotalRow label="Total HT" value={totals.totalHt} />
            <TotalRow label="TVA" value={totals.totalVat} />
            <TotalRow label="Total TTC" value={totals.totalTtc} strong />
            <TotalRow label={`Acompte ${quote.settings.depositPercent}%`} value={totals.depositTtc} />
            <TotalRow label="Reste a facturer" value={totals.remainingTtc} />
          </dl>
          <div className="mt-5 rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ventilation TVA</div>
            {totals.vatBreakdown.map((item) => (
              <div key={item.rate} className="mt-2 flex justify-between text-sm text-slate-600"><span>{item.rate}%</span><span>{formatCurrency(item.vat)}</span></div>
            ))}
          </div>
          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Acompte %</label>
          <NumberInput value={quote.settings.depositPercent} onChange={(depositPercent) => updateQuote({ settings: { ...quote.settings, depositPercent } })} />
        </aside>
      </main>
    </div>
  );
}

function SortableRow({ id, row, children }: { id: string; row: QuoteBuilderFlatRow; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const rowClass = row.node.type === "section" ? "bg-blue-50" : row.node.type === "subsection" ? "bg-slate-50" : "bg-white";
  return <tr ref={setNodeRef} style={style} className={rowClass} {...attributes} {...listeners}>{children}</tr>;
}

function TitleCell({ row, onChange, onSelectParent }: { row: QuoteBuilderFlatRow; onChange: (patch: Partial<QuoteBuilderNode>) => void; onSelectParent: (id: string | null) => void }) {
  const node = row.node;
  const weight = node.type === "section" ? "font-bold" : node.type === "subsection" ? "font-semibold" : "";
  return (
    <div className="space-y-1" style={{ paddingLeft: row.depth * 18 }}>
      <input className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-slate-900 outline-none hover:border-slate-200 focus:border-blue-300 ${weight}`} value={node.title} onFocus={() => node.type !== "item" && onSelectParent(node.id)} onChange={(event) => onChange({ title: event.target.value } as Partial<QuoteBuilderNode>)} />
      {node.type === "item" ? <input className="w-full rounded-lg border border-slate-100 px-2 py-1 text-xs text-slate-500" placeholder="Note interne" value={node.internalNote ?? ""} onChange={(event) => onChange({ internalNote: event.target.value } as Partial<QuoteBuilderNode>)} /> : null}
    </div>
  );
}

function MobileRow({ row, onChange, onRemove }: { row: QuoteBuilderFlatRow; onChange: (patch: Partial<QuoteBuilderNode>) => void; onRemove: () => void }) {
  const node = row.node;
  return (
    <div className={`rounded-2xl border p-3 ${node.type === "section" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{row.number}</span>
        <button type="button" onClick={onRemove} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div>
      <input className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 font-semibold" value={node.title} onChange={(event) => onChange({ title: event.target.value } as Partial<QuoteBuilderNode>)} />
      {node.type === "item" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberInput value={node.quantity} onChange={(quantity) => onChange({ quantity } as Partial<QuoteBuilderNode>)} />
          <UnitSelect value={node.unit} onChange={(unit) => onChange({ unit } as Partial<QuoteBuilderNode>)} />
          <NumberInput value={node.unitPriceHt} onChange={(unitPriceHt) => onChange({ unitPriceHt } as Partial<QuoteBuilderNode>)} />
          <VatSelect value={node.vatRate} onChange={(vatRate) => onChange({ vatRate } as Partial<QuoteBuilderNode>)} />
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span><input className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextPanel({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="font-semibold text-slate-950">{title}</span><textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm" type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function UnitSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="u">u</option><option value="h">h</option><option value="ml">ml</option><option value="m2">m²</option><option value="m3">m³</option><option value="forfait">forfait</option></select>;
}

function VatSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" value={value} onChange={(event) => onChange(Number(event.target.value))}><option value={0}>0%</option><option value={5.5}>5.5%</option><option value={10}>10%</option><option value={20}>20%</option></select>;
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? "text-base font-bold text-slate-950" : "text-slate-600"}`}><dt>{label}</dt><dd>{formatCurrency(value)}</dd></div>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function saveStateLabel(state: string) {
  if (state === "dirty") return "Non enregistre";
  if (state === "saving") return "Enregistrement...";
  if (state === "saved") return "Enregistre";
  if (state === "error") return "Erreur";
  return "Brouillon";
}

const iconButtonClass = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50";
const secondaryButtonClass = "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
const primaryButtonClass = "inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700";
