import { supabase } from "../lib/supabaseClient";

const TABLE = "chantier_material_preparations";

export type ChantierMaterialPreparationSource = "auto" | "manual";

export type ChantierMaterialPreparationRow = {
  id: string;
  chantierId: string;
  aggregationKey: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitCostHt: number | null;
  productId: string | null;
  supplierId: string | null;
  supplierName: string | null;
  source: ChantierMaterialPreparationSource;
  purchaseOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PreparationDbRow = {
  id: string;
  chantier_id: string;
  aggregation_key: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_cost_ht: number | null;
  product_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  source: ChantierMaterialPreparationSource;
  purchase_order_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialPreparationComputedLine = {
  aggregationKey: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitCostHt: number | null;
  productId: string | null;
  supplierId: string | null;
  supplierName: string | null;
};

function fromRow(row: PreparationDbRow): ChantierMaterialPreparationRow {
  return {
    id: row.id,
    chantierId: row.chantier_id,
    aggregationKey: row.aggregation_key,
    materialName: row.material_name,
    quantity: Number(row.quantity) || 0,
    unit: row.unit,
    unitCostHt: row.unit_cost_ht !== null ? Number(row.unit_cost_ht) : null,
    productId: row.product_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    source: row.source,
    purchaseOrderId: row.purchase_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listChantierMaterialPreparations(chantierId: string): Promise<ChantierMaterialPreparationRow[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("chantier_id", chantierId)
    .order("material_name", { ascending: true })
    .overrideTypes<PreparationDbRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function upsertComputedMaterialPreparations(
  chantierId: string,
  lines: MaterialPreparationComputedLine[],
): Promise<ChantierMaterialPreparationRow[]> {
  const existing = await listChantierMaterialPreparations(chantierId);
  const existingAutoByKey = new Map(existing.filter((row) => row.source === "auto").map((row) => [row.aggregationKey, row]));

  if (lines.length) {
    const payload = lines.map((line) => {
      const prior = existingAutoByKey.get(line.aggregationKey);
      return {
        chantier_id: chantierId,
        aggregation_key: line.aggregationKey,
        material_name: line.materialName,
        quantity: line.quantity,
        unit: line.unit,
        unit_cost_ht: line.unitCostHt,
        product_id: prior?.productId ?? line.productId,
        supplier_id: prior?.supplierId ?? line.supplierId,
        supplier_name: prior?.supplierName ?? line.supplierName,
        source: "auto" as const,
        purchase_order_id: prior?.purchaseOrderId ?? null,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from(TABLE as any).upsert(payload, { onConflict: "chantier_id,aggregation_key" });
    if (error) throw new Error(error.message);
  }

  const keptKeys = new Set(lines.map((line) => line.aggregationKey));
  const staleIds = existing
    .filter((row) => row.source === "auto" && !row.purchaseOrderId && !keptKeys.has(row.aggregationKey))
    .map((row) => row.id);
  if (staleIds.length) {
    const { error } = await supabase.from(TABLE as any).delete().in("id", staleIds);
    if (error) throw new Error(error.message);
  }

  return listChantierMaterialPreparations(chantierId);
}

export async function addManualMaterialPreparation(
  chantierId: string,
  input: {
    materialName: string;
    quantity: number;
    unit: string;
    productId?: string | null;
    supplierId?: string | null;
    supplierName?: string | null;
    unitCostHt?: number | null;
  },
): Promise<ChantierMaterialPreparationRow> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .insert({
      chantier_id: chantierId,
      aggregation_key: `manual-${crypto.randomUUID()}`,
      material_name: input.materialName,
      quantity: input.quantity,
      unit: input.unit,
      product_id: input.productId ?? null,
      supplier_id: input.supplierId ?? null,
      supplier_name: input.supplierName ?? null,
      unit_cost_ht: input.unitCostHt ?? null,
      source: "manual",
    })
    .select("*")
    .single()
    .overrideTypes<PreparationDbRow>();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function updateMaterialPreparation(
  id: string,
  patch: Partial<{
    quantity: number;
    productId: string | null;
    supplierId: string | null;
    supplierName: string | null;
    unitCostHt: number | null;
    purchaseOrderId: string | null;
  }>,
): Promise<ChantierMaterialPreparationRow> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.productId !== undefined) row.product_id = patch.productId;
  if (patch.supplierId !== undefined) row.supplier_id = patch.supplierId;
  if (patch.supplierName !== undefined) row.supplier_name = patch.supplierName;
  if (patch.unitCostHt !== undefined) row.unit_cost_ht = patch.unitCostHt;
  if (patch.purchaseOrderId !== undefined) row.purchase_order_id = patch.purchaseOrderId;

  const { data, error } = await supabase
    .from(TABLE as any)
    .update(row)
    .eq("id", id)
    .select("*")
    .single()
    .overrideTypes<PreparationDbRow>();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function removeMaterialPreparation(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE as any).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function linkMaterialPreparationsToPurchaseOrder(ids: string[], purchaseOrderId: string): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from(TABLE as any)
    .update({ purchase_order_id: purchaseOrderId, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
}
