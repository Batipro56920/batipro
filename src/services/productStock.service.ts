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
  deliveryNoteId?: string | null;
  supplierId?: string | null;
  unitPriceHt?: number | null;
}): Promise<void> {
  if (!input.productId) throw new Error("Produit manquant.");
  if (!(input.quantity > 0)) throw new Error("Quantité invalide.");
  const unitPrice = Number(input.unitPriceHt);
  const { error } = await (supabase as any).from("product_stock_movements").insert({
    product_id: input.productId,
    movement_type: "entree",
    quantity: input.quantity,
    source: "reception_manuelle",
    note: input.note?.trim() || null,
    chantier_id: input.chantierId || null,
    // Sans ce lien la réception se voit dans le stock mais pas dans le chantier.
    delivery_note_id: input.deliveryNoteId || null,
    supplier_id: input.supplierId || null,
    unit_price_ht: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
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
 * Journal des matières d'un chantier : chaque mouvement de stock qui lui est
 * rattaché, avec le prix retenu et d'où il vient.
 *
 * Un bon de livraison ne porte presque jamais de prix : ce qui compte, c'est que
 * la ligne soit rattachée à un produit du catalogue, où le prix d'achat est
 * renseigné. Le prix lu sur le bon, quand il y en a un, l'emporte : il décrit
 * cette livraison-là mieux que le tarif standard.
 *
 * Sont comptés les mouvements rattachés au chantier dans les deux sens : ce qui
 * y a été livré, et ce qui a été sorti du dépôt pour lui. Un même article passe
 * par l'un ou par l'autre, pas par les deux.
 *
 * Les lignes sans prix restent dans le journal, à zéro et signalées : le total
 * doit rester honnête, mais le trou doit se voir.
 */
export type ChantierMaterialEntry = {
  movementId: string;
  deliveryNoteId: string | null;
  productId: string;
  designation: string;
  unit: string;
  movementType: "entree" | "sortie";
  quantity: number;
  unitPriceHt: number | null;
  priceSource: "bon" | "catalogue" | "absent";
  amountHt: number;
  note: string | null;
  occurredAt: string;
};

export type ChantierMaterialLedger = {
  totalHt: number;
  entries: ChantierMaterialEntry[];
  /** Produits reçus dont le prix d'achat n'est renseigné nulle part. */
  unpricedDesignations: string[];
};

const EMPTY_LEDGER: ChantierMaterialLedger = { totalHt: 0, entries: [], unpricedDesignations: [] };

export async function getChantierMaterialLedger(chantierId: string): Promise<ChantierMaterialLedger> {
  if (!chantierId) return EMPTY_LEDGER;

  const { data: movements, error } = await (supabase as any)
    .from("product_stock_movements")
    .select("id,product_id,quantity,unit_price_ht,movement_type,note,created_at,work_date,delivery_note_id")
    .eq("chantier_id", chantierId)
    .in("movement_type", ["entree", "sortie"])
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(movements) || !movements.length) return EMPTY_LEDGER;

  const productIds = Array.from(
    new Set(movements.map((row: any) => String(row?.product_id ?? "")).filter(Boolean)),
  );

  const catalog = new Map<string, { designation: string; unit: string; price: number }>();
  if (productIds.length) {
    const { data: products } = await (supabase as any)
      .from("product_catalog_items")
      .select("id,designation,unit,standard_purchase_price_ht")
      .in("id", productIds);
    for (const product of (products ?? []) as Array<Record<string, unknown>>) {
      const price = Number(product.standard_purchase_price_ht ?? 0);
      catalog.set(String(product.id), {
        designation: String(product.designation ?? ""),
        unit: String(product.unit ?? ""),
        price: Number.isFinite(price) && price > 0 ? price : 0,
      });
    }
  }

  const entries: ChantierMaterialEntry[] = [];
  const unpriced = new Set<string>();

  for (const row of movements as Array<Record<string, unknown>>) {
    const quantity = Number(row.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const productId = String(row.product_id ?? "");
    const product = catalog.get(productId);
    const slipPriceRaw =
      row.unit_price_ht === null || row.unit_price_ht === undefined ? null : Number(row.unit_price_ht);
    const slipPrice = slipPriceRaw !== null && Number.isFinite(slipPriceRaw) && slipPriceRaw > 0 ? slipPriceRaw : null;
    const catalogPrice = product && product.price > 0 ? product.price : null;
    const unitPriceHt = slipPrice ?? catalogPrice;
    const designation = product?.designation || "Produit hors catalogue";
    if (unitPriceHt === null) unpriced.add(designation);

    entries.push({
      movementId: String(row.id ?? ""),
      deliveryNoteId: row.delivery_note_id ? String(row.delivery_note_id) : null,
      productId,
      designation,
      unit: product?.unit ?? "",
      movementType: row.movement_type === "sortie" ? "sortie" : "entree",
      quantity,
      unitPriceHt,
      priceSource: slipPrice !== null ? "bon" : catalogPrice !== null ? "catalogue" : "absent",
      amountHt: unitPriceHt === null ? 0 : quantity * unitPriceHt,
      note: (row.note as string | null) ?? null,
      occurredAt: String(row.created_at ?? row.work_date ?? ""),
    });
  }

  return {
    totalHt: entries.reduce((sum, entry) => sum + entry.amountHt, 0),
    entries,
    unpricedDesignations: Array.from(unpriced),
  };
}

export async function getChantierMaterialCost(chantierId: string): Promise<number> {
  const ledger = await getChantierMaterialLedger(chantierId);
  return ledger.totalHt;
}
