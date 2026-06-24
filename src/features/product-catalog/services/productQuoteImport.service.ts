import { supabase } from "../../../lib/supabaseClient";
import type { SupplierRow } from "../../../services/suppliers.service";
import { createSupplier } from "../../../services/suppliers.service";
import type { DocumentUnit } from "../../document-engine";
import type { ProductCatalogDraft, ProductCatalogItem, ProductSupplierPrice } from "../domain/types";
import { saveProductCatalogItem } from "../infrastructure/productCatalogRepository";

export type ExtractedQuoteProduct = {
  designation: string;
  supplier_name: string | null;
  supplier_reference: string | null;
  brand: string | null;
  category: string | null;
  unit: DocumentUnit;
  purchase_price_ht: number | null;
  sale_price_ht: number | null;
  vat_rate: number | null;
  packaging: string | null;
  minimum_quantity: number | null;
  confidence: number;
  source_line: string;
};

export type ProductQuoteImportResult = {
  extracted: number;
  createdProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  createdSuppliers: number;
  products: ProductCatalogItem[];
};

type ExtractProductsResponse = {
  ok?: boolean;
  error?: string;
  products?: ExtractedQuoteProduct[];
};

const DEFAULT_MARGIN_RATE = 30;
const SOURCE_NOTE = "Import devis produit";

export async function importProductsFromQuoteText(
  quoteText: string,
  suppliers: SupplierRow[],
  existingProducts: ProductCatalogItem[],
): Promise<ProductQuoteImportResult> {
  const cleanedText = quoteText.trim();
  if (cleanedText.length < 20) {
    throw new Error("Collez le texte du devis avant de lancer le lecteur.");
  }

  const extractedProducts = await extractProducts(cleanedText);
  const supplierByName = new Map(suppliers.map((supplier) => [normalizeKey(supplier.name), supplier]));
  const productByKey = buildProductIdentityIndex(existingProducts);
  const importedProducts: ProductCatalogItem[] = [];
  let createdSuppliers = 0;
  let createdProducts = 0;
  let updatedProducts = 0;
  let skippedProducts = 0;

  for (const extracted of extractedProducts) {
    const designation = normalizeText(extracted.designation);
    if (!designation) continue;

    const existingProduct = findExistingProduct(extracted, productByKey);
    const supplier = await resolveSupplier(extracted.supplier_name, supplierByName);
    if (supplier?.created) createdSuppliers += 1;

    if (existingProduct) {
      const nextProduct = mergeExtractedProduct(existingProduct, extracted, supplier?.row ?? null);
      if (!nextProduct) {
        skippedProducts += 1;
        continue;
      }

      const savedProduct = await saveProductCatalogItem(nextProduct, SOURCE_NOTE);
      importedProducts.push(savedProduct);
      indexProduct(savedProduct, productByKey);
      updatedProducts += 1;
      continue;
    }

    const draft = toProductDraft(extracted, supplier?.row ?? null);
    const savedProduct = await saveProductCatalogItem(draft, SOURCE_NOTE);
    importedProducts.push(savedProduct);
    indexProduct(savedProduct, productByKey);
    createdProducts += 1;
  }

  return {
    extracted: extractedProducts.length,
    createdProducts,
    updatedProducts,
    skippedProducts,
    createdSuppliers,
    products: importedProducts,
  };
}

async function extractProducts(cleanedText: string): Promise<ExtractedQuoteProduct[]> {
  const { data, error } = await supabase.functions.invoke<ExtractProductsResponse>("extract-devis-products", {
    body: { cleaned_text: cleanedText },
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Lecture du devis impossible.");
  return (data.products ?? []).filter((product) => Boolean(normalizeText(product.designation)));
}

async function resolveSupplier(
  supplierName: string | null,
  supplierByName: Map<string, SupplierRow>,
): Promise<{ row: SupplierRow; created: boolean } | null> {
  const name = normalizeText(supplierName);
  if (!name) return null;

  const key = normalizeKey(name);
  const existing = supplierByName.get(key);
  if (existing) return { row: existing, created: false };

  const created = await createSupplier({
    name,
    specialty: "Fournisseur matériaux",
    notes: SOURCE_NOTE,
    is_active: true,
  });
  supplierByName.set(key, created);
  return { row: created, created: true };
}

function toProductDraft(extracted: ExtractedQuoteProduct, supplier: SupplierRow | null): ProductCatalogDraft {
  const purchasePrice = positiveNumber(extracted.purchase_price_ht);
  const salePrice = positiveNumber(extracted.sale_price_ht) ?? computeSalePrice(purchasePrice, DEFAULT_MARGIN_RATE);
  const supplierPrice = buildSupplierPrice(extracted, supplier, purchasePrice);

  return {
    designation: normalizeText(extracted.designation) ?? "Produit importé devis",
    internalReference: null,
    manufacturerReference: normalizeText(extracted.supplier_reference),
    brand: normalizeText(extracted.brand),
    category: normalizeText(extracted.category) ?? "Matériaux",
    unit: normalizeUnit(extracted.unit),
    vatRate: positiveNumber(extracted.vat_rate) ?? 20,
    mainSupplierId: supplier?.id ?? null,
    mainSupplierName: supplier?.name ?? normalizeText(extracted.supplier_name),
    standardPurchasePriceHt: purchasePrice ?? 0,
    recommendedSalePriceHt: salePrice ?? purchasePrice ?? 0,
    targetMarginRate: DEFAULT_MARGIN_RATE,
    isSellable: true,
    supplierPrices: supplierPrice ? [supplierPrice] : [],
    documents: [],
  };
}

function mergeExtractedProduct(
  product: ProductCatalogItem,
  extracted: ExtractedQuoteProduct,
  supplier: SupplierRow | null,
): ProductCatalogItem | null {
  const purchasePrice = positiveNumber(extracted.purchase_price_ht);
  const salePrice = positiveNumber(extracted.sale_price_ht) ?? computeSalePrice(purchasePrice, product.targetMarginRate || DEFAULT_MARGIN_RATE);
  const supplierPrice = buildSupplierPrice(extracted, supplier, purchasePrice);
  let changed = false;

  const next: ProductCatalogItem = { ...product, supplierPrices: [...product.supplierPrices] };

  if (!next.mainSupplierId && supplier?.id) {
    next.mainSupplierId = supplier.id;
    next.mainSupplierName = supplier.name;
    changed = true;
  } else if (!next.mainSupplierName && normalizeText(extracted.supplier_name)) {
    next.mainSupplierName = normalizeText(extracted.supplier_name);
    changed = true;
  }

  const supplierReference = normalizeText(extracted.supplier_reference);
  if (!next.manufacturerReference && supplierReference) {
    next.manufacturerReference = supplierReference;
    changed = true;
  }

  const brand = normalizeText(extracted.brand);
  if (!next.brand && brand) {
    next.brand = brand;
    changed = true;
  }

  const category = normalizeText(extracted.category);
  if (!next.category && category) {
    next.category = category;
    changed = true;
  }

  const unit = normalizeUnit(extracted.unit);
  if (next.unit === "u" && unit !== "u") {
    next.unit = unit;
    changed = true;
  }

  const vatRate = positiveNumber(extracted.vat_rate);
  if ((!next.vatRate || next.vatRate === 0) && vatRate !== null) {
    next.vatRate = vatRate;
    changed = true;
  }

  if (next.standardPurchasePriceHt === 0 && purchasePrice !== null) {
    next.standardPurchasePriceHt = purchasePrice;
    changed = true;
  }

  if (next.recommendedSalePriceHt === 0 && salePrice !== null) {
    next.recommendedSalePriceHt = salePrice;
    changed = true;
  }

  if (supplierPrice && !hasSupplierPrice(next.supplierPrices, supplierPrice)) {
    next.supplierPrices.push(supplierPrice);
    changed = true;
  }

  return changed ? next : null;
}

function buildSupplierPrice(
  extracted: ExtractedQuoteProduct,
  supplier: SupplierRow | null,
  purchasePrice: number | null,
): ProductSupplierPrice | null {
  if (!supplier && !normalizeText(extracted.supplier_name) && purchasePrice === null) return null;

  return {
    id: crypto.randomUUID(),
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? normalizeText(extracted.supplier_name) ?? "",
    priceHt: purchasePrice ?? 0,
    discountPercent: null,
    startDate: null,
    endDate: null,
    packaging: normalizeText(extracted.packaging),
    minimumQuantity: positiveNumber(extracted.minimum_quantity),
    deliveryLeadTimeDays: null,
  };
}

function buildProductIdentityIndex(products: ProductCatalogItem[]) {
  const index = new Map<string, ProductCatalogItem>();
  products.forEach((product) => indexProduct(product, index));
  return index;
}

function indexProduct(product: ProductCatalogItem, index: Map<string, ProductCatalogItem>) {
  for (const key of productIdentityKeys(product)) {
    index.set(key, product);
  }
}

function findExistingProduct(product: ExtractedQuoteProduct, index: Map<string, ProductCatalogItem>) {
  for (const key of extractedProductIdentityKeys(product)) {
    const existing = index.get(key);
    if (existing) return existing;
  }
  return null;
}

function productIdentityKeys(product: ProductCatalogItem) {
  const designation = normalizeKey(product.designation);
  const reference = normalizeKey(product.manufacturerReference);
  const keys = new Set<string>();

  addProductIdentityKey(keys, designation, product.mainSupplierName, reference);
  for (const supplierPrice of product.supplierPrices) {
    addProductIdentityKey(keys, designation, supplierPrice.supplierName, reference);
  }
  if (reference) addProductIdentityKey(keys, designation, null, reference);

  return Array.from(keys);
}

function extractedProductIdentityKeys(product: ExtractedQuoteProduct) {
  const designation = normalizeKey(product.designation);
  const reference = normalizeKey(product.supplier_reference);
  const keys = new Set<string>();

  addProductIdentityKey(keys, designation, product.supplier_name, reference);
  if (reference) addProductIdentityKey(keys, designation, null, reference);

  return Array.from(keys);
}

function addProductIdentityKey(keys: Set<string>, designation: string, supplierName: unknown, reference: string) {
  if (!designation) return;
  const supplier = normalizeKey(supplierName);
  if (!supplier && !reference) return;
  keys.add([designation, supplier, reference].join("|"));
}

function hasSupplierPrice(prices: ProductSupplierPrice[], candidate: ProductSupplierPrice) {
  return prices.some((price) => {
    const sameSupplier = candidate.supplierId
      ? price.supplierId === candidate.supplierId
      : normalizeKey(price.supplierName) === normalizeKey(candidate.supplierName);
    return sameSupplier
      && price.priceHt === candidate.priceHt
      && normalizeKey(price.packaging) === normalizeKey(candidate.packaging)
      && (price.minimumQuantity ?? null) === (candidate.minimumQuantity ?? null);
  });
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeUnit(unit: unknown): DocumentUnit {
  const value = normalizeKey(unit);
  if (["m2", "m 2", "m²"].includes(value)) return "m2";
  if (["m3", "m 3"].includes(value)) return "m3";
  if (["ml", "m", "metre lineaire"].includes(value)) return "ml";
  if (["kg", "kilo"].includes(value)) return "kg";
  if (["l", "litre"].includes(value)) return "l";
  if (["h", "heure"].includes(value)) return "h";
  if (["forfait", "ens", "ensemble"].includes(value)) return "forfait";
  return "u";
}

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function computeSalePrice(purchasePrice: number | null, marginRate: number): number | null {
  if (purchasePrice === null) return null;
  return roundPrice(purchasePrice * (1 + marginRate / 100));
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
