import type { ProductCatalogItem, ProductMaterialUsage } from "../domain/types";

/**
 * Extraction du ratio materiau, de la perte et des notes techniques d'un produit.
 *
 * Remplace `taskTemplateProductAutofillBridge` (pilotage DOM par querySelector +
 * setters natifs HTMLInputElement). La logique metier est identique, mais elle
 * est ici pure et appelable depuis React.
 *
 * Ordre de priorite des sources :
 *   1. product.knowledge.materialUsage  (connaissance IA Coco, bc4eeb6)
 *   2. document.analysis.materialUsage  (analyse typee par document, main)
 *   3. heuristique regex sur le texte des documents (main)
 */

export type ProductRatioHint = {
  quantity: number | null;
  sourceUnit: string | null;
  ratioUnit: string | null;
  lossPercent: number | null;
  notes: string;
};

export type ProductPricingHint = {
  purchasePriceHt: number | null;
  salePriceHt: number | null;
};

type RatioMatch = {
  quantity: number;
  sourceUnit: string;
  ratioUnit: string;
};

export function getProductRatioHint(product: ProductCatalogItem): ProductRatioHint {
  const documentText = getProductDocumentText(product);
  const knowledgeRatio = buildKnowledgeRatioMatch(product);
  const materialUsage = findProductMaterialUsage(product);
  const structuredRatio = knowledgeRatio ?? (materialUsage ? buildStructuredRatioMatch(materialUsage) : null);
  const ratioMatch = structuredRatio ?? findRatioMatch(documentText);
  const lossMatch = documentText.match(/(?:Perte pr[eé]conis[eé]e|Perte extraite)\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*%/i);

  const knowledgeLoss = product.knowledge?.materialUsage?.value?.lossPercent ?? null;
  const lossPercent = knowledgeLoss ?? materialUsage?.lossPercent ?? parseLooseNumber(lossMatch?.[1]);

  const taskNotes = product.documents
    .filter(
      (document) =>
        document.usage?.task ||
        document.kind === "technical_sheet" ||
        document.kind === "application_scope" ||
        document.kind === "work_method",
    )
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

export function getProductPricingHint(product: ProductCatalogItem): ProductPricingHint {
  const purchasePriceHt = getProductPurchaseUnitPrice(product);
  return {
    purchasePriceHt,
    salePriceHt: getProductSaleUnitPrice(product, purchasePriceHt),
  };
}

function buildKnowledgeRatioMatch(product: ProductCatalogItem): RatioMatch | null {
  const usage = product.knowledge?.materialUsage?.value;
  if (!usage) return null;
  const quantity = usage.ratioQuantity;
  const sourceUnit = normalizeUnit(usage.sourceUnit);
  const ratioUnit = normalizeUnit(usage.ratioUnit);
  if (quantity === null || quantity <= 0 || !sourceUnit || !ratioUnit) return null;
  return { quantity, sourceUnit, ratioUnit };
}

function findProductMaterialUsage(product: ProductCatalogItem): ProductMaterialUsage | null {
  const usages = product.documents
    .map((document) => document.analysis?.materialUsage ?? null)
    .filter((usage): usage is ProductMaterialUsage =>
      Boolean(usage && usage.ratioQuantity > 0 && usage.ratioUnit && usage.sourceUnit),
    )
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return usages[0] ?? null;
}

function buildStructuredRatioMatch(materialUsage: ProductMaterialUsage): RatioMatch | null {
  const sourceUnit = normalizeUnit(materialUsage.sourceUnit);
  const ratioUnit = normalizeUnit(materialUsage.ratioUnit);
  if (!sourceUnit || !ratioUnit || materialUsage.ratioQuantity <= 0) return null;
  return { quantity: materialUsage.ratioQuantity, sourceUnit, ratioUnit };
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
  return { quantity: 1 / quantity, sourceUnit, ratioUnit };
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

export function normalizeUnit(value: unknown): string | null {
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
