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
}): Promise<void> {
  if (!input.productId) throw new Error("Produit manquant.");
  if (!(input.quantity > 0)) throw new Error("Quantité invalide.");
  const { error } = await (supabase as any).from("product_stock_movements").insert({
    product_id: input.productId,
    movement_type: "entree",
    quantity: input.quantity,
    source: "reception_manuelle",
    note: input.note?.trim() || null,
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
