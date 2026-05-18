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

  if (error) throw new Error(error.message);
  if (data?.length) return data.map(fromRow);

  const seed = createSeedProducts();
  await Promise.all(seed.map((product) => saveProductCatalogItem(product)));
  return seed;
}

export async function saveProductCatalogItem(input: ProductCatalogItem | ProductCatalogDraft) {
  const now = new Date().toISOString();
  const hasId = "id" in input;
  const product: ProductCatalogItem = hasId
    ? { ...input, updatedAt: now }
    : {
        ...input,
        id: crypto.randomUUID(),
        priceHistory: [{ id: crypto.randomUUID(), priceHt: input.standardPurchasePriceHt, changedAt: now, source: "creation" }],
        createdAt: now,
        updatedAt: now,
      };

  const { data, error } = await supabase
    .from(TABLE as any)
    .upsert(toRow(product), { onConflict: "id" })
    .select("*")
    .single()
    .overrideTypes<ProductCatalogRow>();

  if (error) throw new Error(error.message);
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
    supplier_prices: product.supplierPrices as any,
    documents: product.documents as any,
    price_history: product.priceHistory as any,
    created_at: product.createdAt,
    updated_at: new Date().toISOString(),
  };
}

async function migrateLegacyProductsIfNeeded() {
  const legacy = readLegacyProducts();
  if (!legacy.length) return;

  const { error } = await supabase
    .from(TABLE as any)
    .upsert(legacy.map(toRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
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

function createSeedProducts(): ProductCatalogItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      designation: "Plaque BA13 standard",
      internalReference: "PLACO-BA13",
      manufacturerReference: "BA13-2500",
      brand: "Placo",
      category: "Platrerie",
      unit: "u",
      vatRate: 20,
      mainSupplierId: null,
      mainSupplierName: "Fournisseur principal",
      standardPurchasePriceHt: 8.9,
      recommendedSalePriceHt: 13.5,
      targetMarginRate: 34,
      supplierPrices: [],
      documents: [{ id: crypto.randomUUID(), kind: "technical_sheet", name: "Fiche technique BA13", url: null }],
      priceHistory: [{ id: crypto.randomUUID(), priceHt: 8.9, changedAt: now, source: "seed" }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      designation: "Colle carrelage C2",
      internalReference: "COL-C2",
      manufacturerReference: "C2-25KG",
      brand: "Weber",
      category: "Carrelage",
      unit: "u",
      vatRate: 20,
      mainSupplierId: null,
      mainSupplierName: "Fournisseur principal",
      standardPurchasePriceHt: 18.5,
      recommendedSalePriceHt: 28,
      targetMarginRate: 34,
      supplierPrices: [],
      documents: [{ id: crypto.randomUUID(), kind: "sds", name: "FDS colle C2", url: null }],
      priceHistory: [{ id: crypto.randomUUID(), priceHt: 18.5, changedAt: now, source: "seed" }],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
