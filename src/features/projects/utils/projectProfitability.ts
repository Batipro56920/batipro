import { calculateDocumentTotals } from "../../document-engine";
import { getPaidAmount } from "../../invoices/application/invoicePayments";
import type { InvoiceRecord } from "../../invoices/domain/types";
import { listInvoices } from "../../invoices/infrastructure/invoiceRepository";
import type { PurchaseOrderRecord } from "../../purchase-orders/domain/types";
import { listPurchaseOrders } from "../../purchase-orders/infrastructure/purchaseOrderRepository";
import type { ProjectRecord } from "../types";

export type ProjectProfitabilityMetrics = {
  soldAmountHt: number;
  soldAmountTtc: number;
  invoicedTtc: number;
  paidTtc: number;
  remainingToInvoiceTtc: number;
  remainingToCollectTtc: number;
  purchasesHt: number;
  laborHt: number;
  grossMarginHt: number;
  marginRate: number;
  billingProgress: number;
  paymentProgress: number;
  marginProgress: number;
  acceptedQuoteNumber: string | null;
  invoiceCount: number;
  dataMode: "real" | "mixed" | "estimated";
};

export function buildProjectProfitability(project: ProjectRecord): ProjectProfitabilityMetrics {
  const acceptedQuote = project.quotes.find((quote) => quote.statut === "accepte") ?? null;
  const quoteSource = acceptedQuote ?? project.quotes[0] ?? null;
  const soldAmountHt = positiveNumber(acceptedQuote?.montant_ht ?? quoteSource?.montant_ht ?? estimateHt(project));
  const soldAmountTtc = positiveNumber(acceptedQuote?.montant_ttc ?? quoteSource?.montant_ttc ?? project.quoteAmount ?? soldAmountHt * 1.2);
  const invoices = findProjectInvoices(project);
  const invoicedTtc = round(invoices.reduce((sum, invoice) => sum + invoiceTotalTtc(invoice), 0));
  const paidTtc = round(invoices.reduce((sum, invoice) => sum + getPaidAmount(invoice), 0));
  const purchaseOrders = findProjectPurchaseOrders(project);
  const purchaseOrdersHt = round(purchaseOrders.reduce((sum, order) => sum + purchaseOrderTotalHt(order), 0));
  const productionCosts = getProductionCosts(project, soldAmountHt, purchaseOrdersHt);
  const grossMarginHt = round(soldAmountHt - productionCosts.purchasesHt - productionCosts.laborHt);
  const marginRate = soldAmountHt > 0 ? round((grossMarginHt / soldAmountHt) * 100) : 0;
  const hasRealFinancialData = Boolean(acceptedQuote || invoices.length || productionCosts.hasRealCosts);

  return {
    soldAmountHt,
    soldAmountTtc,
    invoicedTtc,
    paidTtc,
    remainingToInvoiceTtc: round(Math.max(0, soldAmountTtc - invoicedTtc)),
    remainingToCollectTtc: round(Math.max(0, invoicedTtc - paidTtc)),
    purchasesHt: productionCosts.purchasesHt,
    laborHt: productionCosts.laborHt,
    grossMarginHt,
    marginRate,
    billingProgress: progress(invoicedTtc, soldAmountTtc),
    paymentProgress: progress(paidTtc, invoicedTtc || soldAmountTtc),
    marginProgress: Math.max(0, Math.min(100, marginRate)),
    acceptedQuoteNumber: acceptedQuote?.quote_number ?? null,
    invoiceCount: invoices.length,
    dataMode: hasRealFinancialData ? (productionCosts.hasEstimatedCosts ? "mixed" : "real") : "estimated",
  };
}

function findProjectInvoices(project: ProjectRecord) {
  const quoteIds = new Set(project.quotes.map((quote) => quote.id));
  return safeListInvoices().filter((invoice) => {
    if (invoice.projectId === project.id || invoice.document.projectId === project.id) return true;
    if (invoice.sourceQuoteId && quoteIds.has(invoice.sourceQuoteId)) return true;
    if (invoice.document.quoteId && quoteIds.has(invoice.document.quoteId)) return true;
    return false;
  });
}

function safeListInvoices(): InvoiceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return listInvoices();
  } catch {
    return [];
  }
}

function findProjectPurchaseOrders(project: ProjectRecord) {
  const chantierIds = new Set(project.chantiers.map((chantier) => chantier.id));
  return safeListPurchaseOrders().filter((order) => {
    if (order.projectId === project.id || order.document.projectId === project.id) return true;
    if (order.chantierId && chantierIds.has(order.chantierId)) return true;
    if (order.document.chantierId && chantierIds.has(order.document.chantierId)) return true;
    return false;
  });
}

function safeListPurchaseOrders(): PurchaseOrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return listPurchaseOrders();
  } catch {
    return [];
  }
}

function invoiceTotalTtc(invoice: InvoiceRecord) {
  const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
  return totals.totalTtc;
}

function purchaseOrderTotalHt(order: PurchaseOrderRecord) {
  const totals = order.document.totals ?? calculateDocumentTotals(order.document);
  return totals.totalHt;
}

function getProductionCosts(project: ProjectRecord, soldAmountHt: number, purchaseOrdersHt: number) {
  const chantierCosts = project.chantiers.reduce(
    (sum, chantier) => ({
      purchasesHt: sum.purchasesHt + positiveNumber(chantier.budget_materials_planned_ht) + positiveNumber(chantier.budget_subcontracting_planned_ht),
      laborHt: sum.laborHt + positiveNumber(chantier.budget_labor_planned_ht),
    }),
    { purchasesHt: 0, laborHt: 0 },
  );

  const purchasesHt = purchaseOrdersHt || chantierCosts.purchasesHt;
  const hasRealCosts = purchasesHt > 0 || chantierCosts.laborHt > 0;
  if (hasRealCosts) {
    return { purchasesHt, laborHt: chantierCosts.laborHt, hasRealCosts: true, hasEstimatedCosts: chantierCosts.laborHt <= 0 };
  }

  if (soldAmountHt <= 0) {
    return { purchasesHt: 0, laborHt: 0, hasRealCosts: false, hasEstimatedCosts: false };
  }

  return {
    purchasesHt: round(soldAmountHt * 0.32),
    laborHt: round(soldAmountHt * 0.24),
    hasRealCosts: false,
    hasEstimatedCosts: true,
  };
}

function estimateHt(project: ProjectRecord) {
  const source = project.budgetEstimate ?? project.quoteAmount ?? 0;
  return source > 0 ? source / 1.2 : 0;
}

function positiveNumber(value: number | null | undefined) {
  return Number.isFinite(value) && value && value > 0 ? value : 0;
}

function progress(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
