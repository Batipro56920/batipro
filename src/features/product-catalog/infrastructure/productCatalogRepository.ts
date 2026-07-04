import { supabase } from "../../../lib/supabaseClient";
import type { ProductCatalogDraft, ProductCatalogItem, ProductDocument, ProductDocumentAnalysis, ProductDocumentKind, ProductMaterialUsage, ProductSupplierPrice } from "../domain/types";

const TABLE = "product_catalog_items";
const LEGACY_STORAGE_KEY = "batipro.product-catalog.v1";

const PRODUCT_DOCUMENT_KINDS: ProductDocumentKind[] = [
  "technical_sheet",
  "manual",
  "application_scope",
  "work_method",
  "sds",
  "certification",
  "photo",
  "other",
];

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
  documents: unknown;
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
  let product: ProductCatalogItem;

  if ("id" in input) {
    const normalizedProduct: ProductCatalogItem = {
      ...input,
      supplierPrices: normalizeSupplierPrices(input.supplierPrices),
      documents: normalizeProductDocuments(input.documents),
    };
    product = {
      ...normalizedProduct,
      priceHistory: buildNextPriceHistory(normalizedProduct, now, priceHistorySource),
      updatedAt: now,
    };
  } else {
    const normalizedDraft: ProductCatalogDraft = {
      ...input,
      supplierPrices: normalizeSupplierPrices(input.supplierPrices),
      documents: normalizeProductDocuments(input.documents),
    };
    product = {
      ...normalizedDraft,
      id: crypto.randomUUID(),
      priceHistory: [buildPriceHistoryEntry(normalizedDraft.standardPurchasePriceHt, normalizedDraft.recommendedSalePriceHt, now, "creation")],
      createdAt: now,
      updatedAt: now,
    };
  }

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
  const bestPrice = candidates.sort((a, b) => getSupplierUnitPrice(a) - getSupplierUnitPrice(b))[0] ?? null;
  if (!bestPrice) return null;

  return {
    ...bestPrice,
    priceHt: getSupplierUnitPrice(bestPrice),
  };
}

function fromRow(row: ProductCatalogRow): ProductCatalogItem {
  const purchasePrice = Number(row.standard_purchase_price_ht ?? 0);
  const savedSalePrice = Number(row.recommended_sale_price_ht ?? 0);
  const marginRate = Number(row.target_margin_rate ?? 0);
  const salePrice = savedSalePrice > 0 ? savedSalePrice : computeSalePrice(purchasePrice, marginRate) ?? 0;

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
    standardPurchasePriceHt: purchasePrice,
    recommendedSalePriceHt: salePrice,
    targetMarginRate: marginRate,
    isSellable: row.is_sellable !== false,
    supplierPrices: normalizeSupplierPrices(row.supplier_prices ?? []),
    documents: normalizeProductDocuments(row.documents),
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
      return priceHt === null ? null : { ...price, priceHt };
    })
    .filter((price): price is ProductSupplierPrice => {
      if (!price || price.priceHt <= 0) return false;
      return Boolean(String(price.supplierId ?? "").trim() || String(price.supplierName ?? "").trim());
    });
}

function normalizeProductDocuments(documents: unknown): ProductDocument[] {
  if (!Array.isArray(documents)) return [];

  return documents
    .map((document, index): ProductDocument | null => {
      if (typeof document === "string") {
        const name = document.trim();
        if (!name) return null;
        return {
          id: buildLegacyDocumentId(index, name),
          kind: "other",
          name,
          url: null,
          usage: defaultDocumentUsage("other"),
          notes: null,
          analysis: null,
        };
      }

      if (!document || typeof document !== "object") return null;
      const source = document as Partial<ProductDocument> & Record<string, unknown>;
      const kind = normalizeDocumentKind(source.kind);
      const name = String(source.name ?? "").trim() || documentKindLabel(kind);
      const url = typeof source.url === "string" && source.url.trim() ? source.url.trim() : null;
      const notes = typeof source.notes === "string" && source.notes.trim() ? source.notes.trim() : null;
      const analysis = normalizeDocumentAnalysis(source.analysis);

      return {
        id: typeof source.id === "string" && source.id.trim() ? source.id : buildLegacyDocumentId(index, `${kind}-${name}`),
        kind,
        name,
        url,
        usage: normalizeDocumentUsage(source.usage, kind),
        notes,
        analysis,
      };
    })
    .filter((document): document is ProductDocument => Boolean(document && (document.name || document.url || document.notes || document.analysis)));
}

function normalizeDocumentAnalysis(value: unknown): ProductDocumentAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const materialUsage = normalizeMaterialUsage(source.materialUsage);
  const confidence = normalizeNullableNumber(source.confidence);
  const analysis: ProductDocumentAnalysis = {
    materialUsage,
    source: typeof source.source === "string" && source.source.trim() ? source.source.trim() : null,
    confidence,
  };
  return materialUsage || analysis.source || confidence !== null ? analysis : null;
}

function normalizeMaterialUsage(value: unknown): ProductMaterialUsage | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const ratioQuantity = normalizePrice(source.ratioQuantity);
  const ratioUnit = typeof source.ratioUnit === "string" && source.ratioUnit.trim() ? source.ratioUnit.trim() : null;
  const sourceUnit = typeof source.sourceUnit === "string" && source.sourceUnit.trim() ? source.sourceUnit.trim() : null;
  if (ratioQuantity === null || ratioQuantity <= 0 || !ratioUnit || !sourceUnit) return null;
  return {
    ratioQuantity,
    ratioUnit,
    sourceUnit,
    lossPercent: normalizeNullableNumber(source.lossPercent),
    confidence: normalizeNullableNumber(source.confidence),
    reasoning: typeof source.reasoning === "string" && source.reasoning.trim() ? source.reasoning.trim() : null,
  };
}

function normalizeNullableNumber(value: unknown): number | null {
  const number = normalizePrice(value);
  return number !== null && number >= 0 ? number : null;
}

function normalizeDocumentKind(kind: unknown): ProductDocumentKind {
  return PRODUCT_DOCUMENT_KINDS.includes(kind as ProductDocumentKind) ? kind as ProductDocumentKind : "other";
}

function normalizeDocumentUsage(usage: unknown, kind: ProductDocumentKind) {
  const defaultUsage = defaultDocumentUsage(kind);
  if (!usage || typeof usage !== "object") return defaultUsage;
  const source = usage as Record<string, unknown>;
  return {
    task: typeof source.task === "boolean" ? source.task : defaultUsage.task,
    doe: typeof source.doe === "boolean" ? source.doe : defaultUsage.doe,
  };
}

function defaultDocumentUsage(kind: ProductDocumentKind) {
  if (kind === "technical_sheet" || kind === "sds") return { task: true, doe: true };
  if (kind === "manual" || kind === "application_scope" || kind === "work_method") return { task: true, doe: false };
  if (kind === "certification") return { task: false, doe: true };
  return { task: false, doe: false };
}

function documentKindLabel(kind: ProductDocumentKind) {
  if (kind === "technical_sheet") return "Fiche technique";
  if (kind === "manual") return "Notice";
  if (kind === "application_scope") return "Domaine d'application";
  if (kind === "work_method") return "Mode operatoire";
  if (kind === "sds") return "FDS";
  if (kind === "certification") return "Certification";
  if (kind === "photo") return "Photo";
  return "Autre";
}

function buildLegacyDocumentId(index: number, label: string) {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `legacy-doc-${index}-${slug || "document"}`;
}

function getSupplierUnitPrice(price: ProductSupplierPrice): number {
  const explicitUnitPrice = normalizePrice(price.pricePerM2Ht);
  if (explicitUnitPrice !== null && explicitUnitPrice > 0) return explicitUnitPrice;

  const packagePrice = normalizePrice(price.priceHt) ?? 0;
  const coveredQuantity = normalizePrice(price.coverageM2);
  if (packagePrice > 0 && coveredQuantity !== null && coveredQuantity > 0) {
    return Math.round((packagePrice / coveredQuantity) * 100) / 100;
  }

  return packagePrice;
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

function computeSalePrice(purchasePrice: number, marginRate: number) {
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return null;
  if (!Number.isFinite(marginRate) || marginRate <= 0) return null;
  return Math.round(purchasePrice * (1 + marginRate / 100) * 100) / 100;
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
    const products = JSON.parse(raw) as ProductCatalogItem[];
    return Array.isArray(products)
      ? products.map((product) => ({ ...product, documents: normalizeProductDocuments(product.documents) }))
      : [];
  } catch {
    return [];
  }
}

function removeLegacyProducts() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
