import type { BusinessDocument } from "../../document-engine";

export type PurchaseOrderStatus = "draft" | "sent" | "confirmed" | "partially_delivered" | "delivered" | "cancelled";

export type PurchaseOrderRecord = {
  id: string;
  status: PurchaseOrderStatus;
  document: BusinessDocument;
  supplierId: string | null;
  supplierName: string | null;
  projectId: string | null;
  chantierId: string | null;
  lot: string | null;
  supplierReference: string | null;
  expectedDeliveryDate: string | null;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderCreateInput = {
  supplierId?: string | null;
  supplierName?: string | null;
  projectId?: string | null;
  chantierId?: string | null;
};
