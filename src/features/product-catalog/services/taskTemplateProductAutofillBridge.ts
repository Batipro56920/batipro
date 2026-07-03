import type { ProductCatalogItem } from "../domain/types";
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

  setInputValue(inputs[0], product.designation);
  setInputValue(inputs[1], hint.sourceUnit ?? product.unit);
  if (hint.quantity !== null) setInputValue(inputs[2], formatNumber(hint.quantity));
  setInputValue(inputs[3], hint.ratioUnit ?? product.unit);
  if (hint.lossPercent !== null) setInputValue(inputs[4], formatNumber(hint.lossPercent));
  if (hint.notes) setInputValue(inputs[5], hint.notes);
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
  const ratioMatch = findRatioMatch(documentText);
  const lossMatch = documentText.match(/(?:Perte pr[eé]conis[eé]e|Perte extraite)\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*%/i);

  const lossPercent = parseLooseNumber(lossMatch?.[1]);

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
    sourceUnit: ratioMatch?.sourceUnit ?? product.unit,
    ratioUnit: ratioMatch?.ratioUnit ?? null,
    lossPercent,
    notes: taskNotes,
  };
}

function getProductDocumentText(product: ProductCatalogItem) {
  return product.documents
    .map((document) => [document.name, document.notes].filter(Boolean).join("\n"))
    .join("\n\n");
}

function findRatioMatch(documentText: string): RatioMatch | null {
  const directLabelMatch = documentText.match(
    /(?:Ratio mat[eé]riau Batipro|Consommation(?:\s+(?:moyenne|th[eé]orique|indicative|recommand[eé]e|pr[eé]conis[eé]e))?|Dosage(?:\s+(?:moyen|recommand[eé]|pr[eé]conis[eé]))?)\s*:?\s*([0-9]+(?:[,.][0-9]+)?)\s*([^\s/]+)\s*\/\s*([^\s\n]+)/i,
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
  const sourceUnit = normalizeUnit(match[2]);
  const ratioUnit = normalizeUnit(match[3]);
  if (quantity === null || !sourceUnit || !ratioUnit) return null;
  return { quantity, sourceUnit, ratioUnit };
}

function buildRendementRatioMatch(match: RegExpMatchArray | null): RatioMatch | null {
  if (!match) return null;
  const quantity = parseLooseNumber(match[1]);
  const producedUnit = normalizeUnit(match[2]);
  const consumedUnit = normalizeUnit(match[3]);
  if (quantity === null || quantity <= 0 || !producedUnit || !consumedUnit) return null;
  return {
    quantity: 1 / quantity,
    sourceUnit: consumedUnit,
    ratioUnit: producedUnit,
  };
}

function parseLooseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnit(value: unknown): string | null {
  const unit = String(value ?? "").trim().toLowerCase();
  if (!unit) return null;
  if (["m²", "m2", "m 2"].includes(unit)) return "m2";
  if (["l", "litre", "litres", "liter", "liters"].includes(unit)) return "l";
  if (["kg", "kilo", "kilos"].includes(unit)) return "kg";
  if (["ml", "millilitre", "millilitres"].includes(unit)) return "ml";
  return unit;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10000) / 10000);
}
