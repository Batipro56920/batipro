import type { ProductCatalogItem, ProductMaterialUsage } from "../domain/types";
import { listProductCatalogItems } from "../infrastructure/productCatalogRepository";

type ProductRatioHint = {
  quantity: number | null;
  sourceUnit: string | null;
  ratioUnit: string | null;
  lossPercent: number | null;
  notes: string;
};

type RatioMatch = {
  quantity: number;
  sourceUnit: string;
  ratioUnit: string;
};

let installed = false;
let productsPromise: Promise<ProductCatalogItem[]> | null = null;

export function installTaskTemplateProductAutofillBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("change", onPotentialProductSelection, true);
}

async function onPotentialProductSelection(event: Event) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;
  if (!looksLikeTaskTemplateProductSelect(select)) return;

  const productId = select.value;
  if (!productId) return;

  const row = findMaterialRow(select);
  if (!row) return;

  const products = await loadProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  window.setTimeout(() => applyProductTechnicalAutofill(row, product), 40);
  window.setTimeout(() => applyProductTechnicalAutofill(row, product), 140);
  window.setTimeout(() => applyProductTechnicalAutofill(row, product), 280);
}

function looksLikeTaskTemplateProductSelect(select: HTMLSelectElement) {
  const firstOption = select.options.item(0)?.textContent?.toLowerCase() ?? "";
  return firstOption.includes("ligne libre") && firstOption.includes("produit catalogue");
}

function findMaterialRow(select: HTMLSelectElement) {
  return select.closest("div.space-y-3.rounded-2xl") as HTMLElement | null;
}

function loadProducts() {
  productsPromise ??= listProductCatalogItems().catch(() => []);
  return productsPromise;
}

function applyProductTechnicalAutofill(row: HTMLElement, product: ProductCatalogItem) {
  const inputs = Array.from(row.querySelectorAll("input"));
  if (inputs.length < 6) return;

  const hint = getProductRatioHint(product);
  const purchasePrice = getProductPurchaseUnitPrice(product);
  const salePrice = getProductSaleUnitPrice(product, purchasePrice);
  const templateUnit = getTemplateUnit(row);

  setInputValue(inputs[0], product.designation);
  setInputValue(inputs[1], hint.sourceUnit ?? templateUnit ?? "");
  if (hint.quantity !== null) setInputValue(inputs[2], formatNumber(hint.quantity));
  setInputValue(inputs[3], hint.ratioUnit ?? product.unit);
  if (hint.lossPercent !== null) setInputValue(inputs[4], formatNumber(hint.lossPercent));
  if (hint.notes) setInputValue(inputs[5], hint.notes);
  if (inputs[6] && purchasePrice !== null) setInputValue(inputs[6], formatNumber(purchasePrice));
  if (inputs[7] && salePrice !== null) setInputValue(inputs[7], formatNumber(salePrice));
}

function setInputValue(input: HTMLInputElement, value: string) {
  if (input.value === value) return;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function getProductRatioHint(product: ProductCatalogItem): ProductRatioHint {
  const documentText = getProductDocumentText(product);
  const materialUsage = findProductMaterialUsage(product);
  const structuredRatio = materialUsage ? buildStructuredRatioMatch(materialUsage) : null;
  const ratioMatch = structuredRatio ?? findRatioMatch(documentText);
  const lossMatch = documentText.match(/(?:Perte pr[eé]conis[eé]e|Perte extraite)\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*%/i);

  const lossPercent = materialUsage?.lossPercent ?? parseLooseNumber(lossMatch?.[1]);

  const taskNotes = product.documents
    .filter((document) => document.usage?.task || document.kind === "technical_sheet" || document.kind === "application_scope" || document.kind === "work_method")
    .map((document) => {
      const note = String(document.notes ?? "").trim();
      return note ? `${document.name}: ${note}` : document.name;
    })
    .filter((line) => line.trim().length > 0)
    .slice(0, 3)
    .join("\n\n");

  return {
    quantity: ratioMatch?.quantity ?? null,
    sourceUnit: ratioMatch?.sourceUnit ?? null,
    ratioUnit: ratioMatch?.ratioUnit ?? null,
    lossPercent,
    notes: taskNotes,
  };
}

function findProductMaterialUsage(product: ProductCatalogItem): ProductMaterialUsage | null {
  const usages = product.documents
    .map((document) => document.analysis?.materialUsage ?? null)
    .filter((usage): usage is ProductMaterialUsage => Boolean(usage && usage.ratioQuantity > 0 && usage.ratioUnit && usage.sourceUnit))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return usages[0] ?? null;
}

function buildStructuredRatioMatch(materialUsage: ProductMaterialUsage): RatioMatch | null {
  const sourceUnit = normalizeUnit(materialUsage.sourceUnit);
  const ratioUnit = normalizeUnit(materialUsage.ratioUnit);
  if (!sourceUnit || !ratioUnit || materialUsage.ratioQuantity <= 0) return null;
  return {
    quantity: materialUsage.ratioQuantity,
    sourceUnit,
    ratioUnit,
  };
}

function getProductPurchaseUnitPrice(product: ProductCatalogItem) {
  const standardPurchase = normalizePrice(product.standardPurchasePriceHt);
  if (standardPurchase !== null && standardPurchase > 0) return standardPurchase;

  const supplierPrices = Array.isArray(product.supplierPrices) ? product.supplierPrices : [];
  const supplierUnitPrices = supplierPrices
    .map((price) => normalizePrice(price.pricePerM2Ht) ?? normalizePrice(price.priceHt))
    .filter((price): price is number => price !== null && price > 0)
    .sort((a, b) => a - b);
  return supplierUnitPrices[0] ?? null;
}

function getProductSaleUnitPrice(product: ProductCatalogItem, purchasePrice: number | null) {
  const recommendedSale = normalizePrice(product.recommendedSalePriceHt);
  if (recommendedSale !== null && recommendedSale > 0) return recommendedSale;
  if (purchasePrice === null) return null;

  const margin = normalizePrice(product.targetMarginRate) ?? 30;
  return Math.round(purchasePrice * (1 + margin / 100) * 100) / 100;
}

function getProductDocumentText(product: ProductCatalogItem) {
  return product.documents
    .map((document) => [document.name, document.notes].filter(Boolean).join("\n"))
    .join("\n\n");
}

function findRatioMatch(documentText: string): RatioMatch | null {
  const directLabelMatch = documentText.match(
    /(?:Ratio mat[eé]riau Batipro|Consommation(?:\s+(?:moyenne|th[eé]orique|indicative|recommand[eé]e|pr[eé]conis[eé]e|extraite))?|Dosage(?:\s+(?:moyen|recommand[eé]|pr[eé]conis[eé]))?)\s*:?\s*([0-9]+(?:[,.][0-9]+)?)\s*([^\s/]+)\s*\/\s*([^\s\n]+)/i,
  );
  const directRatio = buildDirectRatioMatch(directLabelMatch);
  if (directRatio) return directRatio;

  const rendementMatch = documentText.match(
    /(?:Rendement(?:\s+(?:moyen|th[eé]orique|indicatif|pratique))?|Couverture|Pouvoir couvrant)\s*:?\s*([0-9]+(?:[,.][0-9]+)?)\s*([^\s/]+)\s*\/\s*([^\s\n]+)/i,
  );
  return buildRendementRatioMatch(rendementMatch);
}

function buildDirectRatioMatch(match: RegExpMatchArray | null): RatioMatch | null {
  if (!match) return null;
  const quantity = parseLooseNumber(match[1]);
  const ratioUnit = normalizeUnit(match[2]);
  const sourceUnit = normalizeUnit(match[3]);
  if (quantity === null || !sourceUnit || !ratioUnit) return null;
  return { quantity, sourceUnit, ratioUnit };
}

function buildRendementRatioMatch(match: RegExpMatchArray | null): RatioMatch | null {
  if (!match) return null;
  const quantity = parseLooseNumber(match[1]);
  const sourceUnit = normalizeUnit(match[2]);
  const ratioUnit = normalizeUnit(match[3]);
  if (quantity === null || quantity <= 0 || !sourceUnit || !ratioUnit) return null;
  return {
    quantity: 1 / quantity,
    sourceUnit,
    ratioUnit,
  };
}

function getTemplateUnit(row: HTMLElement): string | null {
  const drawer = row.closest(".fixed.inset-0") as HTMLElement | null;
  if (!drawer) return null;

  const labels = Array.from(drawer.querySelectorAll("label"));
  for (const label of labels) {
    if (row.contains(label)) continue;
    const labelText = normalizeKey(label.textContent);
    if (!labelText.includes("unite")) continue;
    const input = label.querySelector("input");
    const value = normalizeUnit(input?.value);
    if (value) return value;
  }

  return null;
}

function parseLooseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePrice(value: unknown): number | null {
  const parsed = parseLooseNumber(value);
  return parsed !== null ? Math.round(parsed * 100) / 100 : null;
}

function normalizeUnit(value: unknown): string | null {
  const unit = normalizeKey(value);
  if (!unit) return null;
  if (["m2", "m 2"].includes(unit)) return "m2";
  if (["m3", "m 3"].includes(unit)) return "m3";
  if (["l", "litre", "litres", "liter", "liters", "pot", "seau"].includes(unit)) return "l";
  if (["kg", "kilo", "kilos", "sac"].includes(unit)) return "kg";
  if (["g", "gramme", "grammes"].includes(unit)) return "g";
  if (["ml", "millilitre", "millilitres", "metre lineaire", "m"].includes(unit)) return "ml";
  if (["u", "unite", "unites"].includes(unit)) return "u";
  return unit;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10000) / 10000);
}
