import { supabase } from "../lib/supabaseClient";

const db = supabase as any;

export type ChantierFinancialExpenseRow = {
  id: string;
  chantier_id: string;
  supplier_name: string | null;
  expense_date: string;
  category: string;
  description: string;
  amount_ht: number;
  tva: number;
  amount_ttc: number;
  invoice_document_id: string | null;
  status: "prevu" | "commande" | "recu" | "paye";
  created_at: string;
  updated_at: string;
};

export type ChantierClientBillingRow = {
  id: string;
  chantier_id: string;
  crm_invoice_id: string | null;
  type: "acompte" | "situation" | "facture_finale" | "avoir" | "autre";
  label: string;
  amount_ht: number;
  amount_ttc: number;
  billed_at: string | null;
  due_date: string | null;
  paid_amount_ttc: number;
  paid_at: string | null;
  payment_status: "a_facturer" | "facture" | "partiel" | "paye" | "impaye";
  created_at: string;
  updated_at: string;
};

export type ChantierFinancialChangeOrderRow = {
  id: string;
  chantier_id: string;
  crm_quote_id: string | null;
  description: string;
  amount_ht: number;
  status: "propose" | "accepte" | "refuse";
  document_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChantierFinanceDataset = {
  expenses: ChantierFinancialExpenseRow[];
  billings: ChantierClientBillingRow[];
  changeOrders: ChantierFinancialChangeOrderRow[];
  schemaReady: boolean;
};

const EXPENSE_SELECT =
  "id, chantier_id, supplier_name, expense_date, category, description, amount_ht, tva, amount_ttc, invoice_document_id, status, created_at, updated_at";
const BILLING_SELECT =
  "id, chantier_id, crm_invoice_id, type, label, amount_ht, amount_ttc, billed_at, due_date, paid_amount_ttc, paid_at, payment_status, created_at, updated_at";
const CHANGE_ORDER_SELECT =
  "id, chantier_id, crm_quote_id, description, amount_ht, status, document_id, created_at, updated_at";

function isMissingFinanceSchema(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return code === "42P01" || code === "42703" || msg.includes("schema cache") || msg.includes("does not exist");
}

function numberValue(value: unknown): number {
  const n = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function listRows<T>(table: string, select: string, chantierId: string): Promise<{ rows: T[]; schemaReady: boolean }> {
  const { data, error } = await db.from(table).select(select).eq("chantier_id", chantierId).order("created_at", { ascending: false });
  if (error) {
    if (isMissingFinanceSchema(error)) return { rows: [], schemaReady: false };
    throw error;
  }
  return { rows: (data ?? []) as T[], schemaReady: true };
}

export async function loadChantierFinanceDataset(chantierId: string): Promise<ChantierFinanceDataset> {
  const [expenses, billings, changeOrders] = await Promise.all([
    listRows<ChantierFinancialExpenseRow>("chantier_financial_expenses", EXPENSE_SELECT, chantierId),
    listRows<ChantierClientBillingRow>("chantier_client_billings", BILLING_SELECT, chantierId),
    listRows<ChantierFinancialChangeOrderRow>("chantier_financial_change_orders", CHANGE_ORDER_SELECT, chantierId),
  ]);
  return {
    expenses: expenses.rows,
    billings: billings.rows,
    changeOrders: changeOrders.rows,
    schemaReady: expenses.schemaReady && billings.schemaReady && changeOrders.schemaReady,
  };
}

export async function createChantierFinancialExpense(input: Partial<ChantierFinancialExpenseRow>) {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  const amount_ht = numberValue(input.amount_ht);
  const tva = input.tva === undefined || input.tva === null ? 20 : numberValue(input.tva);
  const amount_ttc = input.amount_ttc === undefined || input.amount_ttc === null
    ? Math.round(amount_ht * (1 + tva / 100) * 100) / 100
    : numberValue(input.amount_ttc);
  const { data, error } = await db
    .from("chantier_financial_expenses")
    .insert([
      {
        chantier_id: input.chantier_id,
        supplier_name: input.supplier_name || null,
        expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
        category: input.category || "autre",
        description: input.description || "Dépense chantier",
        amount_ht,
        tva,
        amount_ttc,
        invoice_document_id: input.invoice_document_id || null,
        status: input.status || "prevu",
      },
    ])
    .select(EXPENSE_SELECT)
    .single();
  if (error) throw error;
  return data as ChantierFinancialExpenseRow;
}

export async function createChantierClientBilling(input: Partial<ChantierClientBillingRow>) {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  const amount_ht = numberValue(input.amount_ht);
  const amount_ttc = input.amount_ttc === undefined || input.amount_ttc === null ? amount_ht : numberValue(input.amount_ttc);
  const { data, error } = await db
    .from("chantier_client_billings")
    .insert([
      {
        chantier_id: input.chantier_id,
        crm_invoice_id: input.crm_invoice_id || null,
        type: input.type || "acompte",
        label: input.label || "Facturation client",
        amount_ht,
        amount_ttc,
        billed_at: input.billed_at || null,
        due_date: input.due_date || null,
        paid_amount_ttc: numberValue(input.paid_amount_ttc),
        paid_at: input.paid_at || null,
        payment_status: input.payment_status || "a_facturer",
      },
    ])
    .select(BILLING_SELECT)
    .single();
  if (error) throw error;
  return data as ChantierClientBillingRow;
}

export async function createChantierFinancialChangeOrder(input: Partial<ChantierFinancialChangeOrderRow>) {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  const { data, error } = await db
    .from("chantier_financial_change_orders")
    .insert([
      {
        chantier_id: input.chantier_id,
        crm_quote_id: input.crm_quote_id || null,
        description: input.description || "Avenant / travaux supplémentaires",
        amount_ht: numberValue(input.amount_ht),
        status: input.status || "propose",
        document_id: input.document_id || null,
      },
    ])
    .select(CHANGE_ORDER_SELECT)
    .single();
  if (error) throw error;
  return data as ChantierFinancialChangeOrderRow;
}
