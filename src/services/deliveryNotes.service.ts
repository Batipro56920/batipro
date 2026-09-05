import { supabase } from "../lib/supabaseClient";
import { createStockReception } from "./productStock.service";
import { updatePurchaseOrderStatus } from "../features/purchase-orders/infrastructure/purchaseOrderRepository";

export type ExtractedDeliveryLine = { designation: string; quantity: number; unit: string };

export type DeliverySlipExtraction = {
  supplierName: string | null;
  documentReference: string | null;
  lines: ExtractedDeliveryLine[];
  storagePath: string | null;
  storageBucket: string | null;
};

function deliverySlipErrorMessage(code: string) {
  const messages: Record<string, string> = {
    unsupported_file_type: "Format de fichier non supporte (photo ou PDF uniquement).",
    file_too_large: "Fichier trop volumineux (20 Mo max).",
    ai_unavailable: "Lecture IA indisponible pour le moment, reessaie dans un instant.",
    ai_empty_response: "L'IA n'a pas reussi a lire ce document.",
    ai_invalid_response: "Reponse IA illisible.",
  };
  return messages[code] ?? code;
}

export async function extractDeliverySlip(file: File): Promise<DeliverySlipExtraction> {
  const formData = new FormData();
  formData.set("file", file);

  const { data, error } = await supabase.functions.invoke("delivery-slip-extract", { body: formData });
  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Record<string, unknown>;
  if (typeof payload.error === "string") throw new Error(deliverySlipErrorMessage(payload.error));

  return {
    supplierName: (payload.supplierName as string) ?? null,
    documentReference: (payload.documentReference as string) ?? null,
    lines: Array.isArray(payload.lines) ? (payload.lines as ExtractedDeliveryLine[]) : [],
    storagePath: (payload.storage_path as string) ?? null,
    storageBucket: (payload.storage_bucket as string) ?? null,
  };
}

export type DeliveryNoteLineRecord = ExtractedDeliveryLine & { productId: string | null };

export type DeliveryNoteRecord = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  documentReference: string | null;
  purchaseOrderId: string | null;
  chantierId: string | null;
  status: "matched" | "unmatched";
  lines: DeliveryNoteLineRecord[];
  storagePath: string | null;
  storageBucket: string | null;
  createdAt: string;
};

function fromRow(row: any): DeliveryNoteRecord {
  return {
    id: row.id,
    supplierId: row.supplier_id ?? null,
    supplierName: row.supplier_name ?? null,
    documentReference: row.document_reference ?? null,
    purchaseOrderId: row.purchase_order_id ?? null,
    chantierId: row.chantier_id ?? null,
    status: row.status,
    lines: Array.isArray(row.lines) ? row.lines : [],
    storagePath: row.storage_path ?? null,
    storageBucket: row.storage_bucket ?? null,
    createdAt: row.created_at,
  };
}

export async function listDeliveryNotes(): Promise<DeliveryNoteRecord[]> {
  const { data, error } = await supabase
    .from("delivery_notes" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

/**
 * Poste une entree de stock reelle par ligne resolue a un produit catalogue, marque le bon de
 * commande rapproche comme "delivered" (reception consideree complete en v1), et journalise le
 * bon de livraison pour tracabilite. Les lignes sans productId sont ignorees (a resoudre avant).
 */
export async function confirmDeliveryNote(input: {
  supplierId: string | null;
  supplierName: string | null;
  documentReference: string | null;
  purchaseOrderId: string | null;
  chantierId: string | null;
  storagePath: string | null;
  storageBucket: string | null;
  lines: DeliveryNoteLineRecord[];
}): Promise<DeliveryNoteRecord> {
  const resolvedLines = input.lines.filter((line) => line.productId);
  for (const line of resolvedLines) {
    await createStockReception({
      productId: line.productId as string,
      quantity: line.quantity,
      note: [
        "Bon de livraison",
        input.documentReference || null,
        input.supplierName || null,
      ].filter(Boolean).join(" - "),
      chantierId: input.chantierId,
    });
  }

  if (input.purchaseOrderId) {
    await updatePurchaseOrderStatus(input.purchaseOrderId, "delivered");
  }

  const { data, error } = await supabase
    .from("delivery_notes" as any)
    .insert({
      supplier_id: input.supplierId,
      supplier_name: input.supplierName,
      document_reference: input.documentReference,
      purchase_order_id: input.purchaseOrderId,
      chantier_id: input.chantierId,
      status: input.purchaseOrderId ? "matched" : "unmatched",
      lines: input.lines,
      storage_path: input.storagePath,
      storage_bucket: input.storageBucket,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return fromRow(data);
}
