import { supabase } from "../../../lib/supabaseClient";
import type { BusinessDocument } from "../../document-engine";
import { createInvoice } from "../application/invoiceFactory";
import { normalizeInvoiceStatus } from "../application/invoicePayments";
import type { InvoicePayment, InvoiceRecord, InvoiceType } from "../domain/types";

const TABLE = "invoices";
const LEGACY_STORAGE_KEY = "batipro.invoices.v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InvoiceRow = {
  id: string;
  type: InvoiceType;
  status: InvoiceRecord["status"];
  document: InvoiceRecord["document"];
  source_quote_id: string | null;
  project_id: string | null;
  chantier_id: string | null;
  payments: InvoicePayment[];
  created_at: string;
  updated_at: string;
};

export async function listInvoices(): Promise<InvoiceRecord[]> {
  await migrateLegacyInvoicesIfNeeded();
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .order("created_at", { ascending: false })
    .overrideTypes<InvoiceRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getInvoice(id: string) {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<InvoiceRow>();

  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

export async function saveInvoice(invoice: InvoiceRecord) {
  const normalizedInvoice = normalizeInvoiceStatus(invoice);
  const { data, error } = await supabase
    .from(TABLE as any)
    .upsert(toRow(normalizedInvoice), { onConflict: "id" })
    .select("*")
    .single()
    .overrideTypes<InvoiceRow>();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function createAndSaveInvoice(type: InvoiceType, sourceQuote?: BusinessDocument) {
  if (!sourceQuote) {
    throw new Error("La création directe d'une facture est désactivée. Ouvrez un projet commercial, onglet Devis, puis choisissez Acompte, Situation ou Finale.");
  }

  const invoice = createInvoice(type, sourceQuote);
  return saveInvoice(invoice);
}

export async function updateInvoiceStatus(id: string, status: InvoiceRecord["status"]) {
  const invoice = await getInvoice(id);
  if (!invoice) return null;
  return saveInvoice({ ...invoice, status, updatedAt: new Date().toISOString() });
}

export async function appendPayment(id: string, payment: Omit<InvoicePayment, "id">) {
  const invoice = await getInvoice(id);
  if (!invoice) return null;
  const next = {
    ...invoice,
    payments: [...invoice.payments, { ...payment, id: crypto.randomUUID() }],
    updatedAt: new Date().toISOString(),
  };
  return saveInvoice(next);
}

function fromRow(row: InvoiceRow): InvoiceRecord {
  return normalizeInvoiceStatus({
    id: row.id,
    type: row.type,
    status: row.status,
    document: row.document,
    sourceQuoteId: row.source_quote_id,
    projectId: row.project_id,
    chantierId: row.chantier_id,
    payments: row.payments ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toRow(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    type: invoice.type,
    status: invoice.status,
    document: invoice.document as any,
    source_quote_id: uuidOrNull(invoice.sourceQuoteId),
    project_id: uuidOrNull(invoice.projectId),
    chantier_id: uuidOrNull(invoice.chantierId),
    payments: invoice.payments as any,
    created_at: invoice.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function uuidOrNull(value?: string | null) {
  return value && UUID_PATTERN.test(value) ? value : null;
}

async function migrateLegacyInvoicesIfNeeded() {
  const legacy = readLegacyInvoices();
  if (!legacy.length) return;

  const { error } = await supabase
    .from(TABLE as any)
    .upsert(legacy.map(toRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
  removeLegacyInvoices();
}

function readLegacyInvoices(): InvoiceRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InvoiceRecord[];
  } catch {
    return [];
  }
}

function removeLegacyInvoices() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
