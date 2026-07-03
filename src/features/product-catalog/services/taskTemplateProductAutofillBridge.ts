import type { ProductCatalogItem } from "../domain/types";
import { listProductCatalogItems } from "../infrastructure/productCatalogRepository";

type ProductRatioHint = {
  quantity: number | null;
  sourceUnit: string | null;
  ratioUnit: string | null;
  lossPercent: number | null;
  notes: string;
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
  const documentText = product.documents
    .map((document) => [document.name, document.notes].filter(Boolean).join("\n"))
    .join("\n\n");

  const ratioMatch = documentText.match(/Ratio mat[eé]riau Batipro\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*([^\s/]+)\s*\/\s*([^\s\n]+)/i);
  const lossMatch = documentText.match(/(?:Perte pr[eé]conis[eé]e|Perte extraite)\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*%/i);

  const ratioQuantity = parseLooseNumber(ratioMatch?.[1]);
  const sourceUnit = normalizeUnit(ratioMatch?.[2]) ?? product.unit;
  const ratioUnit = normalizeUnit(ratioMatch?.[3]) ?? null;
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
    quantity: ratioQuantity,
    sourceUnit,
    ratioUnit,
    lossPercent,
    notes: taskNotes,
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
