import { supabase } from "../../../lib/supabaseClient";
import type { ProductCatalogDraft, ProductCatalogItem } from "../domain/types";

const TABLE = "product_catalog_items";
const LEGACY_STORAGE_KEY = "batipro.product-catalog.v1";

type ProductCatalogRow = {
  id: string;
  designation: string;
  internal_reference: string | null;
  manufacturer_reference: string | null;
  brand: string | null;
  category: string | null;
  unit: ProductCatalogItem["unit"];
  vat_rate: number;
  main_supplier_id: string | null;
  main_supplier_name: string | null;
  standard_purchase_price_ht: number;
  recommended_sale_price_ht: number;
  target_margin_rate: number;
  is_sellable?: boolean | null;
  supplier_prices: ProductCatalogItem["supplierPrices"];
  documents: ProductCatalogItem["documents"];
  price_history: ProductCatalogItem["priceHistory"];
  created_at: string;
  updated_at: string;
};

export async function listProductCatalogItems(): Promise<ProductCatalogItem[]> {
  await migrateLegacyProductsIfNeeded();
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .order("designation", { ascending: true })
    .overrideTypes<ProductCatalogRow[]>();

  if (error) {
    if (isMissingIsSellableColumn(error)) return listProductCatalogItemsLegacy();
    throw new Error(error.message);
  }
  return (data ?? []).map(fromRow);
}

export async function saveProductCatalogItem(input: ProductCatalogItem | ProductCatalogDraft, priceHistorySource = "mise a jour") {
  const now = new Date().toISOString();
  const hasId = "id" in input;
  const product: ProductCatalogItem = hasId
    ? {
        ...input,
        priceHistory: buildNextPriceHistory(input, now, priceHistorySource),
        updatedAt: now,
      }
    : {
        ...input,
        id: crypto.randomUUID(),
        priceHistory: [buildPriceHistoryEntry(input.standardPurchasePriceHt, input.recommendedSalePriceHt, now, "creation")],
        createdAt: now,
        updatedAt: now,
      };

  const { data, error } = await supabase
    .from(TABLE as any)
    .upsert(toRow(product), { onConflict: "id" })
    .select("*")
    .single()
    .overrideTypes<ProductCatalogRow>();

  if (error) {
    if (isMissingIsSellableColumn(error)) return saveProductCatalogItemLegacy(product);
    throw new Error(error.message);
  }
  return fromRow(data);
}

export async function deleteProductCatalogItem(id: string) {
  const { error } = await supabase.from(TABLE as any).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function getBestSupplierPrice(product: ProductCatalogItem, supplierId?: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = product.supplierPrices.filter((price) => {
    const supplierMatches = supplierId ? price.supplierId === supplierId : true;
    const startsOk = !price.startDate || price.startDate <= today;
    const endsOk = !price.endDate || price.endDate >= today;
    return supplierMatches && startsOk && endsOk;
  });
  return candidates.sort((a, b) => a.priceHt - b.priceHt)[0] ?? null;
}

function fromRow(row: ProductCatalogRow): ProductCatalogItem {
  return {
    id: row.id,
    designation: row.designation,
    internalReference: row.internal_reference,
    manufacturerReference: row.manufacturer_reference,
    brand: row.brand,
    category: row.category,
    unit: row.unit,
    vatRate: Number(row.vat_rate ?? 20),
    mainSupplierId: row.main_supplier_id,
    mainSupplierName: row.main_supplier_name,
    standardPurchasePriceHt: Number(row.standard_purchase_price_ht ?? 0),
    recommendedSalePriceHt: Number(row.recommended_sale_price_ht ?? 0),
    targetMarginRate: Number(row.target_margin_rate ?? 0),
    isSellable: row.is_sellable !== false,
    supplierPrices: row.supplier_prices ?? [],
    documents: row.documents ?? [],
    priceHistory: row.price_history ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(product: ProductCatalogItem) {
  return {
    id: product.id,
    designation: product.designation,
    internal_reference: product.internalReference,
    manufacturer_reference: product.manufacturerReference,
    brand: product.brand,
    category: product.category,
    unit: product.unit,
    vat_rate: product.vatRate,
    main_supplier_id: product.mainSupplierId,
    main_supplier_name: product.mainSupplierName,
    standard_purchase_price_ht: product.standardPurchasePriceHt,
    recommended_sale_price_ht: product.recommendedSalePriceHt,
    target_margin_rate: product.targetMarginRate,
    is_sellable: product.isSellable,
    supplier_prices: product.supplierPrices as any,
    documents: product.documents as any,
    price_history: product.priceHistory as any,
    created_at: product.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function toLegacyRow(product: ProductCatalogItem) {
  const row = toRow(product);
  delete (row as Record<string, unknown>).is_sellable;
  return row;
}

async function listProductCatalogItemsLegacy(): Promise<ProductCatalogItem[]> {
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .order("designation", { ascending: true })
    .overrideTypes<Omit<ProductCatalogRow, "is_sellable">[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => fromRow({ ...row, is_sellable: true }));
}

async function saveProductCatalogItemLegacy(product: ProductCatalogItem) {
  const { data, error } = await supabase
    .from(TABLE as any)
    .upsert(toLegacyRow(product), { onConflict: "id" })
    .select("*")
    .single()
    .overrideTypes<Omit<ProductCatalogRow, "is_sellable">>();

  if (error) throw new Error(error.message);
  return fromRow({ ...data, is_sellable: product.isSellable });
}

function buildNextPriceHistory(product: ProductCatalogItem, changedAt: string, source: string) {
  const history = Array.isArray(product.priceHistory) ? product.priceHistory : [];
  const lastEntry = history[history.length - 1];
  const purchasePriceHt = normalizePrice(product.standardPurchasePriceHt);
  const salePriceHt = normalizePrice(product.recommendedSalePriceHt);

  if (lastEntry && samePrice(lastEntry.purchasePriceHt, purchasePriceHt) && samePrice(lastEntry.salePriceHt, salePriceHt)) {
    return history;
  }

  return [...history, buildPriceHistoryEntry(purchasePriceHt, salePriceHt, changedAt, source)];
}

function buildPriceHistoryEntry(purchasePriceHt: number | null, salePriceHt: number | null, changedAt: string, source: string) {
  return {
    id: crypto.randomUUID(),
    purchasePriceHt,
    salePriceHt,
    changedAt,
    source,
  };
}

function normalizePrice(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function samePrice(a: unknown, b: unknown) {
  return normalizePrice(a) === normalizePrice(b);
}

function isMissingIsSellableColumn(error: { code?: string; message?: string } | null) {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "42703" || (msg.includes("is_sellable") && (msg.includes("schema cache") || msg.includes("could not find")));
}

async function migrateLegacyProductsIfNeeded() {
  const legacy = readLegacyProducts();
  if (!legacy.length) return;

  const { error } = await supabase
    .from(TABLE as any)
    .upsert(legacy.map(toRow), { onConflict: "id" });

  if (error) {
    if (!isMissingIsSellableColumn(error)) throw new Error(error.message);
    const { error: legacyError } = await supabase
      .from(TABLE as any)
      .upsert(legacy.map(toLegacyRow), { onConflict: "id" });
    if (legacyError) throw new Error(legacyError.message);
  }

  removeLegacyProducts();
}

function readLegacyProducts(): ProductCatalogItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProductCatalogItem[];
  } catch {
    return [];
  }
}

function removeLegacyProducts() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}