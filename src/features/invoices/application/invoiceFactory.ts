import { calculateDocumentTotals, createEmptyBusinessDocument, type BusinessDocument, type BusinessDocumentNode } from "../../document-engine";
import type { InvoiceRecord, InvoiceType } from "../domain/types";
import { normalizeInvoiceElectronicInvoicing } from "./electronicInvoicing";
import { addLocalDays, getLocalInputDate } from "./invoiceDates";

export type InvoiceCreationOptions = {
  alreadyInvoicedTtc?: number;
};

export function createInvoice(
  type: InvoiceType = "deposit",
  sourceQuote?: BusinessDocument,
  options: InvoiceCreationOptions = {},
): InvoiceRecord {
  const now = new Date().toISOString();
  const document = sourceQuote
    ? createInvoiceDocumentFromQuote(sourceQuote, type, options)
    : createEmptyInvoiceDocument(type);
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

export function createInvoiceDocumentFromQuote(
  quote: BusinessDocument,
  type: InvoiceType,
  options: InvoiceCreationOptions = {},
): BusinessDocument {
  const quoteTotals = quote.totals ?? calculateDocumentTotals(quote);
  const isCreditNote = type === "credit_note";
  const depositPercent = quote.terms.depositPercent ?? 30;
  const alreadyInvoicedTtc = Math.max(0, Number(options.alreadyInvoicedTtc ?? 0));
  const remainingTtc = Math.max(0, quoteTotals.totalTtc - alreadyInvoicedTtc);
  const finalBalancePercent = quoteTotals.totalTtc > 0 ? remainingTtc / quoteTotals.totalTtc * 100 : 0;

  if (type === "final" && alreadyInvoicedTtc > 0 && remainingTtc <= 0.009) {
    throw new Error("Ce devis est déjà entièrement facturé. Annulez ou corrigez une facture existante avant de créer la finale.");
  }

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
    electronicInvoicing: normalizeInvoiceElectronicInvoicing(quote.electronicInvoicing, quote),
    terms: {
      ...quote.terms,
      paymentTerms: type === "deposit"
        ? `Facture d'acompte de ${depositPercent}% selon devis ${quote.number}.`
        : type === "final"
          ? alreadyInvoicedTtc > 0
            ? `Facture finale de solde selon devis ${quote.number}, après déduction des factures précédentes.`
            : `Facture finale selon devis ${quote.number}.`
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

  if (type === "final" && alreadyInvoicedTtc > 0) {
    document.nodes = quote.nodes.map((node, index) => cloneNodeWithPercentage(node, null, index, finalBalancePercent));
    document.description = `Solde du devis ${quote.number} - déjà facturé ${formatCurrency(alreadyInvoicedTtc)} TTC sur ${formatCurrency(quoteTotals.totalTtc)} TTC.`;
  }

  return { ...document, totals: calculateDocumentTotals(document) };
}

function createEmptyInvoiceDocument(type: InvoiceType): BusinessDocument {
  const document = createEmptyBusinessDocument(type === "credit_note" ? "credit_note" : "invoice");
  const nextDocument = {
    ...document,
    number: createInvoiceNumber(type),
    title: invoiceTypeLabel(type),
    dueDate: dueDate(30),
    electronicInvoicing: normalizeInvoiceElectronicInvoicing(document.electronicInvoicing, document),
    terms: {
      ...document.terms,
      paymentTerms: type === "deposit" ? "Acompte à régler à réception de facture." : "Paiement à réception de facture.",
    },
  };
  return {
    ...nextDocument,
    totals: calculateDocumentTotals(nextDocument),
  };
}

function createDepositInvoiceNodes(quote: BusinessDocument, depositPercent: number): BusinessDocumentNode[] {
  const percent = Math.max(0, Math.min(100, depositPercent || 0));
  const nodes = quote.nodes.map((node, index) => cloneNodeWithPercentage(node, null, index, percent));

  if (!hasPositiveInvoiceAmount(nodes)) {
    throw new Error("Impossible de créer une facture d'acompte sans montant positif.");
  }

  return nodes;
}

function cloneNodeWithPercentage(node: BusinessDocumentNode, parentId: string | null, order: number, percent: number): BusinessDocumentNode {
  const id = crypto.randomUUID();
  if (node.type === "section" || node.type === "subsection") {
    return {
      ...node,
      id,
      parentId,
      order,
      children: node.children.map((child, index) => cloneNodeWithPercentage(child, id, index, percent)),
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
