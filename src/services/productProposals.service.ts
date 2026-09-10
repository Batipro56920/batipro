import { supabase } from "../lib/supabaseClient";

const db = supabase as any;

export type ProductProposal = {
  id: string;
  designation: string;
  quantity: number;
  unit: string;
  unitPriceHt: number | null;
  supplierId: string | null;
  supplierName: string | null;
  chantierId: string | null;
  chantierName: string | null;
  deliveryNoteId: string | null;
  createdAt: string | null;
};

const SELECT = "id,designation,quantity,unit,unit_price_ht,supplier_id,supplier_name,chantier_id,delivery_note_id,created_at,chantiers(nom)";

/** Produits vus sur un bon de livraison et pas encore au catalogue. */
export async function listPendingProductProposals(): Promise<ProductProposal[]> {
  const { data, error } = await db
    .from("product_catalog_proposals")
    .select(SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    id: String(row.id),
    designation: String(row.designation ?? ""),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? "u"),
    unitPriceHt: row.unit_price_ht === null || row.unit_price_ht === undefined ? null : Number(row.unit_price_ht),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    supplierName: row.supplier_name ? String(row.supplier_name) : null,
    chantierId: row.chantier_id ? String(row.chantier_id) : null,
    chantierName: row.chantiers?.nom ? String(row.chantiers.nom) : null,
    deliveryNoteId: row.delivery_note_id ? String(row.delivery_note_id) : null,
    createdAt: row.created_at ?? null,
  }));
}

/**
 * Crée la fiche produit validée au bureau, puis passe l'entrée en stock qui
 * attendait : la livraison n'est comptée qu'une fois le produit reconnu.
 */
export async function acceptProductProposal(
  proposal: ProductProposal,
  values: { designation: string; unit: string; purchasePriceHt: number; category: string | null },
): Promise<void> {
  const id = crypto.randomUUID();
  const { error: productError } = await db.from("product_catalog_items").insert({
    id,
    designation: values.designation,
    unit: values.unit,
    category: values.category,
    standard_purchase_price_ht: values.purchasePriceHt,
    recommended_sale_price_ht: 0,
    target_margin_rate: 0,
    vat_rate: 20,
    main_supplier_id: proposal.supplierId,
    main_supplier_name: proposal.supplierName,
  });
  if (productError) throw new Error(productError.message);

  if (proposal.quantity > 0) {
    const { error: movementError } = await db.from("product_stock_movements").insert({
      product_id: id,
      movement_type: "entree",
      quantity: proposal.quantity,
      source: "declaration_terrain",
      chantier_id: proposal.chantierId,
      supplier_id: proposal.supplierId,
      unit_price_ht: proposal.unitPriceHt,
      note: "Bon de livraison (produit validé au bureau)",
    });
    if (movementError) throw new Error(movementError.message);
  }

  const { error } = await db
    .from("product_catalog_proposals")
    .update({ status: "accepted", product_id: id, resolved_at: new Date().toISOString() })
    .eq("id", proposal.id);
  if (error) throw new Error(error.message);
}

export async function rejectProductProposal(proposalId: string): Promise<void> {
  const { error } = await db
    .from("product_catalog_proposals")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (error) throw new Error(error.message);
}
