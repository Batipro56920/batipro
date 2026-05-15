import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuoteWorkspace } from "../features/quotes/components/QuoteWorkspace";
import { useQuoteStore } from "../features/quotes/store/quoteStore";
import type { QuoteDraft, QuoteLine, QuoteLineKind, QuoteVatRate } from "../features/quotes/types";
import {
  createCrmQuoteItemFromTemplate,
  deleteCrmQuoteItem,
  loadCrmDataset,
  loadCrmQuoteEngineData,
  updateCrmQuote,
  updateCrmQuoteItem,
  type CrmClientRow,
  type CrmDataset,
  type CrmProspectRow,
  type CrmQuoteEngineData,
  type CrmQuoteItemRow,
} from "../services/crm.service";
import type { TaskTemplateRow } from "../services/taskLibrary.service";

const EMPTY_DATASET: CrmDataset = {
  prospects: [],
  clients: [],
  opportunities: [],
  quotes: [],
  tasks: [],
  appointments: [],
  sav: [],
  stages: [],
  documents: [],
  communications: [],
  invoices: [],
  purchases: [],
  chantiers: [],
  taskTemplates: [],
};

export default function CrmQuoteWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const draft = useQuoteStore((state) => state.draft);
  const replaceDraft = useQuoteStore((state) => state.replaceDraft);
  const addLine = useQuoteStore((state) => state.addLine);
  const markSaved = useQuoteStore((state) => state.markSaved);
  const [dataset, setDataset] = useState<CrmDataset>(EMPTY_DATASET);
  const [engine, setEngine] = useState<CrmQuoteEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [nextDataset, nextEngine] = await Promise.all([loadCrmDataset(), loadCrmQuoteEngineData(id)]);
      setDataset(nextDataset);
      setEngine(nextEngine);
      replaceDraft(mapEngineToDraft(nextEngine, resolveAccount(nextDataset, nextEngine)));
    } catch (err: any) {
      setError(err?.message ?? "Chargement du devis impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [id]);

  const persistedIds = useMemo(() => new Set(engine?.items.map((item) => item.id) ?? []), [engine?.items]);

  function insertTemplate(template: TaskTemplateRow) {
    addLine({
      id: crypto.randomUUID(),
      persisted: false,
      parentId: null,
      kind: "composite",
      designation: template.titre,
      quantity: template.quantite_defaut ?? 1,
      unit: template.unite ?? "u",
      unitPriceHt: template.cout_reference_unitaire_ht ?? 0,
      vatRate: 20,
      purchaseCostHt: template.cout_reference_unitaire_ht ?? 0,
      order: draft.lines.length + 1,
      reference: template.id,
    });
  }

  async function save() {
    if (!engine) return;
    setSaving(true);
    setError(null);
    try {
      await updateCrmQuote(engine.quote.id, {
        quote_number: draft.quoteNumber,
        description: draft.projectDescription,
      });

      for (const line of draft.lines) {
        if (line.persisted && persistedIds.has(line.id)) {
          await updateCrmQuoteItem(line.id, mapLineToQuoteItemPatch(line));
        } else {
          const template = line.reference ? dataset.taskTemplates.find((item) => item.id === line.reference) ?? null : null;
          await createCrmQuoteItemFromTemplate({
            quote_id: engine.quote.id,
            template,
            lineType: line.kind,
            designation: line.designation,
            quantity: line.quantity,
            unit: line.unit,
            unitPriceHt: line.unitPriceHt,
            tvaRate: line.vatRate,
            ordre: line.order,
          });
        }
      }

      for (const oldItem of engine.items) {
        if (!draft.lines.some((line) => line.persisted && line.id === oldItem.id)) {
          await deleteCrmQuoteItem(oldItem.id, engine.quote.id);
        }
      }

      markSaved();
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Sauvegarde impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    if (!engine) return;
    await save();
    await updateCrmQuote(engine.quote.id, { statut: "envoye", sent_at: new Date().toISOString() } as any);
    await refresh();
  }

  if (loading) {
    return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du workspace devis...</div>;
  }

  if (!engine) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Devis introuvable."}</div>;
  }

  return (
    <>
      {error ? <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <QuoteWorkspace
        templates={dataset.taskTemplates}
        saving={saving}
        onClose={() => navigate("/crm/devis")}
        onSave={save}
        onSend={send}
        onInsertTemplate={insertTemplate}
      />
    </>
  );
}

function resolveAccount(dataset: CrmDataset, engine: CrmQuoteEngineData): CrmClientRow | CrmProspectRow | null {
  return (
    dataset.clients.find((client) => client.id === engine.quote.client_id) ??
    dataset.prospects.find((prospect) => prospect.id === engine.quote.prospect_id) ??
    null
  );
}

function mapEngineToDraft(engine: CrmQuoteEngineData, account: CrmClientRow | CrmProspectRow | null): QuoteDraft {
  return {
    id: engine.quote.id,
    quoteNumber: engine.quote.quote_number,
    status: engine.quote.statut === "envoye" ? "sent" : engine.quote.statut === "accepte" ? "signed" : engine.quote.statut === "refuse" ? "refused" : "saved",
    clientName: entityLabel(account),
    projectAddress: [account?.adresse, account?.code_postal, account?.ville].filter(Boolean).join(" "),
    projectDescription: engine.quote.description ?? "",
    validUntil: engine.quote.valid_until ?? "",
    lines: engine.items.map(mapQuoteItemToLine),
  };
}

function mapQuoteItemToLine(item: CrmQuoteItemRow): QuoteLine {
  return {
    id: item.id,
    persisted: true,
    parentId: item.parent_item_id,
    kind: normalizeKind(item.line_type),
    designation: item.designation,
    quantity: Number(item.quantite ?? 0),
    unit: item.unite ?? "u",
    unitPriceHt: Number(item.sale_unit_price_ht ?? item.prix_unitaire_ht ?? 0),
    vatRate: normalizeVat(item.tva_rate),
    purchaseCostHt: Number(item.cost_materials_ht ?? 0) + Number(item.cost_labor_ht ?? 0) + Number(item.cost_subcontracting_ht ?? 0) + Number(item.cost_fees_ht ?? 0),
    order: Number(item.ordre ?? 0),
    reference: item.task_template_id,
  };
}

function mapLineToQuoteItemPatch(line: QuoteLine): Partial<CrmQuoteItemRow> {
  return {
    designation: line.designation,
    quantite: line.quantity,
    unite: line.unit,
    prix_unitaire_ht: line.unitPriceHt,
    sale_unit_price_ht: line.unitPriceHt,
    total_ht: line.quantity * line.unitPriceHt,
    sale_total_ht: line.quantity * line.unitPriceHt,
    tva_rate: line.vatRate,
    line_type: line.kind,
    ordre: line.order,
  };
}

function normalizeKind(value: string | null | undefined): QuoteLineKind {
  const allowed: QuoteLineKind[] = ["section", "subsection", "text", "page_break", "material", "labor", "subcontracting", "equipment", "misc", "composite"];
  return allowed.includes(value as QuoteLineKind) ? (value as QuoteLineKind) : "simple" as QuoteLineKind;
}

function normalizeVat(value: number | null | undefined): QuoteVatRate {
  if (value === 0 || value === 5.5 || value === 10 || value === 20) return value;
  return 20;
}

function entityLabel(row: Pick<CrmProspectRow | CrmClientRow, "prenom" | "nom" | "societe" | "email"> | null | undefined) {
  if (!row) return "";
  return [row.prenom, row.nom].filter(Boolean).join(" ") || row.societe || row.email || "";
}
