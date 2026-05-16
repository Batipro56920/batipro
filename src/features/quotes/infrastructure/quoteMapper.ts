import { withTotals } from "../application/quoteEngine";
import { flattenForPersistence } from "../application/quoteEngine";
import type { Quote, QuoteAccountOption, QuoteProjectOption } from "../domain/Quote";
import type { QuoteLineKind, QuoteStatus, QuoteVatRate } from "../domain/QuoteEnums";
import type { QuoteLineNode, QuotePageBreakNode, QuoteTextNode } from "../domain/QuoteLine";
import type { QuoteNode, QuoteSectionNode, QuoteSubsectionNode } from "../domain/QuoteSection";
import { DEFAULT_QUOTE_SETTINGS } from "../domain/QuoteSettings";
import type { CrmClientRow, CrmDataset, CrmProspectRow, CrmQuoteEngineData, CrmQuoteItemRow, CrmQuoteRow } from "../../../services/crm.service";

export function mapEngineToQuote(engine: CrmQuoteEngineData, dataset: CrmDataset): Quote {
  const account = resolveAccount(dataset, engine.quote);
  const displayOptions = (engine.quote.display_options ?? {}) as Record<string, unknown>;
  const legalMentions = (engine.quote.legal_mentions ?? {}) as Record<string, unknown>;
  const wasteManagement = (engine.quote.waste_management ?? {}) as Record<string, unknown>;

  return withTotals({
    id: engine.quote.id,
    number: engine.quote.quote_number,
    date: engine.quote.date_emission ?? new Date().toISOString().slice(0, 10),
    validityDate: engine.quote.valid_until,
    workStartDate: stringOrNull(displayOptions.work_start_date),
    estimatedDuration: stringOrNull(displayOptions.estimated_duration),
    salespersonId: stringOrNull(displayOptions.salesperson_id),
    clientId: engine.quote.client_id,
    prospectId: engine.quote.prospect_id,
    projectId: engine.quote.chantier_id,
    clientName: entityLabel(account),
    siteAddress: String(displayOptions.site_address ?? displayOptions.project_address ?? accountAddress(account)),
    description: engine.quote.description ?? "",
    paymentTerms: engine.quote.payment_terms_text ?? engine.quote.conditions ?? "30% a la signature, solde selon avancement et reception des travaux.",
    legalMentions: String(legalMentions.text ?? "Devis valable selon la date indiquee. Travaux soumis aux conditions generales de l'entreprise."),
    wasteManagement: String(wasteManagement.text ?? "Gestion des dechets selon la reglementation applicable."),
    footerNotes: String(displayOptions.footer_notes ?? ""),
    status: mapCrmStatus(engine.quote.statut),
    settings: {
      ...DEFAULT_QUOTE_SETTINGS,
      defaultVatRate: normalizeVat(Number(displayOptions.default_vat_rate ?? engine.quote.tva ?? 20)),
      defaultDepositPercent: Number(engine.quote.acompte_percent ?? DEFAULT_QUOTE_SETTINGS.defaultDepositPercent),
      showMargins: bool(displayOptions.show_margins, DEFAULT_QUOTE_SETTINGS.showMargins),
      showReferences: bool(displayOptions.show_references, DEFAULT_QUOTE_SETTINGS.showReferences),
      showVatColumn: bool(displayOptions.show_vat_column, DEFAULT_QUOTE_SETTINGS.showVatColumn),
      showQuantityColumns: bool(displayOptions.show_quantity_columns, DEFAULT_QUOTE_SETTINGS.showQuantityColumns),
      hideCompositeDetails: bool(displayOptions.hide_composite_details, DEFAULT_QUOTE_SETTINGS.hideCompositeDetails),
      showVatCertificate: bool(displayOptions.show_vat_certificate, DEFAULT_QUOTE_SETTINGS.showVatCertificate),
      showWasteManagement: bool(displayOptions.show_waste_management, DEFAULT_QUOTE_SETTINGS.showWasteManagement),
      customNumbering: bool(displayOptions.custom_numbering, DEFAULT_QUOTE_SETTINGS.customNumbering),
    },
    nodes: mapItemsToNodes(engine.items),
    totals: {
      sellHt: 0,
      vat: 0,
      ttc: 0,
      dryCostHt: 0,
      marginHt: 0,
      marginRate: 0,
      depositAmountTtc: 0,
      remainingToInvoiceTtc: 0,
      vatBreakdown: [],
    },
  });
}

export function mapQuoteToQuotePatch(quote: Quote): Partial<CrmQuoteRow> {
  return {
    quote_number: quote.number,
    client_id: quote.clientId,
    prospect_id: quote.prospectId,
    chantier_id: quote.projectId,
    date_emission: quote.date,
    valid_until: quote.validityDate,
    description: quote.description,
    acompte_percent: quote.settings.defaultDepositPercent,
    payment_terms_text: quote.paymentTerms,
    legal_mentions: { text: quote.legalMentions } as any,
    waste_management: { text: quote.wasteManagement } as any,
    display_options: {
      site_address: quote.siteAddress,
      footer_notes: quote.footerNotes,
      default_vat_rate: quote.settings.defaultVatRate,
      show_margins: quote.settings.showMargins,
      show_references: quote.settings.showReferences,
      show_vat_column: quote.settings.showVatColumn,
      show_quantity_columns: quote.settings.showQuantityColumns,
      hide_composite_details: quote.settings.hideCompositeDetails,
      show_vat_certificate: quote.settings.showVatCertificate,
      show_waste_management: quote.settings.showWasteManagement,
      custom_numbering: quote.settings.customNumbering,
      work_start_date: quote.workStartDate,
      estimated_duration: quote.estimatedDuration,
      salesperson_id: quote.salespersonId,
    } as any,
  };
}

export function mapQuoteNodeToItemPatch(node: QuoteNode, quoteId: string, order: number): Partial<CrmQuoteItemRow> & { quote_id: string } {
  const base = {
    quote_id: quoteId,
    designation: node.title,
    ordre: order,
    line_type: nodeTypeToDb(node),
    quantite: 0,
    unite: null,
    prix_unitaire_ht: 0,
    sale_unit_price_ht: 0,
    total_ht: 0,
    sale_total_ht: 0,
    tva_rate: 0,
  };

  if (node.type === "line") {
    const total = node.quantity * node.saleUnitPriceHt;
    return {
      ...base,
      designation: node.title,
      quantite: node.quantity,
      unite: node.unit,
      prix_unitaire_ht: node.saleUnitPriceHt,
      sale_unit_price_ht: node.saleUnitPriceHt,
      total_ht: total,
      sale_total_ht: total,
      tva_rate: node.vatRate,
      task_template_id: node.reference,
      cost_materials_ht: node.purchaseUnitPriceHt,
    };
  }

  if (node.type === "composite") {
    const saleUnit = node.components.reduce((sum, component) => sum + component.quantity * component.saleUnitPriceHt, 0);
    const purchaseUnit = node.components.reduce((sum, component) => sum + component.quantity * component.purchaseUnitPriceHt, 0);
    return {
      ...base,
      quantite: node.quantity,
      unite: node.unit,
      prix_unitaire_ht: saleUnit,
      sale_unit_price_ht: saleUnit,
      total_ht: saleUnit * node.quantity,
      sale_total_ht: saleUnit * node.quantity,
      tva_rate: node.vatRate,
      task_template_id: node.reference,
      cost_materials_ht: purchaseUnit,
    };
  }

  if (node.type === "text") return { ...base, description: node.content };
  return base;
}

export function flattenQuoteForPersistence(quote: Quote) {
  return flattenForPersistence(quote);
}

export function mapDatasetToOptions(dataset: CrmDataset) {
  return {
    clients: dataset.clients.map(mapAccountOption),
    prospects: dataset.prospects.map(mapAccountOption),
    projects: dataset.chantiers.map(
      (row): QuoteProjectOption => ({
        id: row.id,
        label: row.nom,
        clientName: row.client ?? "",
        address: row.adresse ?? "",
        clientId: row.crm_client_id ?? null,
        prospectId: row.crm_prospect_id ?? null,
      }),
    ),
  };
}

function mapItemsToNodes(items: CrmQuoteItemRow[]): QuoteNode[] {
  const roots: QuoteNode[] = [];
  let currentSection: QuoteSectionNode | null = null;
  let currentSubsection: QuoteSubsectionNode | null = null;

  for (const item of [...items].sort((a, b) => Number(a.ordre ?? 0) - Number(b.ordre ?? 0))) {
    const node = mapItemToNode(item);
    if (node.type === "section") {
      roots.push(node);
      currentSection = node;
      currentSubsection = null;
      continue;
    }
    if (node.type === "subsection") {
      if (currentSection) currentSection.children.push(node);
      else roots.push(node);
      currentSubsection = node;
      continue;
    }
    if (currentSubsection) currentSubsection.children.push(node);
    else if (currentSection) currentSection.children.push(node);
    else roots.push(node);
  }

  return reindexNodes(roots);
}

function mapItemToNode(item: CrmQuoteItemRow): QuoteNode {
  const base = {
    id: item.id,
    persistedId: item.id,
    parentId: item.parent_item_id,
    title: item.designation,
    order: Number(item.ordre ?? 0),
  };
  const type = dbLineTypeToNodeType(item.line_type);
  if (type === "section") return { ...base, type, children: [] };
  if (type === "subsection") return { ...base, type, children: [] };
  if (type === "text") return { ...base, type, content: item.description ?? item.designation } satisfies QuoteTextNode;
  if (type === "pagebreak") return { ...base, type } satisfies QuotePageBreakNode;
  if (type === "composite") {
    return {
      ...base,
      type,
      quantity: Number(item.quantite ?? 1),
      unit: item.unite ?? "u",
      vatRate: normalizeVat(item.tva_rate),
      reference: item.task_template_id,
      pricingMode: "margin",
      targetMarginRate: Number(item.margin_rate ?? 25),
      fixedSellingPriceHt: null,
      components: [],
    };
  }
  return {
    ...base,
    type: "line",
    kind: dbLineTypeToLineKind(item.line_type),
    quantity: Number(item.quantite ?? 1),
    unit: item.unite ?? "u",
    saleUnitPriceHt: Number(item.sale_unit_price_ht ?? item.prix_unitaire_ht ?? 0),
    purchaseUnitPriceHt: Number(item.cost_materials_ht ?? 0) + Number(item.cost_labor_ht ?? 0) + Number(item.cost_subcontracting_ht ?? 0) + Number(item.cost_fees_ht ?? 0),
    vatRate: normalizeVat(item.tva_rate),
    reference: item.task_template_id,
  } satisfies QuoteLineNode;
}

function reindexNodes(nodes: QuoteNode[]): QuoteNode[] {
  return nodes.map((node, index) => {
    if (node.type === "section" || node.type === "subsection") return { ...node, order: index + 1, children: reindexNodes(node.children) };
    return { ...node, order: index + 1 };
  });
}

function nodeTypeToDb(node: QuoteNode): string {
  if (node.type === "section") return "section";
  if (node.type === "subsection") return "subsection";
  if (node.type === "text") return "text";
  if (node.type === "pagebreak") return "page_break";
  if (node.type === "composite") return "composite";
  return lineKindToDb(node.kind);
}

function dbLineTypeToNodeType(value: string | null | undefined): QuoteNode["type"] {
  if (value === "section") return "section";
  if (value === "subsection" || value === "sous_section") return "subsection";
  if (value === "text" || value === "texte") return "text";
  if (value === "page_break" || value === "saut_page") return "pagebreak";
  if (value === "composite" || value === "ouvrage") return "composite";
  return "line";
}

function dbLineTypeToLineKind(value: string | null | undefined): QuoteLineKind {
  if (value === "labor" || value === "main_oeuvre") return "main_oeuvre";
  if (value === "subcontracting" || value === "sous_traitance") return "sous_traitance";
  if (value === "equipment" || value === "materiel") return "materiel";
  if (value === "misc" || value === "divers") return "divers";
  return "fourniture";
}

function lineKindToDb(kind: QuoteLineKind): string {
  if (kind === "main_oeuvre") return "labor";
  if (kind === "sous_traitance") return "subcontracting";
  if (kind === "materiel") return "equipment";
  if (kind === "divers") return "misc";
  return "material";
}

function mapCrmStatus(value: string): QuoteStatus {
  if (value === "envoye") return "sent";
  if (value === "accepte") return "signed";
  if (value === "refuse") return "refused";
  if (value === "expire") return "expired";
  if (value === "annule") return "cancelled";
  return "saved";
}

function normalizeVat(value: number | null | undefined): QuoteVatRate {
  if (value === 0 || value === 5.5 || value === 10 || value === 20) return value;
  return 20;
}

function resolveAccount(dataset: CrmDataset, quote: CrmQuoteRow): CrmClientRow | CrmProspectRow | null {
  return dataset.clients.find((client) => client.id === quote.client_id) ?? dataset.prospects.find((prospect) => prospect.id === quote.prospect_id) ?? null;
}

function mapAccountOption(row: CrmClientRow | CrmProspectRow): QuoteAccountOption {
  return {
    id: row.id,
    label: entityLabel(row) || "Sans nom",
    address: accountAddress(row),
    phone: row.telephone ?? row.mobile ?? null,
    email: row.email,
  };
}

function entityLabel(row: Pick<CrmProspectRow | CrmClientRow, "prenom" | "nom" | "societe" | "email"> | null | undefined) {
  if (!row) return "";
  return [row.prenom, row.nom].filter(Boolean).join(" ") || row.societe || row.email || "";
}

function accountAddress(row: Pick<CrmProspectRow | CrmClientRow, "adresse" | "code_postal" | "ville"> | null | undefined) {
  return [row?.adresse, row?.code_postal, row?.ville].filter(Boolean).join(" ");
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
