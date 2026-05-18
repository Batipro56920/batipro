import type { BusinessDocument, PaymentMethod } from "../../document-engine";

export type InvoiceType = "deposit" | "intermediate" | "final" | "credit_note";

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";

export type InvoicePayment = {
  id: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  reference?: string;
};

export type InvoiceRecord = {
  id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  document: BusinessDocument;
  sourceQuoteId?: string | null;
  projectId?: string | null;
  chantierId?: string | null;
  payments: InvoicePayment[];
  createdAt: string;
  updatedAt: string;
};

export type InvoiceProfitabilitySnapshot = {
  invoiceId: string;
  projectId?: string | null;
  chantierId?: string | null;
  soldRevenueTtc: number;
  invoicedTtc: number;
  paidTtc: number;
  remainingToInvoiceTtc: number;
  remainingToCollectTtc: number;
};
