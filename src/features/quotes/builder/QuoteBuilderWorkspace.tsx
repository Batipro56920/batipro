import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { BookOpen, ChevronDown, Download, Eye, GripVertical, Pencil, Save, Send, Settings2, Trash2, X } from "lucide-react";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { DEFAULT_QUOTE_LIBRARY } from "./quoteBuilderLibrary";
import { downloadQuoteBuilderPdf } from "./quoteBuilderPdf";
import { useQuoteBuilderStore } from "./quoteBuilderStore";
import type { QuoteBuilderFlatRow, QuoteBuilderNode, QuoteBuilderQuote, QuoteLibraryItem } from "./types";

type Props = { onClose: () => void };
type Mode = "edit" | "preview";
type TextPanelKey = "paymentTerms" | "legalMentions" | "waste" | "footerNotes";

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
  const [mode, setMode] = useState<Mode>("edit");
  const [query, setQuery] = useState("");
  const [libraryTab, setLibraryTab] = useState("ma_bibliotheque");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [compositeOpen, setCompositeOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(() => quote ? flattenQuoteBuilder(quote.nodes) : [], [quote]);
  const totals = useMemo(() => quote ? calculateQuoteBuilderTotals(quote) : null, [quote]);
  const library = useMemo(() => {
    const value = query.trim().toLowerCase();
    const filteredByTab = DEFAULT_QUOTE_LIBRARY.filter((item) => {
      if (libraryTab === "ouvrages") return item.kind === "ouvrage";
      if (libraryTab === "fournitures") return item.kind === "fourniture";
      if (libraryTab === "main_oeuvre") return item.kind === "main_oeuvre";
      return true;
    });
    if (!value) return filteredByTab;
    return filteredByTab.filter((item) => [item.title, item.family, item.kind].some((part) => part.toLowerCase().includes(value)));
  }, [libraryTab, query]);

  const columns = useMemo<ColumnDef<QuoteBuilderFlatRow>[]>(() => [
    { id: "drag", header: "", cell: () => <GripVertical className="h-4 w-4 text-slate-300" /> },
    { accessorKey: "number", header: "N°", cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.number}</span> },
    { id: "title", header: "Désignation", cell: ({ row }) => <TitleCell row={row.original} onSelectParent={setActiveParent} onChange={(patch) => updateNode(row.original.id, patch)} onConfigureComposite={() => setCompositeOpen(true)} /> },
    { id: "quantity", header: "Qté", cell: ({ row }) => row.original.node.type === "item" && quote?.settings.showQuantityColumns ? <NumberInput value={row.original.node.quantity} onChange={(quantity) => updateNode(row.original.id, { quantity } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "unit", header: "Unité", cell: ({ row }) => row.original.node.type === "item" && quote?.settings.showQuantityColumns ? <UnitSelect value={row.original.node.unit} onChange={(unit) => updateNode(row.original.id, { unit } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "unitPriceHt", header: "PU HT", cell: ({ row }) => row.original.node.type === "item" ? <NumberInput value={row.original.node.unitPriceHt} onChange={(unitPriceHt) => updateNode(row.original.id, { unitPriceHt } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "vat", header: "TVA", cell: ({ row }) => row.original.node.type === "item" && quote?.settings.showVatColumn ? <VatSelect value={row.original.node.vatRate} onChange={(vatRate) => updateNode(row.original.id, { vatRate } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "total", header: "Total HT", cell: ({ row }) => <span className="font-semibold text-slate-900">{row.original.node.type === "item" ? formatCurrency(row.original.totalHt) : sectionTotalLabel(row.original, rows, quote)}</span> },
    { id: "actions", header: "", cell: ({ row }) => <button type="button" onClick={() => removeNode(row.original.id)} className="rounded-lg p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> },
  ], [quote, removeNode, rows, setActiveParent, updateNode]);

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id });

  if (!quote || !totals) return <QuoteDocumentLoader />;

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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <QuoteTopbar quote={quote} mode={mode} saveState={saveState} libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen((open) => !open)} onModeChange={setMode} onClose={onClose} onSave={() => void save()} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} />
      {error ? <div className="mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <main className="grid min-h-[calc(100vh-56px)] grid-cols-1 gap-0 xl:grid-cols-[auto_minmax(760px,1fr)_260px]">
        <QuoteLibraryPanel open={libraryOpen} onToggle={() => setLibraryOpen((open) => !open)} query={query} setQuery={setQuery} tab={libraryTab} setTab={setLibraryTab} items={library} onInsert={insertLibraryItem} />
        <section className="overflow-auto px-4 py-5 xl:px-6">
          {mode === "edit" ? (
            <QuoteDocumentSurface quote={quote} rows={rows} table={table} sensors={sensors} onDragEnd={onDragEnd} updateQuote={updateQuote} updateNode={updateNode} removeNode={removeNode} addItem={addItem} addSection={addSection} addSubsection={addSubsection} />
          ) : (
            <QuotePreview quote={quote} rows={rows} totals={totals} />
          )}
        </section>
        <QuoteTotalsPanel quote={quote} totals={totals} onPdf={() => downloadQuoteBuilderPdf(quote)} updateQuote={updateQuote} />
      </main>

      {optionsOpen ? <QuoteOptionsMenu quote={quote} updateQuote={updateQuote} onDraft={saveDraft} onPdf={() => downloadQuoteBuilderPdf(quote)} onClose={() => setOptionsOpen(false)} /> : null}
      {compositeOpen ? <CompositeDialog onClose={() => setCompositeOpen(false)} /> : null}
    </div>
  );
}

export function QuoteDocumentLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
        <h1 className="mt-5 text-lg font-semibold text-slate-950">Chargement du devis</h1>
        <p className="mt-2 text-sm text-slate-500">Projet, client, visite de chiffrage, bibliothèque, paramètres entreprise et conditions de paiement.</p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full bg-blue-500" /></div>
      </div>
    </div>
  );
}

function QuoteTopbar({ quote, mode, saveState, libraryOpen, optionsOpen, setOptionsOpen, onToggleLibrary, onModeChange, onClose, onSave }: { quote: QuoteBuilderQuote; mode: Mode; saveState: string; libraryOpen: boolean; optionsOpen: boolean; setOptionsOpen: (open: boolean) => void; onToggleLibrary: () => void; onModeChange: (mode: Mode) => void; onClose: () => void; onSave: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onToggleLibrary} className={iconButtonClass} aria-label="Ouvrir la bibliothèque" aria-pressed={libraryOpen}><BookOpen className="h-4 w-4" /></button>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-slate-950">Devis n° {quote.number}</div>
        </div>
        <span className="hidden rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 sm:inline-flex">{saveStateLabel(saveState)}</span>
        <button type="button" onClick={() => onModeChange("edit")} className={tabClass(mode === "edit")}><Pencil className="h-4 w-4" /> Edition</button>
        <button type="button" onClick={() => onModeChange("preview")} className={tabClass(mode === "preview")}><Eye className="h-4 w-4" /> Prévisualisation</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOptionsOpen(!optionsOpen)} className={secondaryButtonClass}><Settings2 className="h-4 w-4" /> Options <ChevronDown className="h-4 w-4" /></button>
        <button type="button" onClick={onSave} className={primaryButtonClass}><Save className="h-4 w-4" /> Enregistrer</button>
        <button type="button" disabled className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white opacity-60"><Send className="h-4 w-4" /> Envoyer</button>
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Fermer</button>
      </div>
    </header>
  );
}

function QuoteLibraryPanel({ open, onToggle, query, setQuery, tab, setTab, items, onInsert }: { open: boolean; onToggle: () => void; query: string; setQuery: (value: string) => void; tab: string; setTab: (value: string) => void; items: QuoteLibraryItem[]; onInsert: (item: QuoteLibraryItem) => void }) {
  const tabs = [
    ["ma_bibliotheque", "Ma bibliothèque"],
    ["ouvrages", "Ouvrages"],
    ["fournitures", "Fournitures"],
    ["main_oeuvre", "MO"],
    ["anciens", "Anciens devis"],
    ["imports", "Imports"],
  ];

  if (!open) {
    return (
      <aside className="hidden w-14 border-r border-slate-200 bg-white xl:block">
        <div className="sticky top-14 flex h-[calc(100vh-56px)] flex-col items-center gap-3 py-4">
          <button type="button" onClick={onToggle} className={iconButtonClass} aria-label="Ouvrir la bibliothèque"><BookOpen className="h-4 w-4" /></button>
          <span className="mt-2 rotate-180 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 [writing-mode:vertical-rl]">Bibliothèque</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[280px] border-r border-slate-200 bg-white xl:block">
      <div className="sticky top-14 h-[calc(100vh-56px)] overflow-auto p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Bibliothèque</h2>
          <button type="button" onClick={onToggle} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer la bibliothèque"><X className="h-4 w-4" /></button>
        </div>
        <input className="mt-3 h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300" placeholder="Rechercher..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="mt-3 grid grid-cols-2 gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-2 py-1.5 text-left text-xs font-semibold ${tab === id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>{label}</button>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onInsert(item)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50">
              <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{item.family} · {formatUnit(item.unit)} · {formatCurrency(item.unitPriceHt)}</div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function QuoteDocumentSurface({ quote, rows, table, sensors, onDragEnd, updateQuote, updateNode, removeNode, addItem, addSection, addSubsection }: { quote: QuoteBuilderQuote; rows: QuoteBuilderFlatRow[]; table: ReturnType<typeof useReactTable<QuoteBuilderFlatRow>>; sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent) => void; updateQuote: (patch: Partial<QuoteBuilderQuote>) => void; updateNode: (id: string, patch: Partial<QuoteBuilderNode>) => void; removeNode: (id: string) => void; addItem: (kind?: any) => void; addSection: () => void; addSubsection: () => void }) {
  const [editingText, setEditingText] = useState<TextPanelKey | null>(null);
  const wasteText = "Gestion des déchets selon la réglementation applicable.";

  return (
    <div className="mx-auto max-w-[1080px] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 p-7 lg:grid-cols-[1fr_360px]">
        <div>
          <input className="w-full rounded-lg border border-transparent text-2xl font-semibold text-slate-950 outline-none hover:border-slate-200 focus:border-blue-300" value={`Devis n° ${quote.number}`} onChange={(event) => updateQuote({ number: event.target.value.replace(/^Devis n°\s*/, "") })} />
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div>En date du {formatDate(quote.date)}</div>
            <div>Valable jusqu'au {quote.validUntil ? formatDate(quote.validUntil) : "à définir"}</div>
          </div>
        </div>
        <div className="space-y-2.5">
          <Field value={quote.clientName} onChange={(clientName) => updateQuote({ clientName })} placeholder="Client" muted />
          <Field value={quote.siteAddress} onChange={(siteAddress) => updateQuote({ siteAddress })} placeholder="Adresse chantier" muted />
        </div>
        <textarea className="min-h-16 rounded-xl border border-transparent p-3 text-sm text-slate-700 outline-none hover:border-slate-200 focus:border-blue-300 lg:col-span-2" value={quote.description} onChange={(event) => updateQuote({ description: event.target.value })} placeholder="Description du projet" />
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          <table className="hidden w-full table-fixed text-sm md:table">
            <colgroup>
              <col className="w-8" />
              <col className="w-16" />
              <col />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-10" />
            </colgroup>
            <thead className="bg-blue-600 text-left text-xs uppercase tracking-[0.14em] text-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id} className="px-3 py-2.5">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <SortableRow key={row.id} id={row.id} row={row.original}>
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="border-b border-slate-100 px-3 py-1.5 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </SortableRow>
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>

      <div className="space-y-3 p-4 md:hidden">
        {rows.map((row) => <MobileRow key={row.id} row={row} onChange={(patch) => updateNode(row.id, patch)} onRemove={() => removeNode(row.id)} />)}
      </div>

      <div className="border-t border-slate-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Ajouter</span>
          <button type="button" onClick={() => addItem("fourniture")} className={lineButtonClass}>+ Fourniture</button>
          <button type="button" onClick={() => addItem("main_oeuvre")} className={lineButtonClass}>+ Main d'oeuvre</button>
          <button type="button" onClick={() => addItem("ouvrage")} className={lineButtonClass}>+ Ouvrage</button>
          <button type="button" onClick={() => addItem("divers")} className={lineButtonClass}>+ Texte</button>
          <button type="button" onClick={addSection} className={lineButtonClass}>+ Section</button>
          <button type="button" onClick={addSubsection} className={lineButtonClass}>+ Sous-section</button>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-7 py-5">
        <div className="grid gap-3 md:grid-cols-2">
          <CompactDocumentCard title="Conditions de paiement" summary={quote.paymentTerms} action="Modifier" onClick={() => setEditingText("paymentTerms")} />
          <CompactDocumentCard title="Mentions légales" summary={quote.legalMentions ? `${countTextBlocks(quote.legalMentions)} bloc(s) configuré(s)` : "Aucune mention configurée"} action="Modifier" onClick={() => setEditingText("legalMentions")} />
          <CompactDocumentCard title="Gestion déchets" summary="Gestion déchets configurée" action="Modifier" onClick={() => setEditingText("waste")} />
          <CompactDocumentCard title="Notes de bas de page" summary={quote.footerNotes ? `${countTextBlocks(quote.footerNotes)} note(s) configurée(s)` : "Aucune note configurée"} action="Modifier" onClick={() => setEditingText("footerNotes")} />
        </div>
      </div>

      {editingText === "paymentTerms" ? <TextEditDrawer title="Conditions de paiement" value={quote.paymentTerms} onChange={(paymentTerms) => updateQuote({ paymentTerms })} onClose={() => setEditingText(null)} /> : null}
      {editingText === "legalMentions" ? <TextEditDrawer title="Mentions légales" value={quote.legalMentions} onChange={(legalMentions) => updateQuote({ legalMentions })} onClose={() => setEditingText(null)} /> : null}
      {editingText === "waste" ? <TextEditDrawer title="Gestion déchets" value={wasteText} onChange={() => undefined} onClose={() => setEditingText(null)} readOnly /> : null}
      {editingText === "footerNotes" ? <TextEditDrawer title="Notes de bas de page" value={quote.footerNotes} onChange={(footerNotes) => updateQuote({ footerNotes })} onClose={() => setEditingText(null)} /> : null}
    </div>
  );
}

function QuoteTotalsPanel({ quote, totals, onPdf, updateQuote }: { quote: QuoteBuilderQuote; totals: ReturnType<typeof calculateQuoteBuilderTotals>; onPdf: () => void; updateQuote: (patch: Partial<QuoteBuilderQuote>) => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <aside className="hidden border-l border-slate-200 bg-slate-50 xl:block">
      <div className="sticky top-14 h-[calc(100vh-56px)] overflow-auto p-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2 text-sm">
            <TotalRow label="Total HT" value={totals.totalHt} />
            <TotalRow label="TVA" value={totals.totalVat} />
            <TotalRow label="Total TTC" value={totals.totalTtc} strong />
          </div>
          <button type="button" onClick={() => setDetailsOpen(true)} className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100">Détails financiers</button>
        </div>
      </div>
      {detailsOpen ? <FinancialDetailsDrawer quote={quote} totals={totals} onPdf={onPdf} updateQuote={updateQuote} onClose={() => setDetailsOpen(false)} /> : null}
    </aside>
  );
}

function FinancialDetailsDrawer({ quote, totals, onPdf, updateQuote, onClose }: { quote: QuoteBuilderQuote; totals: ReturnType<typeof calculateQuoteBuilderTotals>; onPdf: () => void; updateQuote: (patch: Partial<QuoteBuilderQuote>) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
      <aside className="h-full w-full max-w-md overflow-auto bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Détails financiers</h2>
            <p className="text-sm text-slate-500">Acompte, TVA, marge et PDF.</p>
          </div>
          <button type="button" onClick={onClose} className={iconButtonClass}><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <div className="space-y-2 text-sm">
            <TotalRow label="Total HT" value={totals.totalHt} />
            <TotalRow label="TVA" value={totals.totalVat} />
            <TotalRow label="Total TTC" value={totals.totalTtc} strong />
            <TotalRow label={`Acompte ${quote.settings.depositPercent}%`} value={totals.depositTtc} />
            <TotalRow label="Reste à facturer" value={totals.remainingTtc} />
          </div>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Acompte %</label>
          <NumberInput value={quote.settings.depositPercent} onChange={(depositPercent) => updateQuote({ settings: { ...quote.settings, depositPercent } })} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-3 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-500"><span>Taux</span><span className="text-right">Base HT</span><span className="text-right">TVA</span></div>
          {totals.vatBreakdown.map((item) => (
            <div key={item.rate} className="grid grid-cols-3 py-2 text-sm text-slate-600"><span>{item.rate}%</span><span className="text-right">{formatCurrency(item.baseHt)}</span><span className="text-right">{formatCurrency(item.vat)}</span></div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <TotalRow label="Marge brute" value={0} />
          <div className="mt-2 flex justify-between text-sm text-slate-600"><span>Taux marge</span><span>À chiffrer</span></div>
        </div>
        <button type="button" onClick={onPdf} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Download className="h-4 w-4" /> Générer PDF</button>
      </aside>
    </div>
  );
}

function CompactDocumentCard({ title, summary, action, onClick }: { title: string; summary: string; action: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{summary || "Non configuré"}</div>
        </div>
        <button type="button" onClick={onClick} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">{action}</button>
      </div>
    </div>
  );
}

function TextEditDrawer({ title, value, onChange, onClose, readOnly }: { title: string; value: string; onChange: (value: string) => void; onClose: () => void; readOnly?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
      <aside className="h-full w-full max-w-lg bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className={iconButtonClass}><X className="h-4 w-4" /></button>
        </div>
        <textarea className="mt-6 min-h-[360px] w-full rounded-xl border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} />
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={primaryButtonClass}>Fermer</button>
        </div>
      </aside>
    </div>
  );
}

function QuotePreview({ quote, rows, totals }: { quote: QuoteBuilderQuote; rows: QuoteBuilderFlatRow[]; totals: ReturnType<typeof calculateQuoteBuilderTotals> }) {
  return (
    <div className="mx-auto max-w-[980px] rounded-sm border border-slate-200 bg-white p-10 shadow-sm">
      <div className="flex justify-between gap-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">CB Renovation</div>
          <h1 className="mt-6 text-3xl font-bold text-slate-950">Devis n° {quote.number}</h1>
          <p className="mt-2 text-sm text-slate-600">En date du {formatDate(quote.date)}</p>
        </div>
        <div className="w-80 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
          <div className="font-semibold text-slate-950">{quote.clientName}</div>
          <div className="mt-1 whitespace-pre-line">{quote.siteAddress}</div>
        </div>
      </div>
      <p className="mt-8 text-sm leading-6 text-slate-700">{quote.description}</p>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200">
        {rows.map((row) => (
          <div key={row.id} className={`grid grid-cols-[90px_1fr_140px] gap-4 border-b border-slate-100 px-4 py-3 text-sm ${row.node.type === "section" ? "bg-blue-50 font-bold" : row.node.type === "subsection" ? "bg-slate-50 font-semibold" : ""}`}>
            <span>{row.number}</span>
            <span>{row.node.title}</span>
            <span className="text-right">{row.node.type === "item" ? formatCurrency(row.totalHt) : ""}</span>
          </div>
        ))}
      </div>
      <div className="ml-auto mt-8 w-80 rounded-xl border border-slate-200">
        <div className="space-y-2 p-4"><TotalRow label="Total HT" value={totals.totalHt} /><TotalRow label="TVA" value={totals.totalVat} /><TotalRow label="Total TTC" value={totals.totalTtc} strong /></div>
      </div>
      <div className="mt-10 text-sm leading-6 text-slate-700"><strong>Conditions de paiement</strong><br />{quote.paymentTerms}</div>
      <div className="mt-8 h-24 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">Signature client</div>
    </div>
  );
}

function QuoteOptionsMenu({ quote, updateQuote, onDraft, onPdf, onClose }: { quote: QuoteBuilderQuote; updateQuote: (patch: Partial<QuoteBuilderQuote>) => void; onDraft: () => void; onPdf: () => void; onClose: () => void }) {
  const options = [
    ["showMargins", "Afficher calcul des marges"],
    ["showDiscounts", "Afficher remises"],
    ["showReferences", "Afficher références"],
    ["showTypes", "Afficher types"],
    ["showVatColumn", "Afficher colonne TVA"],
    ["showQuantityColumns", "Afficher colonnes quantité/unité"],
    ["hideCompositeDetails", "Masquer éléments ouvrage"],
    ["hideSectionTotals", "Masquer totaux sections"],
  ] as const;
  return (
    <div className="fixed right-4 top-16 z-40 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-950">Options document</h3><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></div>
      <div className="mt-4 space-y-3">
        {options.map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={Boolean(quote.settings[key])} onChange={(event) => updateQuote({ settings: { ...quote.settings, [key]: event.target.checked } })} />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={onDraft} className={secondaryButtonClass}>Brouillon</button>
        <button type="button" onClick={onPdf} className={secondaryButtonClass}><Download className="h-4 w-4" /> PDF</button>
      </div>
    </div>
  );
}

function CompositeDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-950">Ouvrage composé</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <p className="mt-1 text-sm text-slate-500">Configurez les composants, le déboursé sec et la marge de l'ouvrage.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {["Fourniture", "Main d'oeuvre", "Sous-traitance", "Matériel", "Divers"].map((label) => <button key={label} type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">{label}</button>)}
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><span>Désignation</span><span>Qté</span><span>Prix vente HT</span><span>Total HT</span></div>
          <div className="mt-3 grid grid-cols-[1fr_80px_120px_120px] gap-3"><input className={inputClass} placeholder="Composant ouvrage" /><input className={inputClass} defaultValue="1" /><input className={inputClass} defaultValue="0" /><input className={inputClass} disabled defaultValue="0,00 €" /></div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3"><Metric label="Déboursé sec" value="0,00 €" /><Metric label="Marge brute" value="0,00 €" /><Metric label="Prix vente" value="0,00 €" /></div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" className={secondaryButtonClass} onClick={onClose}>Annuler</button><button type="button" className={primaryButtonClass} onClick={onClose}>Enregistrer</button></div>
      </div>
    </div>
  );
}

function SortableRow({ id, row, children }: { id: string; row: QuoteBuilderFlatRow; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const rowClass = row.node.type === "section" ? "group bg-blue-50/90 text-slate-950 hover:bg-blue-50" : row.node.type === "subsection" ? "group bg-slate-50 text-slate-900 hover:bg-slate-100" : "group bg-white hover:bg-slate-50";
  return <tr ref={setNodeRef} style={style} className={rowClass} {...attributes} {...listeners}>{children}</tr>;
}

function TitleCell({ row, onChange, onSelectParent, onConfigureComposite }: { row: QuoteBuilderFlatRow; onChange: (patch: Partial<QuoteBuilderNode>) => void; onSelectParent: (id: string | null) => void; onConfigureComposite: () => void }) {
  const node = row.node;
  const weight = node.type === "section" ? "font-bold text-base" : node.type === "subsection" ? "font-semibold" : "";
  return (
    <div className="space-y-1" style={{ paddingLeft: row.depth * 18 }}>
      <input className={`w-full rounded border border-transparent bg-transparent px-2 py-1 text-slate-900 outline-none hover:border-slate-200 focus:border-blue-300 ${weight}`} value={node.title} onFocus={() => node.type !== "item" && onSelectParent(node.id)} onChange={(event) => onChange({ title: event.target.value } as Partial<QuoteBuilderNode>)} />
      {node.type === "item" && node.kind === "ouvrage" ? <button type="button" onClick={onConfigureComposite} className="text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100 hover:text-blue-700">Configurer l'ouvrage</button> : null}
      {node.type === "item" ? <input className="h-8 w-full rounded border border-slate-100 px-2 text-xs text-slate-500" placeholder="Note interne" value={node.internalNote ?? ""} onChange={(event) => onChange({ internalNote: event.target.value } as Partial<QuoteBuilderNode>)} /> : null}
    </div>
  );
}

function MobileRow({ row, onChange, onRemove }: { row: QuoteBuilderFlatRow; onChange: (patch: Partial<QuoteBuilderNode>) => void; onRemove: () => void }) {
  const node = row.node;
  return <div className={`rounded-2xl border p-3 ${node.type === "section" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-500">{row.number}</span><button type="button" onClick={onRemove} className="text-red-600"><Trash2 className="h-4 w-4" /></button></div><input className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 font-semibold" value={node.title} onChange={(event) => onChange({ title: event.target.value } as Partial<QuoteBuilderNode>)} />{node.type === "item" ? <div className="mt-3 grid grid-cols-2 gap-2"><NumberInput value={node.quantity} onChange={(quantity) => onChange({ quantity } as Partial<QuoteBuilderNode>)} /><UnitSelect value={node.unit} onChange={(unit) => onChange({ unit } as Partial<QuoteBuilderNode>)} /><NumberInput value={node.unitPriceHt} onChange={(unitPriceHt) => onChange({ unitPriceHt } as Partial<QuoteBuilderNode>)} /><VatSelect value={node.vatRate} onChange={(vatRate) => onChange({ vatRate } as Partial<QuoteBuilderNode>)} /></div> : null}</div>;
}

function Field({ value, onChange, placeholder, muted }: { value: string; onChange: (value: string) => void; placeholder: string; muted?: boolean }) {
  return <input className={`w-full rounded-lg border border-transparent px-3 py-3 text-sm outline-none hover:border-slate-200 focus:border-blue-300 ${muted ? "bg-slate-50" : "bg-white"}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="h-8 w-full min-w-16 rounded border border-slate-200 px-2 text-right text-sm" type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function UnitSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="u">u</option><option value="h">h</option><option value="ml">ml</option><option value="m2">m²</option><option value="m3">m³</option><option value="forfait">forfait</option></select>;
}

function VatSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <select className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-sm" value={value} onChange={(event) => onChange(Number(event.target.value))}><option value={0}>0%</option><option value={5.5}>5.5%</option><option value={10}>10%</option><option value={20}>20%</option></select>;
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? "text-base font-bold text-slate-950" : "text-slate-600"}`}><dt>{label}</dt><dd>{formatCurrency(value)}</dd></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-2 text-lg font-bold text-slate-950">{value}</div></div>;
}

function countTextBlocks(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean).length || 1;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatUnit(value: string) {
  if (value === "m2") return "m²";
  if (value === "m3") return "m³";
  return value;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "-";
}

function saveStateLabel(state: string) {
  if (state === "dirty") return "Non enregistré";
  if (state === "saving") return "Enregistrement...";
  if (state === "saved") return "Enregistré";
  if (state === "error") return "Erreur";
  return "Brouillon";
}

function tabClass(active: boolean) {
  return `inline-flex h-14 items-center gap-2 border-b-2 px-2 text-sm font-semibold ${active ? "border-blue-500 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-950"}`;
}

function sectionTotalLabel(row: QuoteBuilderFlatRow, rows: QuoteBuilderFlatRow[], quote: QuoteBuilderQuote | null) {
  if (!quote || quote.settings.hideSectionTotals || row.node.type === "item") return "";
  const prefix = `${row.number}.`;
  const total = rows.filter((item) => item.number.startsWith(prefix) && item.node.type === "item").reduce((sum, item) => sum + item.totalHt, 0);
  return total ? `Sous-total : ${formatCurrency(total)}` : "";
}

const iconButtonClass = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50";
const secondaryButtonClass = "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
const primaryButtonClass = "inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700";
const lineButtonClass = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700";
const inputClass = "h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300";
