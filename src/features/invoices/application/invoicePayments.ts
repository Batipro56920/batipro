import { calculateDocumentTotals } from "../../document-engine";
import type { InvoicePayment, InvoiceProfitabilitySnapshot, InvoiceRecord } from "../domain/types";

export function addInvoicePayment(invoice: InvoiceRecord, payment: Omit<InvoicePayment, "id">): InvoiceRecord {
  const nextPayments = [...invoice.payments, { ...payment, id: crypto.randomUUID() }];
  return normalizeInvoiceStatus({ ...invoice, payments: nextPayments, updatedAt: new Date().toISOString() });
}

export function removeInvoicePayment(invoice: InvoiceRecord, paymentId: string): InvoiceRecord {
  return normalizeInvoiceStatus({ ...invoice, payments: invoice.payments.filter((payment) => payment.id !== paymentId), updatedAt: new Date().toISOString() });
}

export function getPaidAmount(invoice: InvoiceRecord) {
  return round(invoice.payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function getRemainingAmount(invoice: InvoiceRecord) {
  const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
  return round(Math.max(0, totals.totalTtc - getPaidAmount(invoice)));
}

export function normalizeInvoiceStatus(invoice: InvoiceRecord): InvoiceRecord {
  if (invoice.status === "cancelled") return invoice;
  const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
  const paid = getPaidAmount(invoice);
  if (totals.totalTtc > 0 && paid >= totals.totalTtc) return { ...invoice, status: "paid" };
  if (paid > 0) return { ...invoice, status: "partially_paid" };
  if (invoice.document.dueDate && new Date(invoice.document.dueDate) < new Date()) return { ...invoice, status: "overdue" };
  return invoice;
}

export function createProfitabilitySnapshot(invoice: InvoiceRecord): InvoiceProfitabilitySnapshot {
  const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
  const paid = getPaidAmount(invoice);
  return {
    invoiceId: invoice.id,
    projectId: invoice.projectId,
    chantierId: invoice.chantierId,
    soldRevenueTtc: totals.totalTtc,
    invoicedTtc: totals.totalTtc,
    paidTtc: paid,
    remainingToInvoiceTtc: 0,
    remainingToCollectTtc: round(Math.max(0, totals.totalTtc - paid)),
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
