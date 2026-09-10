import { supabase } from "../lib/supabaseClient";

export type ProductStockLevel = {
  productId: string;
  designation: string;
  category: string | null;
  unit: string;
  stockQuantity: number;
  lastMovementAt: string | null;
};

export type ProductStockMovement = {
  id: string;
  productId: string;
  movementType: "entree" | "sortie";
  quantity: number;
  source: "reception_manuelle" | "declaration_terrain" | "ajustement_manuel";
  chantierId: string | null;
  intervenantId: string | null;
  note: string | null;
  workDate: string;
  createdAt: string;
};

function mapLevel(row: any): ProductStockLevel {
  return {
    productId: String(row.product_id),
    designation: String(row.designation ?? ""),
    category: row.category ?? null,
    unit: String(row.unit ?? ""),
    stockQuantity: Number(row.stock_quantity ?? 0),
    lastMovementAt: row.last_movement_at ?? null,
  };
}

export async function listProductStockLevels(query?: string): Promise<ProductStockLevel[]> {
  let request = (supabase as any)
    .from("product_stock_levels")
    .select("*")
    .order("designation", { ascending: true });
  if (query && query.trim()) {
    request = request.ilike("designation", `%${query.trim()}%`);
  }
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLevel);
}

export async function listProductStockMovements(productId: string): Promise<ProductStockMovement[]> {
  const { data, error } = await (supabase as any)
    .from("product_stock_movements")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    productId: String(row.product_id),
    movementType: row.movement_type,
    quantity: Number(row.quantity ?? 0),
    source: row.source,
    chantierId: row.chantier_id ?? null,
    intervenantId: row.intervenant_id ?? null,
    note: row.note ?? null,
    workDate: String(row.work_date ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function createStockReception(input: {
  productId: string;
  quantity: number;
  note?: string | null;
  chantierId?: string | null;
}): Promise<void> {
  if (!input.productId) throw new Error("Produit manquant.");
  if (!(input.quantity > 0)) throw new Error("Quantité invalide.");
  const { error } = await (supabase as any).from("product_stock_movements").insert({
    product_id: input.productId,
    movement_type: "entree",
    quantity: input.quantity,
    source: "reception_manuelle",
    note: input.note?.trim() || null,
    chantier_id: input.chantierId || null,
  });
  if (error) throw new Error(error.message);
}

export async function createStockAdjustment(input: {
  productId: string;
  movementType: "entree" | "sortie";
  quantity: number;
  note?: string | null;
}): Promise<void> {
  if (!input.productId) throw new Error("Produit manquant.");
  if (!(input.quantity > 0)) throw new Error("Quantité invalide.");
  const { error } = await (supabase as any).from("product_stock_movements").insert({
    product_id: input.productId,
    movement_type: input.movementType,
    quantity: input.quantity,
    source: "ajustement_manuel",
    note: input.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Coût matières réellement reçu sur un chantier, d'après les prix lus sur les
 * bons de livraison. Les mouvements sans prix ne comptent pas : mieux vaut un
 * total incomplet et honnête qu'un chiffre inventé.
/**
 * Coût matières d'un chantier, d'après la bibliothèque de produits.
 *
 * Un bon de livraison ne porte presque jamais de prix : ce qui compte, c'est que
 * la ligne soit rattachée à un produit du catalogue, où le prix d'achat est
 * renseigné. Le prix lu sur le bon, quand il y en a un, l'emporte : il décrit
 * cette livraison-là mieux que le tarif standard.
 *
 * Sont comptés les mouvements rattachés au chantier dans les deux sens : ce qui
 * y a été livré, et ce qui a été sorti du dépôt pour lui. Un même article passe
 * par l'un ou par l'autre, pas par les deux.
 */
export async function getChantierMaterialCost(chantierId: string): Promise<number> {
  if (!chantierId) return 0;

  const { data: movements, error } = await (supabase as any)
    .from("product_stock_movements")
    .select("product_id,quantity,unit_price_ht,movement_type")
    .eq("chantier_id", chantierId)
    .in("movement_type", ["entree", "sortie"]);
  if (error || !Array.isArray(movements) || !movements.length) return 0;

  const missingPriceIds = Array.from(
    new Set(
      movements
        .filter((row: any) => row?.unit_price_ht === null || row?.unit_price_ht === undefined)
        .map((row: any) => String(row?.product_id ?? ""))
        .filter(Boolean),
    ),
  );

  const catalogPrices = new Map<string, number>();
  if (missingPriceIds.length) {
    const { data: products } = await (supabase as any)
      .from("product_catalog_items")
      .select("id,standard_purchase_price_ht")
      .in("id", missingPriceIds);
    for (const product of (products ?? []) as Array<Record<string, unknown>>) {
      const price = Number(product.standard_purchase_price_ht ?? 0);
      if (Number.isFinite(price) && price > 0) catalogPrices.set(String(product.id), price);
    }
  }

  return movements.reduce((total: number, row: any) => {
    const quantity = Number(row?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return total;
    const slipPrice = row?.unit_price_ht === null || row?.unit_price_ht === undefined ? null : Number(row.unit_price_ht);
    const price = slipPrice !== null && Number.isFinite(slipPrice) ? slipPrice : catalogPrices.get(String(row?.product_id ?? "")) ?? 0;
    return price > 0 ? total + quantity * price : total;
  }, 0);
}
