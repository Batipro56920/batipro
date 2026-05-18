import { calculateDocumentTotals, createEmptyBusinessDocument } from "../../document-engine";
import type { PurchaseOrderCreateInput, PurchaseOrderRecord } from "../domain/types";

export function createPurchaseOrder(input: PurchaseOrderCreateInput = {}): PurchaseOrderRecord {
  const now = new Date().toISOString();
  const document = createEmptyBusinessDocument("purchase_order");
  const nextDocument = {
    ...document,
    number: createPurchaseOrderNumber(),
    title: "Bon de commande fournisseur",
    projectId: input.projectId ?? null,
    chantierId: input.chantierId ?? null,
    recipient: {
      ...document.recipient,
      id: input.supplierId ?? null,
      displayName: input.supplierName ?? "",
    },
    terms: {
      ...document.terms,
      paymentTerms: "Commande fournisseur liee au projet ou chantier Batipro.",
      depositPercent: null,
      depositAmount: null,
    },
  };

  return {
    id: crypto.randomUUID(),
    status: "draft",
    document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) },
    supplierId: input.supplierId ?? null,
    supplierName: input.supplierName ?? null,
    projectId: input.projectId ?? null,
    chantierId: input.chantierId ?? null,
    lot: null,
    supplierReference: null,
    expectedDeliveryDate: null,
    deliveryAddress: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createPurchaseOrderNumber() {
  return `BC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}
