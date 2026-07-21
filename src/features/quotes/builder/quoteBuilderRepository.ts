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
import { loadLatestCrmVisitQuoteSource, type CrmVisitQuoteSource } from "../../../services/crmVisitReports.service";
import type { CocoControlledDraft } from "../../../services/cocoDirectionAssistant.service";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../../../services/profileFeaturePermissions.service";
import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { validateQuoteBuilderForDocumentEngine } from "./quoteBuilderDocumentAdapter";
import { createQuoteBuilderFromEngine, createQuoteBuilderFromProject } from "./quoteBuilderModel";
import { applyVisitQuoteOptions } from "./quoteBuilderVisitOptions";
import type { QuoteBuilderFlatRow, QuoteBuilderQuote } from "./types";

type QuoteSaveAccess = {
  canEditPrices: boolean;
};

export async function loadQuoteBuilder(project: ProjectRecord, quoteId?: string | null): Promise<QuoteBuilderQuote> {
  const local = readLocalQuote(project.id, quoteId ?? null);
  if (local) return local;
  if (!quoteId) {
    const source = await loadLatestCrmVisitQuoteSource({
      opportunity_id: project.opportunity?.id ?? null,
      prospect_id: project.prospect?.id ?? null,
      client_id: project.client?.id ?? null,
    });
    return applyVisitQuoteOptions(createQuoteBuilderFromProject(project, source));
  }
  const engine = await loadCrmQuoteEngineData(quoteId);
  return createQuoteBuilderFromEngine(engine, project);
}

export function createQuoteBuilderFromCocoDraft(project: ProjectRecord, draft: CocoControlledDraft): QuoteBuilderQuote {
  return applyVisitQuoteOptions(createQuoteBuilderFromProject(project, cocoDraftToVisitQuoteSource(project, draft)));
}

export async function saveQuoteBuilder(quote: QuoteBuilderQuote): Promise<QuoteBuilderQuote> {
  const access = await assertQuoteBuilderSavePermission(quote);
  validateQuoteBuilderForDocumentEngine(quote);
  const totals = calculateQuoteBuilderTotals(quote);
  const saved = quote.id
    ? await updateExistingQuote(quote, totals.totalHt, access)
    : await createNewQuote(quote, totals.totalHt, totals.totalTtc, access);
  writeLocalQuote(saved);
  return saved;
}

export function saveQuoteBuilderDraft(quote: QuoteBuilderQuote) {
  writeLocalQuote(quote);
}

async function assertQuoteBuilderSavePermission(quote: QuoteBuilderQuote): Promise<QuoteSaveAccess> {
  const current = await getCurrentProfileFeaturePermissions();
  const requiredPermission = quote.id ? "crm_quote_edit" : "crm_quote_create";
  const allowed =
    hasProfileFeaturePermission(current.permissions, "crm", current.role) &&
    hasProfileFeaturePermission(current.permissions, requiredPermission, current.role);

  if (!allowed) {
    throw new Error(
      quote.id
        ? "Votre profil ne permet pas de modifier ce devis."
        : "Votre profil ne permet pas de créer un devis.",
    );
  }

  return {
    canEditPrices: hasProfileFeaturePermission(current.permissions, "crm_quote_price_edit", current.role),
  };
}

async function createNewQuote(
  quote: QuoteBuilderQuote,
  totalHt: number,
  totalTtc: number,
  access: QuoteSaveAccess,
): Promise<QuoteBuilderQuote> {
  assertQuotePricePermission(quote, null, access);
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
    waste_management: defaultWasteManagement(),
    display_options: buildDisplayOptions(quote) as any,
    acompte_percent: quote.settings.depositPercent,
  });
  removeLocalQuote(quote.projectId, null);
  const next = { ...quote, id: created.id, number: created.quote_number, status: "saved" as const };
  await persistItems(next, null);
  return next;
}

async function updateExistingQuote(
  quote: QuoteBuilderQuote,
  totalHt: number,
  access: QuoteSaveAccess,
): Promise<QuoteBuilderQuote> {
  const engine = await loadCrmQuoteEngineData(quote.id!);
  assertQuotePricePermission(quote, engine, access);
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
    waste_management: defaultWasteManagement(),
    display_options: buildDisplayOptions(quote) as any,
    acompte_percent: quote.settings.depositPercent,
  });
  await persistItems(quote, engine);
  return { ...quote, status: "saved" };
}

function buildDisplayOptions(quote: QuoteBuilderQuote) {
  return {
    site_address: quote.siteAddress,
    footer_notes: quote.footerNotes,
    work_start_date: quote.workStartDate,
    estimated_duration_value: quote.estimatedDurationValue,
    estimated_duration_unit: quote.estimatedDurationUnit,
    daily_cleaning_flat_rate_enabled: quote.settings.dailyCleaningFlatRateEnabled,
    travel_costs: quote.settings.travelCosts,
    builder_v1: true,
    project_id: quote.projectId,
  };
}

function assertQuotePricePermission(
  quote: QuoteBuilderQuote,
  original: CrmQuoteEngineData | null,
  access: QuoteSaveAccess,
) {
  if (access.canEditPrices) return;

  const originalPrices = new Map<string, number>();
  for (const item of original?.items ?? []) {
    originalPrices.set(item.id, readPersistedItemUnitPrice(item));
  }

  for (const row of flattenQuoteBuilder(quote.nodes)) {
    if (row.node.type !== "item") continue;
    const previousPrice = row.node.persistedId ? originalPrices.get(row.node.persistedId) : 0;
    const nextPrice = Number(row.node.unitPriceHt || 0);
    if (Math.abs(nextPrice - Number(previousPrice ?? 0)) > 0.009) {
      throw new Error("Votre profil ne permet pas de modifier les prix de vente du devis.");
    }
  }
}

function readPersistedItemUnitPrice(item: CrmQuoteEngineData["items"][number]): number {
  const raw = item as Record<string, unknown>;
  return Number(raw.sale_unit_price_ht ?? raw.prix_unitaire_ht ?? raw.unit_price_ht ?? 0) || 0;
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

function cocoDraftToVisitQuoteSource(project: ProjectRecord, draft: CocoControlledDraft): CrmVisitQuoteSource {
  const lines: NonNullable<CrmVisitQuoteSource["lines"]> = [];
  const sectionIdsByLot = new Map<string, string>();

  draft.quoteLines.forEach((line) => {
    const lot = cleanText(line.lot) ?? "Chiffrage COCO";
    let sectionId = sectionIdsByLot.get(lot);
    if (!sectionId) {
      sectionId = crypto.randomUUID();
      sectionIdsByLot.set(lot, sectionId);
      lines.push({ id: sectionId, type: "section", title: lot });
    }

    const quantity = positiveNumber(line.quantity) || 1;
    const unitPriceHt = line.unitPriceHt ?? (line.totalHt !== null ? line.totalHt / quantity : null);
    lines.push({
      id: crypto.randomUUID(),
      type: "task",
      parentId: sectionId,
      title: line.title,
      unit: line.unit ?? "u",
      quantity,
      priceHintHt: unitPriceHt,
      family: lot,
      libraryId: line.templateId,
      technicalNotes: compactNotes([
        line.source ? `Source COCO: ${line.source}` : null,
        line.templateTitle ? `Bibliotheque: ${line.templateTitle}` : null,
        line.estimatedHours !== null ? `Temps estime: ${line.estimatedHours.toLocaleString("fr-FR")} h` : null,
        ...line.assumptions.map((item) => `Hypothese: ${item}`),
      ]),
      constraints: compactNotes(line.pointsToVerify.map((item) => `A verifier: ${item}`)),
    });
  });

  return {
    needDescription: cleanText(project.needDescription) ?? draft.title,
    lines,
  };
}

function cleanText(value: unknown): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function compactNotes(values: Array<string | null | undefined>) {
  return values.map(cleanText).filter((value): value is string => Boolean(value)).join("\n");
}

function positiveNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function removeLocalQuote(projectId: string, quoteId: string | null) {
  localStorage.removeItem(localKey(projectId, quoteId));
}

function localKey(projectId: string, quoteId: string | null) {
  return `batipro.quote-builder.v1.${projectId}.${quoteId ?? "new"}`;
}

function defaultWasteManagement(): Record<string, unknown> {
  return { included: false };
}
