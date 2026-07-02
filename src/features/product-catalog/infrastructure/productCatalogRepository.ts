import { supabase } from "../../../lib/supabaseClient";
import type {
  ProductCatalogDraft,
  ProductCatalogItem,
  ProductDocument,
  ProductDocumentKind,
  ProductSupplierPrice,
} from "../domain/types";

const TABLE = "product_catalog_items";
const LEGACY_STORAGE_KEY = "batipro.product-catalog.v1";

const DEFAULT_DOCUMENT_USAGE_BY_KIND: Record<ProductDocumentKind, ProductDocument["usage"]> = {
  technical_sheet: { task: true, doe: true },
  manual: { task: true, doe: false },
  application_scope: { task: true, doe: false },
  work_method: { task: true, doe: false },
  sds: { task: true, doe: true },
  certification: { task: false, doe: true },
  photo: { task: false, doe: false },
  other: { task: false, doe: false },
};

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
        documents: normalizeProductDocuments(input.documents),
        priceHistory: buildNextPriceHistory(input, now, priceHistorySource),
        updatedAt: now,
      }
    : {
        ...input,
        id: crypto.randomUUID(),
        documents: normalizeProductDocuments(input.documents),
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
  const candidates = normalizeSupplierPrices(product.supplierPrices).filter((price) => {
    const supplierMatches = supplierId ? price.supplierId === supplierId : true;
    const startsOk = !price.startDate || price.startDate <= today;
    const endsOk = !price.endDate || price.endDate >= today;
    return supplierMatches && startsOk && endsOk;
  });
  return candidates.sort((a, b) => getSupplierUnitPurchasePrice(a) - getSupplierUnitPurchasePrice(b))[0] ?? null;
}

export function getSupplierUnitPurchasePrice(price: ProductSupplierPrice | null | undefined): number {
  if (!price) return 0;
  const explicitUnitPrice = normalizePrice(price.pricePerM2Ht);
  if (explicitUnitPrice !== null && explicitUnitPrice > 0) return explicitUnitPrice;

  const packagePrice = normalizePrice(price.priceHt);
  const coveredQuantity = normalizePrice(price.coverageM2);
  if (packagePrice !== null && packagePrice > 0 && coveredQuantity !== null && coveredQuantity > 0) {
    return Math.round((packagePrice / coveredQuantity) * 100) / 100;
  }

  return packagePrice !== null && packagePrice > 0 ? packagePrice : 0;
}

export function getProductUnitPurchasePrice(product: ProductCatalogItem, supplierId?: string | null): number {
  const supplierPrice = getBestSupplierPrice(product, supplierId);
  const supplierUnitPrice = getSupplierUnitPurchasePrice(supplierPrice);
  if (supplierUnitPrice > 0) return supplierUnitPrice;

  const standardPrice = normalizePrice(product.standardPurchasePriceHt);
  return standardPrice !== null && standardPrice > 0 ? standardPrice : 0;
}

export function getProductTaskDocuments(product: ProductCatalogItem): ProductDocument[] {
  return normalizeProductDocuments(product.documents).filter((document) => document.usage?.task === true);
}

export function getProductDoeDocuments(product: ProductCatalogItem): ProductDocument[] {
  return normalizeProductDocuments(product.documents).filter((document) => document.usage?.doe === true);
}

export function describeProductDocuments(product: ProductCatalogItem): string | null {
  const taskDocuments = getProductTaskDocuments(product);
  if (!taskDocuments.length) return null;

  return taskDocuments
    .map((document) => {
      const label = productDocumentKindLabel(document.kind);
      const url = document.url ? ` - ${document.url}` : "";
      const notes = document.notes ? ` (${document.notes})` : "";
      return `${label}: ${document.name}${url}${notes}`;
    })
    .join("\n");
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
    supplierPrices: normalizeSupplierPrices(row.supplier_prices ?? []),
    documents: normalizeProductDocuments(row.documents ?? []),
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
    supplier_prices: normalizeSupplierPrices(product.supplierPrices) as any,
    documents: normalizeProductDocuments(product.documents) as any,
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

function normalizeSupplierPrices(prices: ProductSupplierPrice[]): ProductSupplierPrice[] {
  if (!Array.isArray(prices)) return [];
  return prices
    .map((price) => {
      const priceHt = normalizePrice(price.priceHt);
      const pricePerM2Ht = normalizePrice(price.pricePerM2Ht);
      const coverageM2 = normalizePrice(price.coverageM2);
      return priceHt === null
        ? null
        : {
            ...price,
            priceHt,
            coverageM2,
            pricePerM2Ht: pricePerM2Ht ?? (coverageM2 && coverageM2 > 0 ? Math.round((priceHt / coverageM2) * 100) / 100 : null),
          };
    })
    .filter((price): price is ProductSupplierPrice => {
      if (!price || price.priceHt <= 0) return false;
      return Boolean(String(price.supplierId ?? "").trim() || String(price.supplierName ?? "").trim());
    });
}

function normalizeProductDocuments(documents: ProductDocument[] | unknown): ProductDocument[] {
  if (!Array.isArray(documents)) return [];

  return documents
    .map((document) => normalizeProductDocument(document))
    .filter((document): document is ProductDocument => Boolean(document));
}

function normalizeProductDocument(document: unknown): ProductDocument | null {
  const row = (document ?? {}) as Partial<ProductDocument> & Record<string, unknown>;
  const kind = normalizeProductDocumentKind(row.kind);
  const name = String(row.name ?? "").trim();
  const url = String(row.url ?? "").trim() || null;
  const notes = String(row.notes ?? "").trim() || null;

  if (!name && !url) return null;

  return {
    id: String(row.id ?? crypto.randomUUID()),
    kind,
    name: name || productDocumentKindLabel(kind),
    url,
    usage: {
      task: row.usage?.task ?? DEFAULT_DOCUMENT_USAGE_BY_KIND[kind].task,
      doe: row.usage?.doe ?? DEFAULT_DOCUMENT_USAGE_BY_KIND[kind].doe,
    },
    notes,
  };
}

function normalizeProductDocumentKind(value: unknown): ProductDocumentKind {
  const kind = String(value ?? "").trim();
  if (kind === "technical_sheet") return "technical_sheet";
  if (kind === "manual") return "manual";
  if (kind === "application_scope") return "application_scope";
  if (kind === "work_method") return "work_method";
  if (kind === "sds") return "sds";
  if (kind === "certification") return "certification";
  if (kind === "photo") return "photo";
  return "other";
}

function productDocumentKindLabel(kind: ProductDocumentKind) {
  if (kind === "technical_sheet") return "Fiche technique";
  if (kind === "manual") return "Notice";
  if (kind === "application_scope") return "Domaine d'application";
  if (kind === "work_method") return "Mode operatoire";
  if (kind === "sds") return "FDS";
  if (kind === "certification") return "Certification";
  if (kind === "photo") return "Photo";
  return "Autre";
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
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  const text = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[€]/g, "")
    .trim();
  if (!text) return null;
  if (!/^-?[\d\s.,]+$/.test(text)) return null;

  const compact = text.replace(/\s+/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = compact.split(".");
    const isThousandsFormat = parts.length > 1 && parts.slice(1).every((part) => /^\d{3}$/.test(part));
    normalized = isThousandsFormat ? parts.join("") : compact;
  }

  const n = Number(normalized);
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