import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { BookOpen, ChevronDown, Copy, Download, Eye, GripVertical, Pencil, Save, Send, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { QuoteReviewDrawer } from "./QuoteReviewDrawer";
import { DocumentSendDialog } from "../../document-engine";
import { DEFAULT_QUOTE_LIBRARY } from "./quoteBuilderLibrary";
import { quoteBuilderToBusinessDocument } from "./quoteBuilderDocumentAdapter";
import { downloadQuoteBuilderPdf, getQuoteBuilderPdfBlob } from "./quoteBuilderPdf";
import { useQuoteBuilderStore } from "./quoteBuilderStore";
import TaskTemplateDrawer from "../../../components/TaskTemplateDrawer";
import { create as createTaskTemplate, list as listTaskTemplates, type TaskTemplateInput, type TaskTemplateRow } from "../../../services/taskLibrary.service";
import { listTaskTemplatePreparationByTemplateIds, type TaskTemplateMaterialRatioRow } from "../../../services/taskTemplatePreparation.service";
import { getCompanyHourlyRates, type CompanyHourlyRates } from "../../../services/indirectCosts.service";
import { normalizeTaskTemplateIds } from "./quoteBuilderModel";
import { calculateQuoteTravelCosts, normalizeQuoteTravelCostSettings } from "./quoteBuilderTravelCosts";
import {
  EMPTY_LINE_COST,
  estimatedDaysFromHours,
  marginRateOnSale,
  quoteItemCost,
  type QuoteLineCost,
} from "./quoteBuilderCosts";
import type { QuoteBuilderCompositeItem, QuoteBuilderFlatRow, QuoteBuilderItem, QuoteBuilderItemKind, QuoteBuilderNode, QuoteBuilderQuote, QuoteBuilderUnit, QuoteLibraryItem } from "./types";

type Props = { onClose: () => void; costsPanel?: ReactNode };
/** Ce que coute le devis, ce qu'il rapporte, et combien de lignes sont chiffrees. */
type QuoteCostSummary = {
  costHt: number;
  saleHt: number;
  hours: number;
  covered: number;
  total: number;
  /** Cout du deplacement, compte dans le deboursé quel que soit son traitement. */
  travelHt: number;
  travelMode: "hidden" | "absorb" | "line";
  /** Montant reparti sur les prix quand le deplacement est repercute. */
  travelAbsorbedHt: number;
  /** Lignes qui portent cette repartition. */
  absorbingLines: number;
};
type Mode = "edit" | "preview" | "couts";
type TextPanelKey = "paymentTerms" | "legalMentions" | "waste" | "footerNotes";

export function QuoteBuilderWorkspace({ onClose, costsPanel }: Props) {
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
  const [compositeNodeId, setCompositeNodeId] = useState<string | null>(null);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Vraie bibliothèque de tâches : la ligne de devis doit pointer vers le geste
  // technique exécuté au chantier, pas vers une liste factice.
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateRow[]>([]);
  const [taskDrawerRowId, setTaskDrawerRowId] = useState<string | null>(null);
  const [taskDrawerSaving, setTaskDrawerSaving] = useState(false);
  const [taskDrawerError, setTaskDrawerError] = useState<string | null>(null);
  const [compositeBaseComponents, setCompositeBaseComponents] = useState<QuoteBuilderCompositeItem[]>([]);
  // Taux de l'entreprise : même base que la bibliothèque de tâches et que le
  // relevé terrain, pour qu'un même geste coûte le même prix partout.
  const [rates, setRates] = useState<CompanyHourlyRates | null>(null);
  const hourlyCostHt = Number(rates?.averageEmployeeHourlyCostHt ?? 0);
  // Ratios matériaux de toutes les tâches liées du devis, pas seulement celle
  // qu'on ouvre : sans eux, le déboursé affiché serait faux.
  const [templateMaterials, setTemplateMaterials] = useState<Record<string, TaskTemplateMaterialRatioRow[]>>({});

  useEffect(() => {
    let alive = true;
    void listTaskTemplates()
      .then((rows) => {
        if (alive) setTaskTemplates(rows);
      })
      .catch(() => {
        if (alive) setTaskTemplates([]);
      });
    void getCompanyHourlyRates()
      .then((loaded) => {
        if (alive) setRates(loaded);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /** Rattache un modèle et pré-remplit la ligne sans écraser ce qui est déjà saisi. */
  function linkTaskTemplate(rowId: string, template: TaskTemplateRow | null, currentTitle: string) {
    if (!template) {
      updateNode(rowId, { taskTemplateId: null, taskTemplateLabel: null, taskTemplateIds: [], taskTemplateQuantities: [] } as Partial<QuoteBuilderNode>);
      return;
    }
    const patch: Partial<QuoteBuilderItem> = {
      taskTemplateId: template.id,
      taskTemplateLabel: template.titre,
      taskTemplateIds: [template.id],
      taskTemplateQuantities: [null],
    };
    // "Nouvelle prestation" est le libellé par défaut d'une ligne vierge, pas une
    // saisie : choisir une tâche doit le remplacer, sans écraser un vrai texte client.
    const untouched = !currentTitle.trim() || currentTitle.trim() === "Nouvelle prestation";
    if (untouched) patch.title = template.titre;
    if (template.unite) patch.unit = normalizeQuoteUnit(template.unite);
    updateNode(rowId, patch as Partial<QuoteBuilderNode>);
  }

  /**
   * Composition de base de la tâche liée (ratios matériaux + temps de pose), copiée
   * dans le devis pour servir de point de départ. C'est une copie : adapter l'ouvrage
   * ici ne modifie jamais le modèle de tâche de la bibliothèque.
   */
  useEffect(() => {
    const item = compositeNodeId ? findRowItem(compositeNodeId) : null;
    const templateId = item?.taskTemplateId;
    if (!templateId) {
      setCompositeBaseComponents([]);
      return;
    }
    let alive = true;
    void listTaskTemplatePreparationByTemplateIds([templateId])
      .then((preparation) => {
        if (!alive) return;
        const template = taskTemplates.find((row) => row.id === templateId) ?? null;
        setCompositeBaseComponents(buildBaseComponents(preparation.materialsByTemplateId[templateId] ?? [], template, hourlyCostHt));
      })
      .catch(() => {
        if (alive) setCompositeBaseComponents([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositeNodeId, taskTemplates, hourlyCostHt]);

  function findRowItem(rowId: string): QuoteBuilderItem | null {
    const flat = quote ? flattenQuoteBuilder(quote.nodes) : [];
    const row = flat.find((item) => item.id === rowId);
    return row && row.node.type === "item" ? row.node : null;
  }

  // La désignation déjà saisie sur la ligne amorce le titre de la nouvelle tâche.
  const taskDrawerInitialValues = useMemo<TaskTemplateInput | null>(() => {
    if (!taskDrawerRowId || !quote) return null;
    const flat = flattenQuoteBuilder(quote.nodes);
    const row = flat.find((item) => item.id === taskDrawerRowId);
    if (!row || row.node.type !== "item") return null;
    return { titre: row.node.title, unite: row.node.unit };
  }, [quote, taskDrawerRowId]);

  async function createTaskTemplateForRow(input: TaskTemplateInput) {
    if (!taskDrawerRowId) return;
    setTaskDrawerSaving(true);
    setTaskDrawerError(null);
    try {
      const created = await createTaskTemplate(input);
      setTaskTemplates((current) => [...current, created]);
      linkTaskTemplate(taskDrawerRowId, created, findRowItem(taskDrawerRowId)?.title ?? "");
      setTaskDrawerRowId(null);
    } catch (err: any) {
      setTaskDrawerError(err?.message ?? "Création de la tâche impossible.");
    } finally {
      setTaskDrawerSaving(false);
    }
  }
  const [sendOpen, setSendOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(() => quote ? flattenQuoteBuilder(quote.nodes) : [], [quote]);
  const totals = useMemo(() => quote ? calculateQuoteBuilderTotals(quote) : null, [quote]);
  const templatesById = useMemo(() => new Map(taskTemplates.map((row) => [row.id, row])), [taskTemplates]);

  const linkedTemplateKey = useMemo(() => {
    const ids = rows
      .filter((row) => row.node.type === "item")
      .flatMap((row) => normalizeTaskTemplateIds((row.node as QuoteBuilderItem).taskTemplateIds, (row.node as QuoteBuilderItem).taskTemplateId));
    return Array.from(new Set(ids)).sort().join(",");
  }, [rows]);

  useEffect(() => {
    const ids = linkedTemplateKey ? linkedTemplateKey.split(",") : [];
    if (!ids.length) {
      setTemplateMaterials({});
      return;
    }
    let alive = true;
    void listTaskTemplatePreparationByTemplateIds(ids)
      .then((preparation) => {
        if (alive) setTemplateMaterials(preparation.materialsByTemplateId ?? {});
      })
      .catch(() => {
        if (alive) setTemplateMaterials({});
      });
    return () => {
      alive = false;
    };
  }, [linkedTemplateKey]);

  const lineCosts = useMemo(() => {
    const map = new Map<string, QuoteLineCost>();
    for (const row of rows) {
      if (row.node.type !== "item") continue;
      map.set(row.id, quoteItemCost(row.node, templatesById, templateMaterials, rates));
    }
    return map;
  }, [rows, templatesById, templateMaterials, rates]);

  const travelSummary = useMemo(() => (quote ? calculateQuoteTravelCosts(quote) : null), [quote]);
  const travelMode = useMemo(
    () => (quote ? normalizeQuoteTravelCostSettings(quote.settings.travelCosts, quote.siteAddress).billingMode : "hidden"),
    [quote],
  );

  /**
   * Prix de base des lignes qui suivent encore le calcul : c'est sur elles, et
   * seulement sur elles, qu'un deplacement repercute peut etre reparti. Une ligne
   * dont le prix a ete decide a la main n'est jamais majoree dans le dos.
   */
  const absorbingRows = useMemo(
    () =>
      rows.filter((row) => {
        if (row.node.type !== "item") return false;
        if (row.node.priceSource === "manual") return false;
        const cost = lineCosts.get(row.id);
        return Boolean(cost && cost.costHt > 0);
      }),
    [rows, lineCosts],
  );

  const absorbingBaseHt = useMemo(
    () => absorbingRows.reduce((total, row) => total + (lineCosts.get(row.id)?.saleHt ?? 0), 0),
    [absorbingRows, lineCosts],
  );

  const travelAbsorbedHt = travelMode === "absorb" ? Number(travelSummary?.totalCostHt ?? 0) : 0;
  /**
   * Coefficient applique aux prix calcules pour absorber le deplacement. Il part
   * toujours des prix de base, jamais des prix deja majores : sans cela chaque
   * rendu aurait rajoute une couche de deplacement par-dessus la precedente.
   */
  const travelFactor = travelAbsorbedHt > 0 && absorbingBaseHt > 0 ? 1 + travelAbsorbedHt / absorbingBaseHt : 1;

  const costSummary = useMemo<QuoteCostSummary>(() => {
    let costHt = 0;
    let saleHt = 0;
    let hours = 0;
    let covered = 0;
    let total = 0;
    for (const row of rows) {
      if (row.node.type !== "item") continue;
      total += 1;
      saleHt += row.totalHt;
      const cost = lineCosts.get(row.id) ?? EMPTY_LINE_COST;
      costHt += cost.costHt;
      hours += cost.hours;
      if (cost.costHt > 0) covered += 1;
    }
    const travelHt = Number(travelSummary?.totalCostHt ?? 0);
    return {
      // Le deplacement est un cout de l'entreprise dans tous les cas : le cacher
      // du deboursé donnerait une marge qui n'existe pas.
      costHt: costHt + travelHt,
      saleHt,
      hours,
      covered,
      total,
      travelHt,
      travelMode,
      travelAbsorbedHt,
      absorbingLines: absorbingRows.length,
    };
  }, [rows, lineCosts, travelSummary, travelMode, travelAbsorbedHt, absorbingRows]);

  /**
   * Le prix d'une ligne suit son déboursé tant que personne ne l'a décidé : le
   * relevé ne transmet que des gestes et des quantités, jamais un prix de vente.
   * Dès qu'un prix est saisi dans la colonne PU HT, la ligne passe en manuel et
   * n'est plus recalculée, y compris après enregistrement et réouverture.
   */
  useEffect(() => {
    if (!rates) return;
    for (const row of rows) {
      if (row.node.type !== "item") continue;
      if (row.node.priceSource === "manual") continue;
      const cost = lineCosts.get(row.id);
      if (!cost || cost.costHt <= 0) continue;
      const lineQuantity = Number(row.node.quantity ?? 0);
      // Le prix de vente vient des tâches liées, chacune avec sa marge.
      const base = lineQuantity > 0 ? cost.saleHt / lineQuantity : cost.saleHt;
      const target = Math.round(base * travelFactor * 100) / 100;
      if (Math.abs(Number(row.node.unitPriceHt ?? 0) - target) < 0.005) continue;
      updateNode(row.id, { unitPriceHt: target } as Partial<QuoteBuilderNode>);
    }
  }, [lineCosts, rates, rows, travelFactor, updateNode]);

  /** Durée estimée : le temps des tâches liées, faute de quoi le champ restait vide. */
  const durationFilled = useRef(false);
  useEffect(() => {
    if (durationFilled.current || !quote) return;
    if (Number(quote.estimatedDurationValue ?? 0) > 0) return;
    if (costSummary.hours <= 0) return;
    durationFilled.current = true;
    updateQuote({ estimatedDurationValue: estimatedDaysFromHours(costSummary.hours), estimatedDurationUnit: "jours" });
  }, [costSummary.hours, quote, updateQuote]);

  /** Lignes dont le prix a été décidé à la main alors qu'un déboursé est connu. */
  const manualPricedRows = useMemo(
    () =>
      rows.filter((row) => {
        if (row.node.type !== "item") return false;
        if (row.node.priceSource !== "manual") return false;
        const cost = lineCosts.get(row.id);
        return Boolean(cost && cost.costHt > 0);
      }),
    [rows, lineCosts],
  );

  /** Rend la main au calcul : les lignes repassent au déboursé + marge cible. */
  function resetPricesToCost() {
    for (const row of manualPricedRows) {
      if (row.node.type !== "item") continue;
      const cost = lineCosts.get(row.id);
      if (!cost) continue;
      const lineQuantity = Number(row.node.quantity ?? 0);
      updateNode(row.id, {
        priceSource: "auto",
        unitPriceHt: lineQuantity > 0 ? Math.round((cost.saleHt / lineQuantity) * 100) / 100 : cost.saleHt,
      } as Partial<QuoteBuilderNode>);
    }
  }

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

  /**
   * Tout ce dont les cellules ont besoin, derriere une reference stable.
   *
   * Les definitions de colonnes dependaient du devis : elles etaient donc
   * recreees a chaque frappe, avec des fonctions de cellule d'identite nouvelle.
   * React voit alors un autre composant, demonte la cellule et la remonte : le
   * champ en cours de saisie est detruit et le curseur part. Les colonnes ne
   * changent plus jamais ; les cellules lisent les donnees fraiches ici.
   */
  const cellData = useRef({
    quote,
    rows,
    taskTemplates,
    lineCosts,
    updateNode,
    removeNode,
    setActiveParent,
    linkTaskTemplate,
    openComposite: setCompositeNodeId,
    openTaskDrawer: setTaskDrawerRowId,
  });
  cellData.current = {
    quote,
    rows,
    taskTemplates,
    lineCosts,
    updateNode,
    removeNode,
    setActiveParent,
    linkTaskTemplate,
    openComposite: setCompositeNodeId,
    openTaskDrawer: setTaskDrawerRowId,
  };

  const columns = useMemo<ColumnDef<QuoteBuilderFlatRow>[]>(() => [
    { id: "drag", header: "", cell: () => <RowDragHandle /> },
    { accessorKey: "number", header: "N°", cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.number}</span> },
    {
      id: "title",
      header: "Désignation",
      cell: ({ row }) => {
        const ctx = cellData.current;
        return (
          <TitleCell
            row={row.original}
            onSelectParent={ctx.setActiveParent}
            onChange={(patch) => ctx.updateNode(row.original.id, patch)}
            onConfigureComposite={() => ctx.openComposite(row.original.id)}
            taskTemplates={ctx.taskTemplates}
            onLinkTask={(templateId) =>
              ctx.linkTaskTemplate(
                row.original.id,
                ctx.taskTemplates.find((item) => item.id === templateId) ?? null,
                row.original.node.type === "item" ? row.original.node.title : "",
              )
            }
            onCreateTask={() => ctx.openTaskDrawer(row.original.id)}
            cost={ctx.lineCosts.get(row.original.id) ?? null}
            saleHt={row.original.totalHt}
          />
        );
      },
    },
    { id: "quantity", header: "Qté", cell: ({ row }) => row.original.node.type === "item" && cellData.current.quote?.settings.showQuantityColumns ? <NumberInput value={row.original.node.quantity} onChange={(quantity) => cellData.current.updateNode(row.original.id, { quantity } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "unit", header: "Unité", cell: ({ row }) => row.original.node.type === "item" && cellData.current.quote?.settings.showQuantityColumns ? <UnitSelect value={row.original.node.unit} onChange={(unit) => cellData.current.updateNode(row.original.id, { unit } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "unitPriceHt", header: "PU HT", cell: ({ row }) => row.original.node.type === "item" ? <NumberInput value={row.original.node.unitPriceHt} onChange={(unitPriceHt) => cellData.current.updateNode(row.original.id, { unitPriceHt, priceSource: "manual" } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "vat", header: "TVA", cell: ({ row }) => row.original.node.type === "item" && cellData.current.quote?.settings.showVatColumn ? <VatSelect value={row.original.node.vatRate} onChange={(vatRate) => cellData.current.updateNode(row.original.id, { vatRate } as Partial<QuoteBuilderNode>)} /> : null },
    { id: "total", header: "Total HT", cell: ({ row }) => <span className="font-semibold text-slate-900">{row.original.node.type === "item" ? formatCurrency(row.original.totalHt) : sectionTotalLabel(row.original, cellData.current.rows, cellData.current.quote)}</span> },
    { id: "actions", header: "", cell: ({ row }) => <button type="button" onClick={() => cellData.current.removeNode(row.original.id)} className="rounded-lg p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button> },
  ], []);

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id });

  useEffect(() => {
    if (!quote || saveState !== "dirty") return;
    const timer = window.setTimeout(() => saveDraft(), 1000);
    return () => window.clearTimeout(timer);
  }, [quote, saveDraft, saveState]);

  if (!quote || !totals) return <QuoteDocumentLoader />;

  function onDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    moveNode(String(event.active.id), String(event.over.id));
  }

  function insertLibraryItem(item: QuoteLibraryItem) {
    addItem(item.kind, {
      title: item.title,
      kind: item.kind,
      unit: item.unit,
      unitPriceHt: item.unitPriceHt,
      vatRate: item.vatRate,
      description: item.description,
      sourceLibraryId: item.id,
      // Le prix vient de la bibliotheque : il ne se recalcule pas tout seul.
      priceSource: "manual",
    });
  }

  function duplicateQuote() {
    if (!quote) return;
    updateQuote({
      id: null,
      number: `${quote.number}-COPIE`,
      status: "draft",
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <QuoteTopbar quote={quote} mode={mode} saveState={saveState} libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen((open) => !open)} onModeChange={setMode} onClose={onClose} onSave={() => void save()} onSend={() => setSendOpen(true)} onDuplicate={duplicateQuote} onDownload={() => downloadQuoteBuilderPdf(quote)} onReview={() => setReviewOpen(true)} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} />
      {error ? <div className="mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <main className="grid min-h-[calc(100vh-56px)] grid-cols-1 gap-0 xl:grid-cols-[auto_minmax(760px,1fr)]">
        <QuoteLibraryPanel open={libraryOpen} onToggle={() => setLibraryOpen((open) => !open)} query={query} setQuery={setQuery} tab={libraryTab} setTab={setLibraryTab} items={library} onInsert={insertLibraryItem} />
        <section className="overflow-auto px-4 py-5 xl:px-6">
          {mode === "edit" ? (
            <>
            <QuoteMarginBar summary={costSummary} manualPriced={manualPricedRows.length} onResetPrices={resetPricesToCost} />
            <QuoteDocumentSurface quote={quote} rows={rows} table={table} totals={totals} sensors={sensors} onDragEnd={onDragEnd} updateQuote={updateQuote} updateNode={updateNode} removeNode={removeNode} addItem={addItem} addSection={addSection} addSubsection={addSubsection} onOpenFinancialDetails={() => setFinancialOpen(true)} />
            </>
          ) : mode === "couts" ? (
            <div className="mx-auto max-w-3xl space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Coûts cachés</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Déplacements et forfaits qui ne se saisissent qu'une fois par devis. Leur montant se reporte sur le
                  total, sans encombrer la saisie des lignes.
                </p>
              </div>
              {costsPanel}
            </div>
          ) : (
            <QuotePreview quote={quote} rows={rows} totals={totals} onSend={() => setSendOpen(true)} />
          )}
        </section>
      </main>

      {optionsOpen ? <QuoteOptionsMenu quote={quote} updateQuote={updateQuote} onDraft={saveDraft} onPdf={() => downloadQuoteBuilderPdf(quote)} onClose={() => setOptionsOpen(false)} /> : null}
      {compositeNodeId ? <CompositeDialog2 item={findQuoteItem(quote, compositeNodeId)} baseComponents={compositeBaseComponents} onSave={(patch) => updateNode(compositeNodeId, patch as Partial<QuoteBuilderNode>)} onClose={() => setCompositeNodeId(null)} /> : null}
      {financialOpen ? <FinancialDetailsDrawer quote={quote} totals={totals} onPdf={() => downloadQuoteBuilderPdf(quote)} updateQuote={updateQuote} onClose={() => setFinancialOpen(false)} /> : null}
      {sendOpen ? <QuoteSendDialog quote={quote} onClose={() => setSendOpen(false)} /> : null}
      <TaskTemplateDrawer
        open={Boolean(taskDrawerRowId)}
        template={null}
        initialValues={taskDrawerInitialValues}
        saving={taskDrawerSaving}
        deleting={false}
        error={taskDrawerError}
        onClose={() => setTaskDrawerRowId(null)}
        onSave={(input) => createTaskTemplateForRow(input)}
        onDelete={async () => {}}
      />

      <QuoteReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onApplyDesignation={(lineId, designation) => updateNode(lineId, { title: designation } as Partial<QuoteBuilderNode>)}
        buildInput={() => ({
          project: { name: quote.number, clientName: quote.clientName, siteAddress: quote.siteAddress },
          totals: totals ? { totalHt: totals.totalHt, totalTtc: totals.totalTtc } : null,
          settings: { defaultVatRate: quote.settings.defaultVatRate, depositPercent: quote.settings.depositPercent },
          terms: { paymentTerms: quote.paymentTerms, legalMentions: quote.legalMentions, footerNotes: quote.footerNotes },
          // Coco lit le devis a plat, avec les numeros que l'utilisateur voit a l'ecran.
          lines: rows.map((row) => ({
            id: row.id,
            number: row.number,
            type: row.node.type,
            kind: row.node.type === "item" ? row.node.kind : undefined,
            title: row.node.title,
            description: row.node.type === "item" ? row.node.description : undefined,
            quantity: row.node.type === "item" ? row.node.quantity : undefined,
            unit: row.node.type === "item" ? row.node.unit : undefined,
            unitPriceHt: row.node.type === "item" ? row.node.unitPriceHt : undefined,
            vatRate: row.node.type === "item" ? row.node.vatRate : undefined,
            taskTemplateLabel: row.node.type === "item" ? row.node.taskTemplateLabel ?? null : null,
          })),
        })}
      />
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

function QuoteTopbar({ quote, mode, saveState, libraryOpen, optionsOpen, setOptionsOpen, onToggleLibrary, onModeChange, onClose, onSave, onSend, onDuplicate, onDownload, onReview }: { quote: QuoteBuilderQuote; mode: Mode; saveState: string; libraryOpen: boolean; optionsOpen: boolean; setOptionsOpen: (open: boolean) => void; onToggleLibrary: () => void; onModeChange: (mode: Mode) => void; onClose: () => void; onSave: () => void; onSend: () => void; onDuplicate: () => void; onDownload: () => void; onReview: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
      {/* Ligne 1 : identité du devis et actions décisives uniquement. */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleLibrary} className={`${iconButtonClass} shrink-0 xl:hidden`} aria-label="Ouvrir la bibliothèque" aria-pressed={libraryOpen}><BookOpen className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-slate-950">Devis n° {quote.number}</div>
        </div>
        <span className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${saveStateClass(saveState)}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {saveStateLabel(saveState)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setOptionsOpen(!optionsOpen)} className={secondaryButtonClass}><Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Options</span> <ChevronDown className="h-4 w-4" /></button>
          <button type="button" onClick={onSave} className={primaryButtonClass}><Save className="h-4 w-4" /> <span className="hidden sm:inline">Enregistrer</span></button>
          <button type="button" onClick={onSend} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"><Send className="h-4 w-4" /> <span className="hidden sm:inline">Envoyer</span></button>
          <button type="button" onClick={onClose} className={secondaryButtonClass} aria-label="Fermer le devis"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Ligne 2 : navigation entre les vues, sur sa propre ligne pour ne rien écraser. */}
      <div className="mt-2 flex items-center gap-1 overflow-x-auto">
        <button type="button" onClick={() => onModeChange("edit")} className={tabClass(mode === "edit")}><Pencil className="h-4 w-4" /> Edition</button>
        <button type="button" onClick={() => onModeChange("preview")} className={tabClass(mode === "preview")}><Eye className="h-4 w-4" /> Prévisualisation</button>
        <button type="button" onClick={() => onModeChange("couts")} className={tabClass(mode === "couts")}><Settings2 className="h-4 w-4" /> Coûts cachés</button>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={onReview} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"><Sparkles className="h-4 w-4" /> Relire avec Coco</button>
          <button type="button" onClick={onDuplicate} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 md:inline-flex"><Copy className="h-4 w-4" /> Dupliquer</button>
          <button type="button" onClick={onDownload} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 md:inline-flex"><Download className="h-4 w-4" /> Télécharger</button>
        </div>
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

function QuoteDocumentSurface({ quote, rows, table, totals, sensors, onDragEnd, updateQuote, updateNode, removeNode, addItem, addSection, addSubsection, onOpenFinancialDetails }: { quote: QuoteBuilderQuote; rows: QuoteBuilderFlatRow[]; table: ReturnType<typeof useReactTable<QuoteBuilderFlatRow>>; totals: ReturnType<typeof calculateQuoteBuilderTotals>; sensors: ReturnType<typeof useSensors>; onDragEnd: (event: DragEndEvent) => void; updateQuote: (patch: Partial<QuoteBuilderQuote>) => void; updateNode: (id: string, patch: Partial<QuoteBuilderNode>) => void; removeNode: (id: string) => void; addItem: (kind?: any) => void; addSection: () => void; addSubsection: () => void; onOpenFinancialDetails: () => void }) {
  const [editingText, setEditingText] = useState<TextPanelKey | null>(null);
  const wasteText = "Gestion des déchets selon la réglementation applicable.";

  return (
    <div className="mx-auto max-w-[1080px] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 p-7 lg:grid-cols-[1fr_360px]">
        <div>
          <input className="w-full rounded-lg border border-transparent text-2xl font-semibold text-slate-950 outline-none hover:border-slate-200 focus:border-blue-300" value={`Devis n° ${quote.number}`} onChange={(event) => updateQuote({ number: event.target.value.replace(/^Devis n°\s*/, "") })} />
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <DateField label="Date du devis" value={quote.date} onChange={(date) => updateQuote({ date })} />
            <DateField label="Valable jusqu'au" value={quote.validUntil ?? ""} onChange={(validUntil) => updateQuote({ validUntil: validUntil || null })} />
            <DateField label="Début des travaux" value={quote.workStartDate ?? ""} onChange={(workStartDate) => updateQuote({ workStartDate: workStartDate || null })} />
            <DurationField value={quote.estimatedDurationValue} unit={quote.estimatedDurationUnit ?? "semaines"} onValueChange={(estimatedDurationValue) => updateQuote({ estimatedDurationValue })} onUnitChange={(estimatedDurationUnit) => updateQuote({ estimatedDurationUnit })} />
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
          <button type="button" onClick={() => addItem("texte")} className={lineButtonClass}>+ Texte</button>
          <button type="button" onClick={addSection} className={lineButtonClass}>+ Section</button>
          <button type="button" onClick={addSubsection} className={lineButtonClass}>+ Sous-section</button>
        </div>
      </div>

      <div className="border-t border-slate-200 px-7 py-4">
        <div className="ml-auto max-w-md rounded-xl border border-slate-200 bg-white">
          <div className="space-y-2 p-4 text-sm">
            <TotalRow label="Total HT" value={totals.totalHt} />
            <TotalRow label="TVA" value={totals.totalVat} />
            <TotalRow label="Total TTC" value={totals.totalTtc} strong />
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <button type="button" onClick={onOpenFinancialDetails} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Détails financiers</button>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Résumé</span>
          </div>
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

      {editingText === "paymentTerms" ? <TextEditDrawer title="Conditions de paiement" value={quote.paymentTerms} onChange={(paymentTerms) => updateQuote({ paymentTerms })} onClose={() => setEditingText(null)} showPresetConditions /> : null}
      {editingText === "legalMentions" ? <TextEditDrawer title="Mentions légales" value={quote.legalMentions} onChange={(legalMentions) => updateQuote({ legalMentions })} onClose={() => setEditingText(null)} /> : null}
      {editingText === "waste" ? <TextEditDrawer title="Gestion déchets" value={wasteText} onChange={() => undefined} onClose={() => setEditingText(null)} readOnly /> : null}
      {editingText === "footerNotes" ? <TextEditDrawer title="Notes de bas de page" value={quote.footerNotes} onChange={(footerNotes) => updateQuote({ footerNotes })} onClose={() => setEditingText(null)} /> : null}
    </div>
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

function TextEditDrawer({ title, value, onChange, onClose, readOnly, showPresetConditions }: { title: string; value: string; onChange: (value: string) => void; onClose: () => void; readOnly?: boolean; showPresetConditions?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
      <aside className="h-full w-full max-w-lg bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className={iconButtonClass}><X className="h-4 w-4" /></button>
        </div>
        {showPresetConditions ? <PresetConditionsPanel value={value} onChange={onChange} /> : null}
        <textarea className="mt-6 min-h-[360px] w-full rounded-xl border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} />
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={primaryButtonClass}>Fermer</button>
        </div>
      </aside>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input type="date" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DurationField({ value, unit, onValueChange, onUnitChange }: { value: number | null; unit: "jours" | "semaines" | "mois"; onValueChange: (value: number | null) => void; onUnitChange: (unit: "jours" | "semaines" | "mois") => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Durée estimée</span>
      <div className="mt-1 grid grid-cols-[1fr_120px] gap-2">
        <input type="number" min={0} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-300" value={value ?? ""} onChange={(event) => onValueChange(event.target.value ? Number(event.target.value) : null)} />
        <select className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-300" value={unit} onChange={(event) => onUnitChange(event.target.value as "jours" | "semaines" | "mois")}>
          <option value="jours">jours</option>
          <option value="semaines">semaines</option>
          <option value="mois">mois</option>
        </select>
      </div>
    </label>
  );
}

function PresetConditionsPanel({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [variables, setVariables] = useState({
    depositPercent: "30",
    depositAmount: "",
    paymentMethods: "virement bancaire, espèces",
    interventionDelay: "4 semaines",
    validityDays: "30 jours",
    installments: "2",
    guaranteePercent: "5",
    energyPrimeAmount: "",
  });
  const presets = [
    { id: "deposit", label: "Acompte à la signature", text: `Acompte de ${variables.depositPercent}% à la signature${variables.depositAmount ? ` soit ${variables.depositAmount} €` : ""}.` },
    { id: "balance", label: "Solde à réception des travaux", text: "Solde à réception des travaux, après levée des réserves éventuelles." },
    { id: "energy", label: "Prime énergétique", text: `Prime énergétique${variables.energyPrimeAmount ? ` estimée à ${variables.energyPrimeAmount} €` : ""}, sous réserve d'éligibilité et d'accord de l'organisme financeur.` },
    { id: "guarantee", label: "Retenue de garantie", text: `Retenue de garantie de ${variables.guaranteePercent}% selon les conditions contractuelles applicables.` },
    { id: "methods", label: "Moyens de paiement acceptés", text: `Moyens de paiement acceptés : ${variables.paymentMethods}.` },
    { id: "waste", label: "Gestion des déchets", text: "Gestion et évacuation des déchets incluses selon les modalités prévues au devis." },
    { id: "delay", label: "Délai d'intervention", text: `Délai d'intervention prévisionnel : ${variables.interventionDelay}, sous réserve de disponibilité des matériaux.` },
    { id: "validity", label: "Validité de l'offre", text: `Offre valable ${variables.validityDays} à compter de sa date d'émission.` },
    { id: "installments", label: "Nombre d'échéances", text: `Paiement possible en ${variables.installments} échéances selon accord préalable.` },
  ];
  function toggle(text: string, checked: boolean) {
    const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
    const next = checked ? [...lines, text] : lines.filter((line) => line !== text);
    onChange(Array.from(new Set(next)).join("\n"));
  }
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-semibold text-slate-950">Conditions préremplies</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Acompte %" value={variables.depositPercent} onChange={(event) => setVariables({ ...variables, depositPercent: event.target.value })} />
        <input className={inputClass} placeholder="Montant acompte" value={variables.depositAmount} onChange={(event) => setVariables({ ...variables, depositAmount: event.target.value })} />
        <input className={inputClass} placeholder="Moyens de paiement" value={variables.paymentMethods} onChange={(event) => setVariables({ ...variables, paymentMethods: event.target.value })} />
        <input className={inputClass} placeholder="Délai d'intervention" value={variables.interventionDelay} onChange={(event) => setVariables({ ...variables, interventionDelay: event.target.value })} />
      </div>
      <div className="mt-3 grid gap-2">
        {presets.map((preset) => (
          <label key={preset.id} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={value.includes(preset.text)} onChange={(event) => toggle(preset.text, event.target.checked)} />
            <span><span className="font-semibold text-slate-900">{preset.label}</span><br /><span className="text-xs text-slate-500">{preset.text}</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}

function QuotePreview({ quote, rows, totals, onSend }: { quote: QuoteBuilderQuote; rows: QuoteBuilderFlatRow[]; totals: ReturnType<typeof calculateQuoteBuilderTotals>; onSend: () => void }) {
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(Math.max(rows.length, 1) / 18));

  function openPdf() {
    const blob = getQuoteBuilderPdfBlob(quote);
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  }

  async function sharePdf() {
    const blob = getQuoteBuilderPdfBlob(quote);
    const file = new File([blob], `${quote.number}.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `Devis ${quote.number}`, text: `Devis ${quote.number}`, files: [file] });
      return;
    }
    downloadQuoteBuilderPdf(quote);
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <div className="text-sm font-semibold text-slate-950">Aperçu client</div>
          <div className="text-xs text-slate-500">Page {page}/{pages} · Zoom {zoom}%</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setZoom((value) => Math.max(80, value - 10))} className={secondaryButtonClass}>-</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(130, value + 10))} className={secondaryButtonClass}>+</button>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} className={secondaryButtonClass}>Précédent</button>
          <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} className={secondaryButtonClass}>Suivant</button>
          <button type="button" onClick={openPdf} className={secondaryButtonClass}><Eye className="h-4 w-4" /> Ouvrir PDF</button>
          <button type="button" onClick={() => downloadQuoteBuilderPdf(quote)} className={secondaryButtonClass}><Download className="h-4 w-4" /> Télécharger</button>
          <button type="button" onClick={() => void sharePdf()} className={secondaryButtonClass}>Partager</button>
          <button type="button" onClick={onSend} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"><Send className="h-4 w-4" /> Envoyer</button>
        </div>
      </div>
      <div className="mx-auto origin-top rounded-sm border border-slate-200 bg-white p-10 shadow-sm transition-transform" style={{ maxWidth: 980, transform: `scale(${zoom / 100})` }}>
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
    </div>
  );
}

function QuoteSendDialog({ quote, onClose }: { quote: QuoteBuilderQuote; onClose: () => void }) {
  void SendOption;
  return <DocumentSendDialog document={quoteBuilderToBusinessDocument(quote)} onClose={onClose} onDownload={() => downloadQuoteBuilderPdf(quote)} />;
/*
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState(`Bonjour,\n\nVeuillez trouver ci-joint votre devis ${quote.number}.\nVous pouvez le consulter, l'accepter, le signer ou demander une modification depuis le lien sécurisé.\n\nCordialement.`);
  const [signatureEnabled, setSignatureEnabled] = useState(true);
  const [validationRequired, setValidationRequired] = useState(true);
  const [autoReminders, setAutoReminders] = useState(true);
  const [attachPdf, setAttachPdf] = useState(true);
  const canSend = recipient.trim().length > 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Envoi client</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Envoyer le devis {quote.number}</h2>
            <p className="mt-1 text-sm text-slate-500">Préparez le lien client, la signature et les relances sans quitter le devis.</p>
          </div>
          <button type="button" onClick={onClose} className={iconButtonClass} aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Destinataire
              <input className={`${inputClass} mt-2`} placeholder="client@email.fr" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Message
              <textarea className={`${inputClass} mt-2 min-h-48 resize-y leading-6`} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">Options d'envoi</div>
            <SendOption checked={signatureEnabled} onChange={setSignatureEnabled} label="Signature électronique" description="Le client signe depuis le lien sécurisé." />
            <SendOption checked={validationRequired} onChange={setValidationRequired} label="Demande de validation" description="Le devis passe en attente d'accord client." />
            <SendOption checked={autoReminders} onChange={setAutoReminders} label="Relances automatiques" description="Relance si aucune consultation ou signature." />
            <SendOption checked={attachPdf} onChange={setAttachPdf} label="PDF en pièce jointe" description="Ajoute le PDF généré au message." />
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              Workflow client : consulter, accepter, signer, refuser ou demander une modification.
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={() => downloadQuoteBuilderPdf(quote)} className={secondaryButtonClass}><Download className="h-4 w-4" /> Télécharger le PDF</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Annuler</button>
            <button type="button" disabled={!canSend} onClick={onClose} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white ${canSend ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300"}`}><Send className="h-4 w-4" /> Ancien envoi désactivé</button>
          </div>
        </div>
      </div>
    </div>
  );
*/
}

function SendOption({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
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
    <div className="fixed right-4 top-16 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
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

export function CompositeDialog({ onClose }: { onClose: () => void }) {
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

function CompositeDialog2({ item, baseComponents, onSave, onClose }: { item: QuoteBuilderItem | null; baseComponents: QuoteBuilderCompositeItem[]; onSave: (patch: Partial<QuoteBuilderItem>) => void; onClose: () => void }) {
  const [components, setComponents] = useState<QuoteBuilderCompositeItem[]>(
    item?.compositeItems?.length ? item.compositeItems : [createCompositeComponent("fourniture")],
  );
  const [seeded, setSeeded] = useState(false);

  // La composition de la tâche arrive après l'ouverture : on l'installe dès qu'elle
  // est là, tant que l'utilisateur n'a rien configuré lui-même.
  useEffect(() => {
    if (seeded || item?.compositeItems?.length || !baseComponents.length) return;
    setComponents(baseComponents);
    setSeeded(true);
  }, [baseComponents, item?.compositeItems?.length, seeded]);
  const totalHt = components.reduce((sum, component) => sum + component.quantity * component.unitPriceHt, 0);
  function updateComponent(id: string, patch: Partial<QuoteBuilderCompositeItem>) {
    setComponents((current) => current.map((component) => component.id === id ? { ...component, ...patch } : component));
  }
  function saveComposite() {
    onSave({ compositeItems: components, unitPriceHt: totalHt, quantity: item?.quantity ?? 1, kind: "ouvrage" });
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Configurer l'ouvrage</h2>
            <p className="mt-1 text-sm text-slate-500">
              {item?.taskTemplateId
                ? "Composition reprise de la tâche liée, adaptable à ce chantier."
                : "Ajoutez directement les éléments composant l'ouvrage."}
            </p>
          </div>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["fourniture", "main_oeuvre", "sous_traitance", "materiel", "divers"] as QuoteBuilderItemKind[]).map((kind) => <button key={kind} type="button" onClick={() => setComponents((current) => [...current, createCompositeComponent(kind)])} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700">+ {kindLabel(kind)}</button>)}
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[130px_1fr_80px_90px_120px_90px_120px_42px] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><span>Type</span><span>Désignation</span><span>Qté</span><span>Unité</span><span>PU HT</span><span>TVA</span><span>Total HT</span><span /></div>
          {components.map((component) => (
            <div key={component.id} className="grid grid-cols-[130px_1fr_80px_90px_120px_90px_120px_42px] gap-2 border-t border-slate-100 px-3 py-2">
              <select className={inputClass} value={component.kind} onChange={(event) => updateComponent(component.id, { kind: event.target.value as QuoteBuilderItemKind })}>{(["fourniture", "main_oeuvre", "sous_traitance", "materiel", "divers"] as QuoteBuilderItemKind[]).map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select>
              <input className={inputClass} value={component.title} onChange={(event) => updateComponent(component.id, { title: event.target.value })} placeholder="Désignation" />
              <NumberInput value={component.quantity} onChange={(quantity) => updateComponent(component.id, { quantity })} />
              <UnitSelect value={component.unit} onChange={(unit) => updateComponent(component.id, { unit: unit as QuoteBuilderUnit })} />
              <NumberInput value={component.unitPriceHt} onChange={(unitPriceHt) => updateComponent(component.id, { unitPriceHt })} />
              <VatSelect value={component.vatRate} onChange={(vatRate) => updateComponent(component.id, { vatRate })} />
              <div className="flex h-8 items-center justify-end text-sm font-semibold">{formatCurrency(component.quantity * component.unitPriceHt)}</div>
              <button type="button" onClick={() => setComponents((current) => current.filter((entry) => entry.id !== component.id))} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        {item?.taskTemplateId ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Ces ajustements ne concernent que ce devis. Le modèle de tâche de la bibliothèque n'est pas modifié.
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 md:grid-cols-3"><Metric label="Déboursé sec" value={formatCurrency(totalHt)} /><Metric label="Marge brute" value="À compléter" /><Metric label="Prix vente HT" value={formatCurrency(totalHt)} /></div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" className={secondaryButtonClass} onClick={onClose}>Annuler</button><button type="button" className={primaryButtonClass} onClick={saveComposite}>Enregistrer</button></div>
      </div>
    </div>
  );
}

/**
 * Ecouteurs de deplacement de la ligne, offerts a la seule poignee. Poses sur
 * la ligne entiere, ils demarraient un glisser des qu'on cliquait dans un champ
 * en bougeant la souris d'un pixel : ecrire dans le devis devenait un combat.
 */
const RowDragHandleContext = createContext<{ attributes: Record<string, unknown>; listeners: Record<string, unknown> } | null>(null);

function SortableRow({ id, row, children }: { id: string; row: QuoteBuilderFlatRow; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const rowClass = row.node.type === "section" ? "group bg-blue-50/90 text-slate-950 hover:bg-blue-50" : row.node.type === "subsection" ? "group bg-slate-50 text-slate-900 hover:bg-slate-100" : "group bg-white hover:bg-slate-50";
  const handle = useMemo(
    () => ({ attributes: attributes as unknown as Record<string, unknown>, listeners: (listeners ?? {}) as unknown as Record<string, unknown> }),
    [attributes, listeners],
  );
  return (
    <RowDragHandleContext.Provider value={handle}>
      <tr ref={setNodeRef} style={style} className={rowClass}>{children}</tr>
    </RowDragHandleContext.Provider>
  );
}

function RowDragHandle() {
  const handle = useContext(RowDragHandleContext);
  return (
    <span
      className="inline-flex cursor-grab touch-none text-slate-300 transition hover:text-slate-500"
      aria-label="Déplacer la ligne"
      {...(handle?.attributes ?? {})}
      {...(handle?.listeners ?? {})}
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

/**
 * Le libelle que lit le client tient rarement sur une ligne. Dans un champ
 * d'une seule ligne, une designation un peu longue etait coupee et il fallait
 * la faire defiler au curseur pour la relire — impossible de controler un devis
 * comme ca. Le champ prend donc la hauteur de son texte.
 */
function AutoGrowTextarea({
  className,
  value,
  onChange,
  onFocus,
  placeholder,
}: {
  className: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Remise a zero avant mesure : sans elle la hauteur ne fait que grandir,
    // scrollHeight ne redescendant jamais sous la hauteur deja posee.
    node.style.height = "auto";
    node.style.height = node.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function TitleCell({ row, onChange, onSelectParent, onConfigureComposite, taskTemplates, onLinkTask, onCreateTask, cost, saleHt }: { row: QuoteBuilderFlatRow; onChange: (patch: Partial<QuoteBuilderNode>) => void; onSelectParent: (id: string | null) => void; onConfigureComposite: () => void; taskTemplates: TaskTemplateRow[]; onLinkTask: (templateId: string) => void; onCreateTask: () => void; cost: QuoteLineCost | null; saleHt: number }) {
  const node = row.node;
  const weight = node.type === "section" ? "font-bold text-base" : node.type === "subsection" ? "font-semibold" : "";
  return (
    <div className="space-y-1.5" style={{ paddingLeft: row.depth * 18 }}>
      <AutoGrowTextarea
        className={`w-full resize-none overflow-hidden rounded border border-transparent bg-transparent px-2 py-1 leading-5 text-slate-900 outline-none hover:border-slate-200 focus:border-blue-300 ${weight}`}
        value={node.title}
        onFocus={() => node.type !== "item" && onSelectParent(node.id)}
        onChange={(title) => onChange({ title } as Partial<QuoteBuilderNode>)}
        placeholder={node.type === "item" ? "Ce que lit le client" : ""}
      />

      {node.type === "item" ? (
        <div className="flex flex-wrap items-center gap-1.5">

          {/*
            La bibliothèque arrive après le devis : sans option correspondante au
            premier rendu, le select retombait sur "Aucune tâche liée" et donnait
            l'impression que le lien avait été perdu. On garde donc une option pour
            la tâche liée tant qu'elle n'est pas dans la liste, et on remonte le
            select quand la liste arrive.
          */}
          <select
            key={`${node.id}-${taskTemplates.length}`}
            className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
            value={node.taskTemplateId ?? ""}
            onChange={(event) => onLinkTask(event.target.value)}
            title="Tâche exécutée au chantier"
          >
            <option value="">Aucune tâche liée</option>
            {node.taskTemplateId && !taskTemplates.some((template) => template.id === node.taskTemplateId) ? (
              <option value={node.taskTemplateId}>{node.taskTemplateLabel ?? "Tâche liée"}</option>
            ) : null}
            {taskTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.titre}</option>
            ))}
          </select>
          <button type="button" onClick={onCreateTask} className="shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">
            + Créer
          </button>
        </div>
      ) : null}

      {node.type === "item" && node.kind === "ouvrage" ? <button type="button" onClick={onConfigureComposite} className="text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100 hover:text-blue-700">Configurer l'ouvrage</button> : null}
      {node.type === "item" ? <input className="h-8 w-full rounded border border-slate-100 px-2 text-xs text-slate-500" placeholder="Note interne" value={node.internalNote ?? ""} onChange={(event) => onChange({ internalNote: event.target.value } as Partial<QuoteBuilderNode>)} /> : null}
      {node.type === "item" && cost && cost.costHt > 0 ? <LineMarginHint cost={cost} saleHt={saleHt} /> : null}
    </div>
  );
}

/** Déboursé et marge de la ligne : chiffrage interne, jamais imprimé. */
function LineMarginHint({ cost, saleHt }: { cost: QuoteLineCost; saleHt: number }) {
  const margin = saleHt - cost.costHt;
  const rate = marginRateOnSale(cost.costHt, saleHt);
  const tone = margin < 0 ? "text-red-600" : rate !== null && rate < 15 ? "text-amber-600" : "text-slate-500";
  return (
    <div className={`text-[11px] ${tone}`}>
      Déboursé {formatCurrency(cost.costHt)} · marge {formatCurrency(margin)}
      {rate === null ? "" : ` (${rate.toFixed(0)} %)`}
      {cost.hours > 0 ? ` · ${cost.hours.toLocaleString("fr-FR")} h` : ""}
    </div>
  );
}

/**
 * Chiffrage interne, affiche uniquement pendant l'edition. Rien de ce bloc ne
 * part dans la previsualisation, dans le PDF ni chez le client : c'est la seule
 * facon de voir la marge se deformer pendant qu'on ajuste les prix.
 */
function QuoteMarginBar({ summary, manualPriced, onResetPrices }: { summary: QuoteCostSummary; manualPriced: number; onResetPrices: () => void }) {
  const margin = summary.saleHt - summary.costHt;
  const rate = marginRateOnSale(summary.costHt, summary.saleHt);
  const missing = summary.total - summary.covered;
  const marginClass = margin < 0 ? "text-red-300" : rate !== null && rate < 15 ? "text-amber-300" : "text-emerald-300";

  return (
    <div className="sticky top-2 z-20 mx-auto mb-3 max-w-[1080px] rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <MarginFigure label="Deboursé sec" value={formatCurrency(summary.costHt)} />
        <MarginFigure label="Prix de vente HT" value={formatCurrency(summary.saleHt)} />
        <MarginFigure label="Marge" value={formatCurrency(margin)} tone={marginClass} />
        <MarginFigure label="Taux de marge" value={rate === null ? "—" : `${rate.toFixed(1)} %`} tone={marginClass} />
        <MarginFigure label="Temps prévu" value={summary.hours > 0 ? `${summary.hours.toLocaleString("fr-FR")} h · ${estimatedDaysFromHours(summary.hours)} j` : "—"} />
        {summary.travelHt > 0 ? <MarginFigure label="Déplacement" value={formatCurrency(summary.travelHt)} tone={travelTone(summary)} /> : null}
        {manualPriced > 0 ? (
          <button
            type="button"
            onClick={onResetPrices}
            className="ml-auto rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
          >
            Recalculer {manualPriced} prix saisi(s) à la main
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-slate-300">
        Les prix suivent le déboursé + 30 % tant que tu n'en saisis pas un toi-même.
        Visible seulement ici : ni la prévisualisation, ni le PDF, ni le client ne voient ces montants.
        {missing > 0 ? ` ${missing} ligne(s) sans tâche liée : leur déboursé n'est pas connu.` : ""}
        {travelNote(summary)}
      </p>
    </div>
  );
}

/** Le deplacement est-il recupere quelque part, ou paye par l'entreprise ? */
function travelTone(summary: QuoteCostSummary): string {
  if (summary.travelMode === "line") return "text-white";
  if (summary.travelMode !== "absorb") return "text-amber-300";
  return summary.absorbingLines > 0 ? "text-white" : "text-amber-300";
}

function travelNote(summary: QuoteCostSummary): string {
  if (summary.travelHt <= 0) return "";
  if (summary.travelMode === "line") return ` Déplacement facturé sur sa propre ligne.`;
  if (summary.travelMode !== "absorb") return ` Déplacement non facturé : ${formatCurrency(summary.travelHt)} à la charge de l'entreprise.`;
  if (summary.absorbingLines <= 0) {
    return ` Déplacement à répercuter, mais aucune ligne au prix calculé : ${formatCurrency(summary.travelHt)} restent à la charge de l'entreprise.`;
  }
  return ` Déplacement de ${formatCurrency(summary.travelAbsorbedHt)} réparti sur ${summary.absorbingLines} ligne(s), au prorata de leur prix.`;
}

function MarginFigure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className={`text-lg font-semibold ${tone ?? "text-white"}`}>{value}</div>
    </div>
  );
}

/** Traduit les ratios matériaux et le temps de pose du modèle en lignes d'ouvrage. */
function buildBaseComponents(
  materials: TaskTemplateMaterialRatioRow[],
  template: TaskTemplateRow | null,
  hourlyCostHt: number,
): QuoteBuilderCompositeItem[] {
  const components: QuoteBuilderCompositeItem[] = materials.map((material) => ({
    id: crypto.randomUUID(),
    kind: "fourniture",
    title: material.material_name,
    // Les pertes font partie de la quantité à acheter : les ignorer sous-évalue
    // systématiquement l'ouvrage.
    quantity: round4((Number(material.ratio_quantity) || 0) * (1 + (Number(material.loss_percent ?? 0) || 0) / 100)),
    unit: normalizeQuoteUnit(material.ratio_unit),
    unitPriceHt: Number(material.purchase_price_ht ?? 0) || 0,
    vatRate: 20,
  }));

  const laborHours = Number(template?.temps_prevu_par_unite_h ?? 0);
  if (laborHours > 0) {
    components.push({
      id: crypto.randomUUID(),
      kind: "main_oeuvre",
      title: "Main d'oeuvre",
      quantity: laborHours,
      unit: "h",
      unitPriceHt: hourlyCostHt,
      vatRate: 20,
    });
  }
  return components;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function normalizeQuoteUnit(unit: string | null | undefined): QuoteBuilderUnit {
  const value = String(unit ?? "").trim().toLowerCase();
  if (value === "h" || value === "ml" || value === "m2" || value === "m3" || value === "forfait") return value;
  return "u";
}

function MobileRow({ row, onChange, onRemove }: { row: QuoteBuilderFlatRow; onChange: (patch: Partial<QuoteBuilderNode>) => void; onRemove: () => void }) {
  const node = row.node;
  return <div className={`rounded-2xl border p-3 ${node.type === "section" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-500">{row.number}</span><button type="button" onClick={onRemove} className="text-red-600"><Trash2 className="h-4 w-4" /></button></div><input className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 font-semibold" value={node.title} onChange={(event) => onChange({ title: event.target.value } as Partial<QuoteBuilderNode>)} />{node.type === "item" ? <div className="mt-3 grid grid-cols-2 gap-2"><NumberInput value={node.quantity} onChange={(quantity) => onChange({ quantity } as Partial<QuoteBuilderNode>)} /><UnitSelect value={node.unit} onChange={(unit) => onChange({ unit } as Partial<QuoteBuilderNode>)} /><NumberInput value={node.unitPriceHt} onChange={(unitPriceHt) => onChange({ unitPriceHt } as Partial<QuoteBuilderNode>)} /><VatSelect value={node.vatRate} onChange={(vatRate) => onChange({ vatRate } as Partial<QuoteBuilderNode>)} /></div> : null}</div>;
}

function Field({ value, onChange, placeholder, muted }: { value: string; onChange: (value: string) => void; placeholder: string; muted?: boolean }) {
  return <input className={`w-full rounded-lg border border-transparent px-3 py-3 text-sm outline-none hover:border-slate-200 focus:border-blue-300 ${muted ? "bg-slate-50" : "bg-white"}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

/**
 * Champ numerique tolerant. En saisie directe, vider le champ le remettait a 0
 * et une virgule ou un point final donnait NaN : il fallait tout reselectionner
 * a chaque correction. On garde la frappe en cours et on ne remonte que des
 * nombres exploitables.
 */
function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(formatNumberInput(value));
  }, [focused, value]);

  return (
    <input
      className="h-8 w-full min-w-16 rounded border border-slate-200 px-2 text-right text-sm"
      inputMode="decimal"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const parsed = parseNumberInput(text);
        setText(formatNumberInput(parsed ?? 0));
        if (parsed === null) onChange(0);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        if (!raw.trim()) {
          onChange(0);
          return;
        }
        const parsed = parseNumberInput(raw);
        if (parsed !== null) onChange(parsed);
      }}
    />
  );
}

function formatNumberInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function parseNumberInput(raw: string): number | null {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
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

function saveStateClass(state: string) {
  if (state === "dirty") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "saving") return "border-blue-200 bg-blue-50 text-blue-700";
  if (state === "saved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
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

function findQuoteItem(quote: QuoteBuilderQuote, id: string): QuoteBuilderItem | null {
  for (const section of quote.nodes) {
    for (const child of section.children) {
      if (child.type === "item" && child.id === id) return child;
      if (child.type === "subsection") {
        const found = child.children.find((item) => item.id === id);
        if (found) return found;
      }
    }
  }
  return null;
}

function createCompositeComponent(kind: QuoteBuilderItemKind): QuoteBuilderCompositeItem {
  return { id: crypto.randomUUID(), kind, title: kindLabel(kind), quantity: 1, unit: kind === "main_oeuvre" ? "h" : "u", unitPriceHt: 0, vatRate: 20 };
}

function kindLabel(kind: QuoteBuilderItemKind) {
  if (kind === "main_oeuvre") return "Main d'oeuvre";
  if (kind === "sous_traitance") return "Sous-traitance";
  if (kind === "materiel") return "Matériel";
  if (kind === "divers") return "Divers";
  if (kind === "texte") return "Texte";
  if (kind === "ouvrage") return "Ouvrage";
  return "Fourniture";
}

const iconButtonClass = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50";
const secondaryButtonClass = "inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
const primaryButtonClass = "inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700";
const lineButtonClass = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700";
const inputClass = "h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300";
