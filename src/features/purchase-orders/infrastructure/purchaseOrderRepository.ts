import { supabase } from "../../../lib/supabaseClient";
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
  const order = createPurchaseOrder(input);
  return savePurchaseOrder(order);
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
    document: row.document,
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
