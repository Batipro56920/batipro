import { calculateDocumentTotals } from "../../document-engine";
import type { InvoicePayment, InvoiceProfitabilitySnapshot, InvoiceRecord } from "../domain/types";
import { isBeforeLocalToday } from "./invoiceDates";

export function addInvoicePayment(invoice: InvoiceRecord, payment: Omit<InvoicePayment, "id">): InvoiceRecord {
  const blockingReason = getInvoicePaymentBlockReason(invoice);
  if (blockingReason) throw new Error(blockingReason);
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    throw new Error("Le montant du règlement doit être strictement positif.");
  }
  const remainingAmount = getRemainingAmount(invoice);
  if (payment.amount - remainingAmount > 0.009) {
    throw new Error("Le montant du règlement dépasse le reste dû.");
  }
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

export function getInvoicePaymentBlockReason(invoice: InvoiceRecord): string | null {
  if (invoice.type === "credit_note") return "Un avoir ne reçoit pas d'encaissement client.";
  if (invoice.status === "draft") return "Émettez la facture avant d'enregistrer un règlement.";
  if (invoice.status === "cancelled") return "Une facture annulée ne peut pas recevoir de règlement.";
  if (invoice.status === "paid" || getRemainingAmount(invoice) <= 0) return "Cette facture est déjà soldée.";
  return null;
}

export function normalizeInvoiceStatus(invoice: InvoiceRecord): InvoiceRecord {
  if (invoice.status === "cancelled") return invoice;
  const totals = invoice.document.totals ?? calculateDocumentTotals(invoice.document);
  const paid = getPaidAmount(invoice);
  if (totals.totalTtc > 0 && paid >= totals.totalTtc) return { ...invoice, status: "paid" };
  if (paid > 0) return { ...invoice, status: "partially_paid" };
  if (invoice.status === "draft") return invoice;
  if (isBeforeLocalToday(invoice.document.dueDate)) return { ...invoice, status: "overdue" };
  return { ...invoice, status: "sent" };
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
