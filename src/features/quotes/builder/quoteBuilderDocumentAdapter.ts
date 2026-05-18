import { calculateDocumentTotals, flattenDocumentNodes, validateBusinessDocument } from "../../document-engine";
import type { BusinessDocument, BusinessDocumentNode, DocumentItemComponent, DocumentItemKind, DocumentUnit, FlatDocumentNode } from "../../document-engine";
import type { QuoteBuilderCompositeItem, QuoteBuilderFlatRow, QuoteBuilderItem, QuoteBuilderItemKind, QuoteBuilderNode, QuoteBuilderQuote, QuoteBuilderSection, QuoteBuilderUnit } from "./types";

export function quoteBuilderToBusinessDocument(quote: QuoteBuilderQuote): BusinessDocument {
  const document: BusinessDocument = {
    id: quote.id,
    kind: "quote",
    number: quote.number,
    status: quoteStatusToDocumentStatus(quote.status),
    issueDate: quote.date,
    validityDate: quote.validUntil,
    projectId: quote.projectId,
    company: { kind: "company", displayName: "CB RENOVATION" },
    recipient: {
      id: quote.clientId ?? quote.prospectId,
      kind: quote.clientId ? "client" : "prospect",
      displayName: quote.clientName,
      address: quote.siteAddress,
    },
    siteAddress: quote.siteAddress,
    title: "Devis",
    description: quote.description,
    currency: "EUR",
    settings: {
      defaultVatRate: quote.settings.defaultVatRate,
      showUnitPrices: true,
      showVatColumn: quote.settings.showVatColumn,
      showSectionTotals: !quote.settings.hideSectionTotals,
      showCompositeDetails: !quote.settings.hideCompositeDetails,
      showInternalNotes: false,
      numberingMode: "automatic",
    },
    terms: {
      paymentTerms: quote.paymentTerms,
      legalMentions: quote.legalMentions,
      footerNotes: quote.footerNotes,
      depositPercent: quote.settings.depositPercent,
      depositAmount: null,
      paymentMethods: ["transfer"],
    },
    nodes: quoteBuilderNodesToBusinessNodes(quote.nodes),
    attachments: [],
  };
  return { ...document, totals: calculateDocumentTotals(document) };
}

export function quoteBuilderNodesToBusinessNodes(nodes: QuoteBuilderSection[]): BusinessDocumentNode[] {
  return nodes.map((section, sectionIndex) => ({
    id: section.id,
    type: "section",
    parentId: null,
    order: sectionIndex,
    title: section.title,
    collapsed: section.collapsed,
    children: section.children.map((child, childIndex) => quoteNodeToBusinessNode(child, section.id, childIndex)),
  }));
}

export function flattenQuoteBuilderWithDocumentEngine(nodes: QuoteBuilderSection[]): QuoteBuilderFlatRow[] {
  const businessNodes = quoteBuilderNodesToBusinessNodes(nodes);
  const originalById = new Map<string, QuoteBuilderNode>();
  indexQuoteNodes(nodes, originalById);

  return flattenDocumentNodes(businessNodes)
    .map((entry) => flatDocumentNodeToQuoteRow(entry, originalById.get(entry.id)))
    .filter((row): row is QuoteBuilderFlatRow => Boolean(row));
}

export function validateQuoteBuilderForDocumentEngine(quote: QuoteBuilderQuote) {
  const document = quoteBuilderToBusinessDocument(quote);
  const result = validateBusinessDocument(document);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(message || "Document devis invalide.");
  }
  return document;
}

function quoteNodeToBusinessNode(node: QuoteBuilderSubNode, parentId: string, order: number): BusinessDocumentNode {
  if (node.type === "subsection") {
    return {
      id: node.id,
      type: "subsection",
      parentId,
      order,
      title: node.title,
      collapsed: node.collapsed,
      children: node.children.map((child, childIndex) => quoteItemToBusinessNode(child, node.id, childIndex)),
    };
  }
  return quoteItemToBusinessNode(node, parentId, order);
}

function quoteItemToBusinessNode(item: QuoteBuilderItem, parentId: string, order: number): BusinessDocumentNode {
  return {
    id: item.id,
    type: item.kind === "ouvrage" ? "composite" : "line",
    parentId,
    order,
    title: item.title,
    description: item.description,
    internalNotes: item.internalNote,
    clientNotes: item.clientNote,
    kind: quoteKindToDocumentKind(item.kind),
    quantity: item.quantity,
    unit: quoteUnitToDocumentUnit(item.unit),
    unitPriceHt: item.unitPriceHt,
    vatRate: item.vatRate,
    components: item.compositeItems?.map(componentToDocumentComponent),
  };
}

function componentToDocumentComponent(component: QuoteBuilderCompositeItem): DocumentItemComponent {
  return {
    id: component.id,
    kind: quoteKindToDocumentKind(component.kind),
    title: component.title,
    quantity: component.quantity,
    unit: quoteUnitToDocumentUnit(component.unit),
    unitPriceHt: component.unitPriceHt,
    vatRate: component.vatRate,
  };
}

function flatDocumentNodeToQuoteRow(entry: FlatDocumentNode, original: QuoteBuilderNode | undefined): QuoteBuilderFlatRow | null {
  if (!original) return null;
  if (original.type !== "item") {
    return { id: original.id, number: entry.number, depth: entry.depth, parentId: entry.node.parentId, node: original, totalHt: 0, vatAmount: 0, totalTtc: 0 };
  }
  const totalHt = original.quantity * original.unitPriceHt;
  const vatAmount = totalHt * original.vatRate / 100;
  return {
    id: original.id,
    number: entry.number,
    depth: entry.depth,
    parentId: entry.node.parentId,
    node: original,
    totalHt: roundMoney(totalHt),
    vatAmount: roundMoney(vatAmount),
    totalTtc: roundMoney(totalHt + vatAmount),
  };
}

function indexQuoteNodes(nodes: QuoteBuilderSection[], map: Map<string, QuoteBuilderNode>) {
  nodes.forEach((section) => {
    map.set(section.id, section);
    section.children.forEach((child) => {
      map.set(child.id, child);
      if (child.type === "subsection") child.children.forEach((item) => map.set(item.id, item));
    });
  });
}

function quoteStatusToDocumentStatus(status: QuoteBuilderQuote["status"]): BusinessDocument["status"] {
  if (status === "accepted") return "accepted";
  if (status === "refused") return "refused";
  if (status === "sent") return "sent";
  if (status === "ready") return "ready";
  if (status === "saved") return "draft";
  return "draft";
}

function quoteKindToDocumentKind(kind: QuoteBuilderItemKind): DocumentItemKind {
  if (kind === "main_oeuvre") return "main_oeuvre";
  if (kind === "sous_traitance") return "sous_traitance";
  if (kind === "materiel") return "materiel";
  if (kind === "ouvrage") return "ouvrage";
  if (kind === "divers") return "divers";
  return "fourniture";
}

function quoteUnitToDocumentUnit(unit: QuoteBuilderUnit): DocumentUnit {
  return unit;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type QuoteBuilderSubNode = QuoteBuilderSection["children"][number];
