import { calculateDocumentTotals, createEmptyBusinessDocument } from "../../document-engine";
import {
  DEFAULT_PURCHASE_ORDER_LEGAL_MENTIONS,
  DEFAULT_PURCHASE_ORDER_PAYMENT_TERMS,
  DEFAULT_PURCHASE_ORDER_WASTE_MANAGEMENT,
} from "../../../services/companySettings.service";
import type { PurchaseOrderCreateInput, PurchaseOrderRecord } from "../domain/types";

export function createPurchaseOrder(input: PurchaseOrderCreateInput = {}): PurchaseOrderRecord {
  const now = new Date().toISOString();
  const document = createEmptyBusinessDocument("purchase_order");
  const nextDocument = {
    ...document,
    number: input.number ?? createPurchaseOrderNumber(),
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
      paymentTerms: input.terms?.paymentTerms ?? DEFAULT_PURCHASE_ORDER_PAYMENT_TERMS,
      legalMentions: input.terms?.legalMentions ?? DEFAULT_PURCHASE_ORDER_LEGAL_MENTIONS,
      wasteManagement: input.terms?.wasteManagement ?? DEFAULT_PURCHASE_ORDER_WASTE_MANAGEMENT,
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
