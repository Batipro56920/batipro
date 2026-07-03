type PricingInputs = {
  purchaseInput: HTMLInputElement | null;
  saleInput: HTMLInputElement | null;
  marginInput: HTMLInputElement | null;
};

let installed = false;
let observer: MutationObserver | null = null;
let syncing = false;

export function installProductDrawerPricingBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("input", onPricingInput, true);
  document.addEventListener("change", onPricingInput, true);
  observer = new MutationObserver(() => syncProductDrawerPricing());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(syncProductDrawerPricing, 0);
}

function onPricingInput(event: Event) {
  if (syncing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const drawer = findProductDrawer(target);
  if (!drawer) return;
  const inputs = getPricingInputs(drawer);
  if (target !== inputs.purchaseInput && target !== inputs.marginInput && target !== inputs.saleInput) return;

  if (target === inputs.purchaseInput || target === inputs.marginInput) {
    updateSalePrice(drawer, inputs);
  }
  updatePricingSummary(drawer, inputs);
}

function syncProductDrawerPricing() {
  for (const drawer of findProductDrawers()) {
    const inputs = getPricingInputs(drawer);
    updateSalePrice(drawer, inputs);
    updatePricingSummary(drawer, inputs);
    simplifySupplierPriceSection(drawer);
  }
}

function findProductDrawers() {
  return Array.from(document.querySelectorAll("[role='dialog'] aside"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.textContent?.includes("Fiche produit")));
}

function findProductDrawer(element: HTMLElement) {
  return element.closest("[role='dialog'] aside") as HTMLElement | null;
}

function getPricingInputs(drawer: HTMLElement): PricingInputs {
  return {
    purchaseInput: getInputByLabel(drawer, "prix achat standard"),
    saleInput: getInputByLabel(drawer, "prix vente conseille"),
    marginInput: getInputByLabel(drawer, "marge cible"),
  };
}

function getInputByLabel(root: HTMLElement, labelText: string) {
  const expected = normalizeText(labelText);
  const labels = Array.from(root.querySelectorAll("label"));
  const label = labels.find((candidate) => normalizeText(candidate.textContent).includes(expected));
  const input = label?.querySelector("input");
  return input instanceof HTMLInputElement ? input : null;
}

function updateSalePrice(drawer: HTMLElement, inputs: PricingInputs) {
  const purchase = parseFrenchNumber(inputs.purchaseInput?.value);
  const margin = parseFrenchNumber(inputs.marginInput?.value) ?? 30;
  if (purchase === null || !inputs.saleInput) return;

  const sale = roundPrice(purchase * (1 + margin / 100));
  setInputValue(inputs.saleInput, formatInputNumber(sale));
  updatePricingSummary(drawer, inputs);
}

function updatePricingSummary(drawer: HTMLElement, inputs: PricingInputs) {
  const purchase = parseFrenchNumber(inputs.purchaseInput?.value);
  const sale = parseFrenchNumber(inputs.saleInput?.value);
  const margin = parseFrenchNumber(inputs.marginInput?.value) ?? 30;
  const ratio = findRatioInDrawer(drawer);
  const purchasePerBaseUnit = purchase !== null && ratio ? roundPrice(purchase * ratio.quantity) : null;
  const salePerBaseUnit = sale !== null && ratio ? roundPrice(sale * ratio.quantity) : null;
  const summary = getOrCreateSummary(drawer);

  summary.innerHTML = "";
  summary.append(
    buildMetric("Prix achat HT", purchase !== null ? formatCurrency(purchase) : "A renseigner"),
    buildMetric("Prix vente HT", sale !== null ? formatCurrency(sale) : `achat + ${formatInputNumber(margin)} %`),
    buildMetric(
      ratio ? `Prix achat HT / ${ratio.baseUnit}` : "Prix achat HT / m2",
      purchasePerBaseUnit !== null ? formatCurrency(purchasePerBaseUnit) : "Ratio produit manquant",
    ),
    buildMetric(
      ratio ? `Prix vente HT / ${ratio.baseUnit}` : "Prix vente HT / m2",
      salePerBaseUnit !== null ? formatCurrency(salePerBaseUnit) : "Ratio produit manquant",
    ),
  );
}

function getOrCreateSummary(drawer: HTMLElement) {
  let summary = drawer.querySelector("[data-batipro-product-pricing-summary]") as HTMLElement | null;
  if (summary) return summary;

  summary = document.createElement("div");
  summary.dataset.batiproProductPricingSummary = "true";
  summary.className = "mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm md:grid-cols-4";

  const priceGrid = findPriceGrid(drawer);
  priceGrid?.insertAdjacentElement("afterend", summary);
  return summary;
}

function findPriceGrid(drawer: HTMLElement) {
  const purchaseInput = getInputByLabel(drawer, "prix achat standard");
  return purchaseInput?.closest(".grid") as HTMLElement | null;
}

function buildMetric(label: string, value: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "rounded-xl bg-white px-3 py-2";

  const labelElement = document.createElement("div");
  labelElement.className = "text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700";
  labelElement.textContent = label;

  const valueElement = document.createElement("div");
  valueElement.className = "mt-1 font-semibold text-slate-950";
  valueElement.textContent = value;

  wrapper.append(labelElement, valueElement);
  return wrapper;
}

function simplifySupplierPriceSection(drawer: HTMLElement) {
  const heading = Array.from(drawer.querySelectorAll("div"))
    .find((element) => normalizeText(element.textContent) === "prix negocies par fournisseur");
  const section = heading?.closest(".rounded-2xl") as HTMLElement | null;
  if (!section || section.dataset.batiproSupplierPricesSimplified === "true") return;

  section.dataset.batiproSupplierPricesSimplified = "true";
  section.style.display = "none";
}

function findRatioInDrawer(drawer: HTMLElement): { quantity: number; sourceUnit: string; baseUnit: string } | null {
  const text = Array.from(drawer.querySelectorAll("textarea, input"))
    .map((element) => element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement ? element.value : "")
    .join("\n");
  const match = text.match(/Ratio mat[eé]riau Batipro\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*([^\s/]+)\s*\/\s*([^\s\n]+)/i)
    ?? text.match(/Consommation extraite\s*:\s*([0-9]+(?:[,.][0-9]+)?)\s*([^\s/]+)\s*\/\s*([^\s\n]+)/i);
  const quantity = parseFrenchNumber(match?.[1]);
  const sourceUnit = normalizeUnit(match?.[2]);
  const baseUnit = normalizeUnit(match?.[3]);
  if (quantity === null || !sourceUnit || !baseUnit) return null;
  return { quantity, sourceUnit, baseUnit };
}

function setInputValue(input: HTMLInputElement, value: string) {
  if (input.value === value) return;
  syncing = true;
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  syncing = false;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeUnit(value: unknown) {
  const unit = normalizeText(value);
  if (["m²", "m2", "m 2"].includes(unit)) return "m2";
  if (["l", "litre", "litres"].includes(unit)) return "l";
  if (["kg", "kilo", "kilos"].includes(unit)) return "kg";
  if (["ml", "metre lineaire", "m"].includes(unit)) return "ml";
  return unit || null;
}

function parseFrenchNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function formatInputNumber(value: number) {
  return String(roundPrice(value)).replace(".", ",");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}
