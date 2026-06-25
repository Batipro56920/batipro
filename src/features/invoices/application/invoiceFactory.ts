import { calculateDocumentTotals, createEmptyBusinessDocument, type BusinessDocument, type BusinessDocumentNode } from "../../document-engine";
import type { InvoiceRecord, InvoiceType } from "../domain/types";
import { addLocalDays, getLocalInputDate } from "./invoiceDates";

export function createInvoice(type: InvoiceType = "deposit", sourceQuote?: BusinessDocument): InvoiceRecord {
  const now = new Date().toISOString();
  const document = sourceQuote ? createInvoiceDocumentFromQuote(sourceQuote, type) : createEmptyInvoiceDocument(type);
  return {
    id: crypto.randomUUID(),
    type,
    status: "draft",
    document,
    sourceQuoteId: sourceQuote?.id ?? null,
    projectId: sourceQuote?.projectId ?? null,
    chantierId: sourceQuote?.chantierId ?? null,
    payments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createInvoiceDocumentFromQuote(quote: BusinessDocument, type: InvoiceType): BusinessDocument {
  const quoteTotals = quote.totals ?? calculateDocumentTotals(quote);
  const isCreditNote = type === "credit_note";
  const depositPercent = quote.terms.depositPercent ?? 30;
  const document = {
    ...quote,
    id: null,
    kind: isCreditNote ? "credit_note" as const : "invoice" as const,
    number: createInvoiceNumber(type),
    status: "draft" as const,
    title: invoiceTypeLabel(type),
    issueDate: getLocalInputDate(),
    dueDate: dueDate(30),
    quoteId: quote.id,
    terms: {
      ...quote.terms,
      paymentTerms: type === "deposit"
        ? `Facture d'acompte de ${depositPercent}% selon devis ${quote.number}.`
        : type === "final"
          ? `Facture finale selon devis ${quote.number}.`
          : type === "credit_note"
            ? `Avoir relatif au devis ${quote.number}.`
            : `Facture intermédiaire selon avancement du devis ${quote.number}.`,
      depositAmount: null,
      depositPercent: null,
    },
    totals: undefined,
  };

  if (type === "deposit") {
    document.nodes = createDepositInvoiceNodes(quote, depositPercent);
    document.description = `Acompte sur devis ${quote.number} - montant de reference ${formatCurrency(quoteTotals.totalTtc)} TTC.`;
  }

  return { ...document, totals: calculateDocumentTotals(document) };
}

function createEmptyInvoiceDocument(type: InvoiceType): BusinessDocument {
  const document = createEmptyBusinessDocument(type === "credit_note" ? "credit_note" : "invoice");
  return {
    ...document,
    number: createInvoiceNumber(type),
    title: invoiceTypeLabel(type),
    dueDate: dueDate(30),
    terms: {
      ...document.terms,
      paymentTerms: type === "deposit" ? "Acompte à régler à réception de facture." : "Paiement à réception de facture.",
    },
    totals: calculateDocumentTotals(document),
  };
}

function createDepositInvoiceNodes(quote: BusinessDocument, depositPercent: number): BusinessDocumentNode[] {
  const percent = Math.max(0, Math.min(100, depositPercent || 0));
  const nodes = quote.nodes.map((node, index) => cloneNodeForDepositInvoice(node, null, index, percent));

  if (!hasPositiveInvoiceAmount(nodes)) {
    throw new Error("Impossible de créer une facture d'acompte sans montant positif.");
  }

  return nodes;
}

function cloneNodeForDepositInvoice(node: BusinessDocumentNode, parentId: string | null, order: number, percent: number): BusinessDocumentNode {
  const id = crypto.randomUUID();
  if (node.type === "section" || node.type === "subsection") {
    return {
      ...node,
      id,
      parentId,
      order,
      children: node.children.map((child, index) => cloneNodeForDepositInvoice(child, id, index, percent)),
    };
  }

  if (node.type === "line" || node.type === "composite") {
    return {
      ...node,
      id,
      parentId,
      order,
      unitPriceHt: roundMoney(node.unitPriceHt * percent / 100),
      components: node.components?.map((component) => ({
        ...component,
        id: crypto.randomUUID(),
        unitPriceHt: roundMoney(component.unitPriceHt * percent / 100),
      })),
    };
  }

  return { ...node, id, parentId, order };
}

function hasPositiveInvoiceAmount(nodes: BusinessDocumentNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === "section" || node.type === "subsection") return hasPositiveInvoiceAmount(node.children);
    if (node.type === "line" || node.type === "composite") return node.quantity * node.unitPriceHt > 0;
    return false;
  });
}

export function invoiceTypeLabel(type: InvoiceType) {
  if (type === "deposit") return "Facture d'acompte";
  if (type === "intermediate") return "Facture intermédiaire";
  if (type === "final") return "Facture finale";
  return "Avoir";
}

function createInvoiceNumber(type: InvoiceType) {
  const prefix = type === "credit_note" ? "AV" : "FAC";
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}

function dueDate(days: number) {
  return addLocalDays(days);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}