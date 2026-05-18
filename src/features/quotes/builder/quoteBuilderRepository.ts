import type { ProjectRecord } from "../../projects/types";
import {
  createCrmQuote,
  createCrmQuoteItemFromTemplate,
  deleteCrmQuoteItem,
  loadCrmQuoteEngineData,
  updateCrmQuote,
  updateCrmQuoteItem,
  type CrmQuoteEngineData,
} from "../../../services/crm.service";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { createQuoteBuilderFromEngine, createQuoteBuilderFromProject } from "./quoteBuilderModel";
import type { QuoteBuilderFlatRow, QuoteBuilderQuote } from "./types";

export async function loadQuoteBuilder(project: ProjectRecord, quoteId?: string | null): Promise<QuoteBuilderQuote> {
  const local = readLocalQuote(project.id, quoteId ?? null);
  if (local) return local;
  if (!quoteId) return createQuoteBuilderFromProject(project);
  const engine = await loadCrmQuoteEngineData(quoteId);
  return createQuoteBuilderFromEngine(engine, project);
}

export async function saveQuoteBuilder(quote: QuoteBuilderQuote): Promise<QuoteBuilderQuote> {
  const totals = calculateQuoteBuilderTotals(quote);
  const saved = quote.id ? await updateExistingQuote(quote, totals.totalHt) : await createNewQuote(quote, totals.totalHt, totals.totalTtc);
  writeLocalQuote(saved);
  return saved;
}

export function saveQuoteBuilderDraft(quote: QuoteBuilderQuote) {
  writeLocalQuote(quote);
}

async function createNewQuote(quote: QuoteBuilderQuote, totalHt: number, totalTtc: number): Promise<QuoteBuilderQuote> {
  const created = await createCrmQuote({
    quote_number: quote.number,
    client_id: quote.clientId,
    prospect_id: quote.prospectId,
    opportunity_id: quote.opportunityId,
    statut: "brouillon",
    date_emission: quote.date,
    valid_until: quote.validUntil,
    montant_ht: totalHt,
    montant_ttc: totalTtc,
    tva: quote.settings.defaultVatRate,
    description: quote.description,
    payment_terms_text: quote.paymentTerms,
    legal_mentions: { text: quote.legalMentions } as any,
    display_options: {
      site_address: quote.siteAddress,
      footer_notes: quote.footerNotes,
      work_start_date: quote.workStartDate,
      estimated_duration_value: quote.estimatedDurationValue,
      estimated_duration_unit: quote.estimatedDurationUnit,
      builder_v1: true,
      project_id: quote.projectId,
    } as any,
    acompte_percent: quote.settings.depositPercent,
  });
  const next = { ...quote, id: created.id, number: created.quote_number, status: "saved" as const };
  await persistItems(next, null);
  return next;
}

async function updateExistingQuote(quote: QuoteBuilderQuote, totalHt: number): Promise<QuoteBuilderQuote> {
  await updateCrmQuote(quote.id!, {
    quote_number: quote.number,
    client_id: quote.clientId,
    prospect_id: quote.prospectId,
    opportunity_id: quote.opportunityId,
    date_emission: quote.date,
    valid_until: quote.validUntil,
    description: quote.description,
    montant_ht: totalHt,
    tva: quote.settings.defaultVatRate,
    payment_terms_text: quote.paymentTerms,
    legal_mentions: { text: quote.legalMentions } as any,
    display_options: {
      site_address: quote.siteAddress,
      footer_notes: quote.footerNotes,
      work_start_date: quote.workStartDate,
      estimated_duration_value: quote.estimatedDurationValue,
      estimated_duration_unit: quote.estimatedDurationUnit,
      builder_v1: true,
      project_id: quote.projectId,
    } as any,
    acompte_percent: quote.settings.depositPercent,
  });
  const engine = await loadCrmQuoteEngineData(quote.id!);
  await persistItems(quote, engine);
  return { ...quote, status: "saved" };
}

async function persistItems(quote: QuoteBuilderQuote, original: CrmQuoteEngineData | null) {
  const originalIds = new Set((original?.items ?? []).map((item) => item.id));
  const nextIds = new Set<string>();
  const idMap = new Map<string, string>();

  for (const row of flattenQuoteBuilder(quote.nodes)) {
    const patch = rowToPersistence(row, quote.id!, idMap.get(row.parentId ?? "") ?? null);
    if (row.node.persistedId && originalIds.has(row.node.persistedId)) {
      await updateCrmQuoteItem(row.node.persistedId, patch);
      nextIds.add(row.node.persistedId);
      idMap.set(row.id, row.node.persistedId);
      continue;
    }
    const created = await createCrmQuoteItemFromTemplate({
      quote_id: quote.id!,
      parentItemId: patch.parent_item_id,
      lineType: patch.line_type,
      designation: patch.designation,
      description: patch.description,
      quantity: patch.quantite,
      unit: patch.unite,
      unitPriceHt: patch.sale_unit_price_ht,
      tvaRate: patch.tva_rate,
      ordre: patch.ordre,
    });
    nextIds.add(created.id);
    idMap.set(row.id, created.id);
  }

  for (const item of original?.items ?? []) {
    if (!nextIds.has(item.id)) await deleteCrmQuoteItem(item.id, quote.id!);
  }
}

function rowToPersistence(row: QuoteBuilderFlatRow, quoteId: string, parentItemId: string | null) {
  const base = {
    quote_id: quoteId,
    parent_item_id: parentItemId,
    designation: row.node.title,
    description: "",
    ordre: Number(row.number.replace(/\./g, "")) || 0,
    line_type: row.node.type === "section" ? "section" : row.node.type === "subsection" ? "subsection" : row.node.kind,
    quantite: 0,
    unite: null as string | null,
    sale_unit_price_ht: 0,
    prix_unitaire_ht: 0,
    total_ht: 0,
    sale_total_ht: 0,
    tva_rate: 0,
    technical_description: "",
  };
  if (row.node.type !== "item") return base;
  return {
    ...base,
    description: row.node.description ?? row.node.clientNote ?? "",
    quantite: row.node.quantity,
    unite: row.node.unit,
    sale_unit_price_ht: row.node.unitPriceHt,
    prix_unitaire_ht: row.node.unitPriceHt,
    total_ht: row.totalHt,
    sale_total_ht: row.totalHt,
    tva_rate: row.node.vatRate,
    technical_description: row.node.internalNote ?? "",
  };
}

function readLocalQuote(projectId: string, quoteId: string | null): QuoteBuilderQuote | null {
  const raw = localStorage.getItem(localKey(projectId, quoteId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuoteBuilderQuote;
  } catch {
    return null;
  }
}

function writeLocalQuote(quote: QuoteBuilderQuote) {
  localStorage.setItem(localKey(quote.projectId, quote.id), JSON.stringify(quote));
}

function localKey(projectId: string, quoteId: string | null) {
  return `batipro.quote-builder.v1.${projectId}.${quoteId ?? "new"}`;
}
