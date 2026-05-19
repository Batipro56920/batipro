import { calculateDocumentTotals, createEmptyBusinessDocument, type BusinessDocument } from "../../document-engine";
import type { InvoiceRecord, InvoiceType } from "../domain/types";

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
  const document = {
    ...quote,
    id: null,
    kind: isCreditNote ? "credit_note" as const : "invoice" as const,
    number: createInvoiceNumber(type),
    status: "draft" as const,
    title: invoiceTypeLabel(type),
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: dueDate(30),
    quoteId: quote.id,
    terms: {
      ...quote.terms,
      paymentTerms: type === "deposit"
        ? `Facture d'acompte de ${quote.terms.depositPercent ?? 30}% selon devis ${quote.number}.`
        : type === "final"
          ? `Facture finale selon devis ${quote.number}.`
          : type === "credit_note"
            ? `Avoir relatif au devis ${quote.number}.`
            : `Facture intermediaire selon avancement du devis ${quote.number}.`,
      depositAmount: null,
      depositPercent: type === "deposit" ? quote.terms.depositPercent ?? 30 : null,
    },
    totals: undefined,
  };

  if (type === "deposit") {
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

export function invoiceTypeLabel(type: InvoiceType) {
  if (type === "deposit") return "Facture d'acompte";
  if (type === "intermediate") return "Facture intermediaire";
  if (type === "final") return "Facture finale";
  return "Avoir";
}

function createInvoiceNumber(type: InvoiceType) {
  const prefix = type === "credit_note" ? "AV" : "FAC";
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}

function dueDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
