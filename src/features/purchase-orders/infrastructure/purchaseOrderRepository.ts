import { createPurchaseOrder } from "../application/purchaseOrderFactory";
import type { PurchaseOrderCreateInput, PurchaseOrderRecord, PurchaseOrderStatus } from "../domain/types";

const STORAGE_KEY = "batipro.purchase-orders.v1";

export function listPurchaseOrders(): PurchaseOrderRecord[] {
  return readPurchaseOrders();
}

export function getPurchaseOrder(id: string) {
  return listPurchaseOrders().find((order) => order.id === id) ?? null;
}

export function savePurchaseOrder(order: PurchaseOrderRecord) {
  const orders = readPurchaseOrders();
  const exists = orders.some((row) => row.id === order.id);
  const next = exists ? orders.map((row) => row.id === order.id ? order : row) : [order, ...orders];
  writePurchaseOrders(next);
  return order;
}

export function createAndSavePurchaseOrder(input: PurchaseOrderCreateInput = {}) {
  const order = createPurchaseOrder(input);
  savePurchaseOrder(order);
  return order;
}

export function updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
  const order = getPurchaseOrder(id);
  if (!order) return null;
  return savePurchaseOrder({ ...order, status, updatedAt: new Date().toISOString() });
}

function readPurchaseOrders(): PurchaseOrderRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PurchaseOrderRecord[];
  } catch {
    return [];
  }
}

function writePurchaseOrders(orders: PurchaseOrderRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}
