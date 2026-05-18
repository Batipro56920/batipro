import { createInvoice } from "../application/invoiceFactory";
import type { InvoicePayment, InvoiceRecord, InvoiceType } from "../domain/types";

const STORAGE_KEY = "batipro.invoices.v1";

export function listInvoices(): InvoiceRecord[] {
  const stored = readInvoices();
  if (stored.length) return stored;
  const initial = [createInvoice("deposit"), createInvoice("intermediate"), createInvoice("final")];
  writeInvoices(initial);
  return initial;
}

export function getInvoice(id: string) {
  return listInvoices().find((invoice) => invoice.id === id) ?? null;
}

export function saveInvoice(invoice: InvoiceRecord) {
  const invoices = readInvoices();
  const exists = invoices.some((row) => row.id === invoice.id);
  const next = exists ? invoices.map((row) => row.id === invoice.id ? invoice : row) : [invoice, ...invoices];
  writeInvoices(next);
  return invoice;
}

export function createAndSaveInvoice(type: InvoiceType) {
  const invoice = createInvoice(type);
  saveInvoice(invoice);
  return invoice;
}

export function updateInvoiceStatus(id: string, status: InvoiceRecord["status"]) {
  const invoice = getInvoice(id);
  if (!invoice) return null;
  return saveInvoice({ ...invoice, status, updatedAt: new Date().toISOString() });
}

export function appendPayment(id: string, payment: Omit<InvoicePayment, "id">) {
  const invoice = getInvoice(id);
  if (!invoice) return null;
  const next = { ...invoice, payments: [...invoice.payments, { ...payment, id: crypto.randomUUID() }], updatedAt: new Date().toISOString() };
  return saveInvoice(next);
}

function readInvoices(): InvoiceRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InvoiceRecord[];
  } catch {
    return [];
  }
}

function writeInvoices(invoices: InvoiceRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}
