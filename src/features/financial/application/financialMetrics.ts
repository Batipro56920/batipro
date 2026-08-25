import { calculateDocumentTotals } from "../../document-engine";
import { getPaidAmount, getRemainingAmount } from "../../invoices/application/invoicePayments";
import type { InvoiceRecord } from "../../invoices/domain/types";
import type { PurchaseOrderRecord, PurchaseOrderStatus } from "../../purchase-orders";
import type { CompanyChargeEntry } from "../../../services/companySettings.service";

export type FinancialDocumentMetrics = {
  invoicedHt: number;
  invoicedTtc: number;
  paidTtc: number;
  remainingToCollectTtc: number;
  purchasesHt: number;
  purchasesTtc: number;
  vatCollected: number;
  vatDeductible: number;
  vatBalance: number;
  documentPositionTtc: number;
  grossMarginHt: number;
  grossMarginRate: number;
};

const OPEN_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "sent",
  "confirmed",
  "partially_delivered",
];

export function buildFinancialDocumentMetrics(
  invoices: InvoiceRecord[],
  purchaseOrders: PurchaseOrderRecord[],
): FinancialDocumentMetrics {
  const issuedInvoices = invoices.filter(isIssuedInvoice);
  const collectableInvoices = issuedInvoices.filter((invoice) => invoice.type !== "credit_note");
  const committedOrders = purchaseOrders.filter(isCommittedPurchaseOrder);

  const invoicedHt = issuedInvoices.reduce(
    (sum, invoice) => sum + getInvoiceSign(invoice) * getInvoiceTotals(invoice).totalHt,
    0,
  );
  const invoicedTtc = issuedInvoices.reduce(
    (sum, invoice) => sum + getInvoiceSign(invoice) * getInvoiceTotals(invoice).totalTtc,
    0,
  );
  const paidTtc = collectableInvoices.reduce((sum, invoice) => sum + getPaidAmount(invoice), 0);
  const remainingToCollectTtc = collectableInvoices.reduce(
    (sum, invoice) => sum + getRemainingAmount(invoice),
    0,
  );
  const purchaseTotals = committedOrders.map(
    (order) => order.document.totals ?? calculateDocumentTotals(order.document),
  );
  const purchasesHt = purchaseTotals.reduce((sum, total) => sum + total.totalHt, 0);
  const purchasesTtc = purchaseTotals.reduce((sum, total) => sum + total.totalTtc, 0);
  const vatCollected = issuedInvoices.reduce(
    (sum, invoice) => sum + getInvoiceSign(invoice) * getInvoiceTotals(invoice).totalVat,
    0,
  );
  const vatDeductible = purchaseTotals.reduce((sum, total) => sum + total.totalVat, 0);
  const grossMarginHt = invoicedHt - purchasesHt;

  return {
    invoicedHt: roundMoney(invoicedHt),
    invoicedTtc: roundMoney(invoicedTtc),
    paidTtc: roundMoney(paidTtc),
    remainingToCollectTtc: roundMoney(remainingToCollectTtc),
    purchasesHt: roundMoney(purchasesHt),
    purchasesTtc: roundMoney(purchasesTtc),
    vatCollected: roundMoney(vatCollected),
    vatDeductible: roundMoney(vatDeductible),
    vatBalance: roundMoney(vatCollected - vatDeductible),
    documentPositionTtc: roundMoney(paidTtc - purchasesTtc),
    grossMarginHt: roundMoney(grossMarginHt),
    grossMarginRate: invoicedHt > 0 ? (grossMarginHt / invoicedHt) * 100 : 0,
  };
}

export function getInvoiceTotals(invoice: InvoiceRecord) {
  return invoice.document.totals ?? calculateDocumentTotals(invoice.document);
}

export function getInvoiceSign(invoice: InvoiceRecord) {
  return invoice.type === "credit_note" ? -1 : 1;
}

export function isIssuedInvoice(invoice: InvoiceRecord) {
  return !["draft", "cancelled"].includes(invoice.status);
}

export function isCommittedPurchaseOrder(order: PurchaseOrderRecord) {
  return !["draft", "cancelled"].includes(order.status);
}

export function isOpenPurchaseOrderStatus(status: PurchaseOrderStatus) {
  return OPEN_PURCHASE_ORDER_STATUSES.includes(status);
}

export function getOperatingChargeMetrics(charges: CompanyChargeEntry[]) {
  const monthly = charges
    .filter(isCurrentRecurringCharge)
    .reduce((sum, charge) => sum + monthlyChargeAmount(charge), 0);

  return {
    monthly: roundMoney(monthly),
    annual: roundMoney(monthly * 12),
  };
}

export function getBreakEvenMonthly(operatingChargesMonthly: number, grossMarginRate: number) {
  if (operatingChargesMonthly <= 0 || grossMarginRate <= 0) return null;
  return roundMoney(operatingChargesMonthly / (grossMarginRate / 100));
}

function isCurrentRecurringCharge(charge: CompanyChargeEntry) {
  if (!charge.active || charge.frequency === "one_time") return false;
  const today = getLocalDate();
  return charge.start_date <= today && (!charge.end_date || charge.end_date >= today);
}

function monthlyChargeAmount(charge: CompanyChargeEntry) {
  if (charge.frequency === "monthly") return charge.amount;
  if (charge.frequency === "quarterly") return charge.amount / 3;
  if (charge.frequency === "annual") return charge.amount / 12;
  return 0;
}

function getLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
