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
  quantity: number | null;
  coverage_m2: number | null;
  purchase_price_ht: number | null;
  sale_price_ht: number | null;
  package_price_ht: number | null;
  vat_rate: number | null;
  packaging: string | null;
  minimum_quantity: number | null;
  consumption_ratio_quantity?: number | null;
  consumption_ratio_unit?: string | null;
  consumption_base_unit?: string | null;
  loss_percent?: number | null;
  work_method?: string | null;
  application_scope?: string | null;
  technical_notes?: string | null;
  business_interpretation?: string | null;
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
    throw new Error("Importez un devis PDF avant de lancer le lecteur.");
  }

  const documentSupplierName = inferDocumentSupplierName(cleanedText);
  const extractedProducts = (await extractProducts(cleanedText)).map((product) => normalizeExtractedProduct(product, documentSupplierName));
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

function normalizeExtractedProduct(product: ExtractedQuoteProduct, documentSupplierName: string | null): ExtractedQuoteProduct {
  return {
    ...product,
    supplier_name: preferDocumentSupplier(normalizeText(product.supplier_name), documentSupplierName),
    sale_price_ht: positivePrice(product.sale_price_ht),
    purchase_price_ht: positivePrice(product.purchase_price_ht),
    package_price_ht: positivePrice(product.package_price_ht),
  };
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
  const supplierNegotiatedPrice = supplierPriceFromQuote(extracted);
  const coverageM2 = positivePrice(extracted.coverage_m2);
  const catalogPurchasePrice = computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2) ?? supplierNegotiatedPrice;
  const salePrice = positivePrice(extracted.sale_price_ht) ?? computeSalePrice(catalogPurchasePrice, DEFAULT_MARGIN_RATE);
  const supplierPrice = buildSupplierPrice(extracted, supplier, supplierNegotiatedPrice);
  const unit = coverageM2 && coverageM2 > 0 ? "m2" : normalizeUnit(extracted.unit);

  return {
    designation: normalizeText(extracted.designation) ?? "Produit importé devis",
    internalReference: null,
    manufacturerReference: normalizeText(extracted.supplier_reference),
    brand: normalizeText(extracted.brand),
    category: normalizeText(extracted.category) ?? "Matériaux",
    unit,
    vatRate: positiveNumber(extracted.vat_rate) ?? 20,
    mainSupplierId: supplier?.id ?? null,
    mainSupplierName: supplier?.name ?? normalizeText(extracted.supplier_name),
    standardPurchasePriceHt: catalogPurchasePrice ?? 0,
    recommendedSalePriceHt: salePrice ?? catalogPurchasePrice ?? 0,
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
  const supplierNegotiatedPrice = supplierPriceFromQuote(extracted);
  const coverageM2 = positivePrice(extracted.coverage_m2);
  const catalogPurchasePrice = computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2) ?? supplierNegotiatedPrice;
  const salePrice = positivePrice(extracted.sale_price_ht) ?? computeSalePrice(catalogPurchasePrice, product.targetMarginRate || DEFAULT_MARGIN_RATE);
  const supplierPrice = buildSupplierPrice(extracted, supplier, supplierNegotiatedPrice);
  let changed = false;

  const next: ProductCatalogItem = { ...product, supplierPrices: [...product.supplierPrices] };
  const shouldReplaceCustomerSupplier = Boolean(supplier && next.mainSupplierName && looksLikeCustomerName(next.mainSupplierName));

  if (shouldReplaceCustomerSupplier) {
    next.mainSupplierId = supplier?.id ?? null;
    next.mainSupplierName = supplier?.name ?? normalizeText(extracted.supplier_name);
    changed = true;
  } else if (!next.mainSupplierId && supplier?.id) {
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

  const unit = coverageM2 && coverageM2 > 0 ? "m2" : normalizeUnit(extracted.unit);
  if (next.unit === "u" && unit !== "u") {
    next.unit = unit;
    changed = true;
  }

  const vatRate = positiveNumber(extracted.vat_rate);
  if ((!next.vatRate || next.vatRate === 0) && vatRate !== null) {
    next.vatRate = vatRate;
    changed = true;
  }

  const isMainSupplierImport = productMainSupplierMatches(next, supplier, extracted.supplier_name);

  if (catalogPurchasePrice !== null && (next.standardPurchasePriceHt === 0 || isMainSupplierImport) && !sameAmount(next.standardPurchasePriceHt, catalogPurchasePrice)) {
    next.standardPurchasePriceHt = catalogPurchasePrice;
    changed = true;
  }

  if (salePrice !== null && (next.recommendedSalePriceHt === 0 || isMainSupplierImport) && !sameAmount(next.recommendedSalePriceHt, salePrice)) {
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
  supplierNegotiatedPrice: number | null,
): ProductSupplierPrice | null {
  if (supplierNegotiatedPrice === null || supplierNegotiatedPrice <= 0) return null;
  if (!supplier && !normalizeText(extracted.supplier_name)) return null;

  const coverageM2 = positivePrice(extracted.coverage_m2);
  const pricePerM2 = computeCoverageUnitPrice(supplierNegotiatedPrice, coverageM2);

  return {
    id: crypto.randomUUID(),
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? normalizeText(extracted.supplier_name) ?? "",
    priceHt: supplierNegotiatedPrice,
    discountPercent: null,
    startDate: null,
    endDate: null,
    packaging: normalizeText(extracted.packaging),
    minimumQuantity: positiveNumber(extracted.quantity) ?? positiveNumber(extracted.minimum_quantity),
    deliveryLeadTimeDays: null,
    coverageM2,
    pricePerM2Ht: pricePerM2,
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
      && (price.minimumQuantity ?? null) === (candidate.minimumQuantity ?? null)
      && (price.coverageM2 ?? null) === (candidate.coverageM2 ?? null)
      && (price.pricePerM2Ht ?? null) === (candidate.pricePerM2Ht ?? null);
  });
}

function productMainSupplierMatches(product: ProductCatalogItem, supplier: SupplierRow | null, supplierName: string | null) {
  if (supplier?.id && product.mainSupplierId) return product.mainSupplierId === supplier.id;
  const candidateName = normalizeKey(supplier?.name ?? supplierName);
  return Boolean(candidateName && normalizeKey(product.mainSupplierName) === candidateName);
}

function preferDocumentSupplier(aiSupplierName: string | null, documentSupplierName: string | null): string | null {
  if (!documentSupplierName) return aiSupplierName;
  if (!aiSupplierName) return documentSupplierName;

  const aiKey = normalizeKey(aiSupplierName);
  const docKey = normalizeKey(documentSupplierName);
  if (!aiKey || aiKey === docKey) return documentSupplierName;
  if (looksLikeCustomerName(aiSupplierName)) return documentSupplierName;
  return aiSupplierName;
}

function looksLikeCustomerName(value: string): boolean {
  const key = normalizeKey(value);
  return key.includes("renovation") || key.includes("renov") || key.includes("client");
}

function inferDocumentSupplierName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50);

  const directSeller = lines.find((line) => /(?:comptoir|cp?toir|seigneurie|gauthier|ppg)/i.test(line));
  if (directSeller) return normalizeSupplierLine(directSeller);

  const devisIndex = lines.findIndex((line) => /\bdevis\b/i.test(line));
  const headerLines = devisIndex >= 0 ? lines.slice(0, devisIndex) : lines;
  const candidate = headerLines.find((line) => {
    const key = normalizeKey(line);
    if (!key || key.includes("siret") || key.includes("tva") || key.includes("tel") || key.includes("fax")) return false;
    if (/^[0-9\s,.-]+$/.test(line)) return false;
    if (looksLikeCustomerName(line)) return false;
    return /[A-Z]{3,}/.test(line);
  });

  return candidate ? normalizeSupplierLine(candidate) : null;
}

function normalizeSupplierLine(line: string): string {
  return line
    .replace(/^CSG\s+/i, "")
    .replace(/^CPTOIR\b/i, "COMPTOIR")
    .replace(/\s+/g, " ")
    .trim();
}

function sameAmount(a: unknown, b: unknown) {
  return roundPrice(Number(a)) === roundPrice(Number(b));
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

function positivePrice(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function supplierPriceFromQuote(extracted: ExtractedQuoteProduct): number | null {
  return positivePrice(extracted.purchase_price_ht) ?? positivePrice(extracted.package_price_ht);
}

function computeCoverageUnitPrice(price: number | null, coverageM2: number | null): number | null {
  if (price === null || coverageM2 === null || coverageM2 <= 0) return null;
  return roundPrice(price / coverageM2);
}

function computeSalePrice(purchasePrice: number | null, marginRate: number): number | null {
  if (purchasePrice === null) return null;
  return roundPrice(purchasePrice * (1 + marginRate / 100));
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
