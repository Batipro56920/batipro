import { supabase } from "../../../lib/supabaseClient";
import { normalizeBusinessDocument } from "../../document-engine";
import { createPurchaseOrder } from "../application/purchaseOrderFactory";
import type { PurchaseOrderCreateInput, PurchaseOrderRecord, PurchaseOrderStatus } from "../domain/types";

const TABLE = "purchase_orders";
const LEGACY_STORAGE_KEY = "batipro.purchase-orders.v1";

type PurchaseOrderRow = {
  id: string;
  status: PurchaseOrderStatus;
  document: PurchaseOrderRecord["document"];
  supplier_id: string | null;
  supplier_name: string | null;
  project_id: string | null;
  chantier_id: string | null;
  lot: string | null;
  supplier_reference: string | null;
  expected_delivery_date: string | null;
  delivery_address: string | null;
  created_at: string;
  updated_at: string;
};

export async function listPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
  await migrateLegacyPurchaseOrdersIfNeeded();
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .order("created_at", { ascending: false })
    .overrideTypes<PurchaseOrderRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getPurchaseOrder(id: string) {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<PurchaseOrderRow>();

  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

export async function savePurchaseOrder(order: PurchaseOrderRecord) {
  const { data, error } = await supabase
    .from(TABLE as any)
    .upsert(toRow(order), { onConflict: "id" })
    .select("*")
    .single()
    .overrideTypes<PurchaseOrderRow>();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function createAndSavePurchaseOrder(input: PurchaseOrderCreateInput = {}) {
  const [number] = await generateSequentialPurchaseOrderNumbers(1);
  const order = createPurchaseOrder({ ...input, number });
  return savePurchaseOrder(order);
}

/**
 * Numerotation bon de commande au format AAAAMMJJNN (jour + sequence quotidienne), ex:
 * 2026090501 puis 2026090502, 2026090603 le lendemain. `count` reserve plusieurs numeros
 * consecutifs d'un coup (creation par lot, un bon par fournisseur).
 */
export async function generateSequentialPurchaseOrderNumbers(count: number): Promise<string[]> {
  const now = new Date();
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from(TABLE as any)
    .select("document")
    .like("document->>number", `${prefix}%`)
    .overrideTypes<Array<{ document: { number?: string } }>>();
  if (error) throw new Error(error.message);

  let maxSeq = 0;
  for (const row of data ?? []) {
    const num = String(row.document?.number ?? "");
    if (!num.startsWith(prefix)) continue;
    const seq = parseInt(num.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }

  return Array.from({ length: Math.max(1, count) }, (_, index) => `${prefix}${String(maxSeq + 1 + index).padStart(2, "0")}`);
}

export async function updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
  const order = await getPurchaseOrder(id);
  if (!order) return null;
  return savePurchaseOrder({ ...order, status, updatedAt: new Date().toISOString() });
}

function fromRow(row: PurchaseOrderRow): PurchaseOrderRecord {
  return {
    id: row.id,
    status: row.status,
    document: normalizeBusinessDocument(row.document, "purchase_order"),
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    projectId: row.project_id,
    chantierId: row.chantier_id,
    lot: row.lot,
    supplierReference: row.supplier_reference,
    expectedDeliveryDate: row.expected_delivery_date,
    deliveryAddress: row.delivery_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(order: PurchaseOrderRecord) {
  return {
    id: order.id,
    status: order.status,
    document: order.document as any,
    supplier_id: order.supplierId,
    supplier_name: order.supplierName,
    project_id: order.projectId,
    chantier_id: order.chantierId,
    lot: order.lot,
    supplier_reference: order.supplierReference,
    expected_delivery_date: order.expectedDeliveryDate,
    delivery_address: order.deliveryAddress,
    created_at: order.createdAt,
    updated_at: new Date().toISOString(),
  };
}

async function migrateLegacyPurchaseOrdersIfNeeded() {
  const legacy = readLegacyPurchaseOrders();
  if (!legacy.length) return;

  const { error } = await supabase
    .from(TABLE as any)
    .upsert(legacy.map(toRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
  removeLegacyPurchaseOrders();
}

function readLegacyPurchaseOrders(): PurchaseOrderRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PurchaseOrderRecord[];
  } catch {
    return [];
  }
}

function removeLegacyPurchaseOrders() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
