import { supabase } from "../../../lib/supabaseClient";
import type { ProductCatalogItem } from "../domain/types";
import { listProductCatalogItems } from "../infrastructure/productCatalogRepository";
import {
  getTaskTemplateLotProfiles,
  matchTaskTemplateLotProfile,
  TASK_TEMPLATE_LOT_PROFILES_CHANGED,
} from "./taskTemplateLotProfiles";

let installed = false;
let observer: MutationObserver | null = null;
let pending = false;
let productsPromise: Promise<ProductCatalogItem[]> | null = null;

type MaterialRow = {
  productId: string;
  name: string;
  sourceUnit: string;
  quantity: string;
  ratioUnit: string;
  loss: string;
  note: string;
  purchasePrice: string;
  salePrice: string;
  product?: ProductCatalogItem | null;
};

type EquipmentRow = { name: string; quantity: string; unit: string; note: string };
type LaborRow = { duration: string; unit: string; cost: string; sale: string };
type FeeRow = { name: string; cost: string; sale: string; note: string };

type TemplateContext = {
  title: string;
  lot: string;
  unit: string;
  usage: { quoteVisible: boolean; chantierVisible: boolean };
  materials: MaterialRow[];
  equipment: EquipmentRow[];
  labor: LaborRow[];
  fees: FeeRow[];
  lotProfile: ReturnType<typeof matchTaskTemplateLotProfile>;
};

type CocoTemplateResult = {
  materials?: unknown[];
  equipment?: unknown[];
  procedure?: string[];
  controls?: string[];
  errorsToAvoid?: string[];
  technicalDescription?: string;
  characteristics?: string[];
  fieldReturns?: string[];
  costSummary?: Record<string, unknown>;
  confidence?: string;
  missingInformation?: string[];
};

export function installTaskTemplateCocoAssistantBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("input", onDrawerInput, true);
  document.addEventListener("change", onDrawerInput, true);
  window.addEventListener(TASK_TEMPLATE_LOT_PROFILES_CHANGED, scheduleOrganization);
  observer = new MutationObserver(scheduleOrganization);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleOrganization();
}

function onDrawerInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const drawer = target.closest(".fixed.inset-0") as HTMLElement | null;
  if (!drawer || !isTaskTemplateDrawer(drawer)) return;

  if (target.dataset.batiproLotSelect === "true" || isLaborCostInput(drawer, target)) {
    applyLotDefaults(drawer, target.dataset.batiproLotSelect === "true");
    void updateSummary(drawer);
  }
}

function scheduleOrganization() {
  if (pending) return;
  pending = true;
  window.requestAnimationFrame(() => {
    pending = false;
    for (const drawer of findTaskTemplateDrawers()) organizeDrawer(drawer);
  });
}

function organizeDrawer(drawer: HTMLElement) {
  ensureLotSelect(drawer);
  applyLotDefaults(drawer, false);

  if (drawer.dataset.batiproCocoTemplateOrganized !== "true") {
    const descriptionLabel = getLabeledTextarea(drawer, "description technique")?.closest("label") as HTMLElement | null;
    const characteristicsLabel =
      getLabeledTextarea(drawer, "caracteristiques")?.closest("label") as HTMLElement | null
      ?? getLabeledTextarea(drawer, "caractéristiques")?.closest("label") as HTMLElement | null;
    const remarksLabel = getLabeledTextarea(drawer, "remarques")?.closest("label") as HTMLElement | null;
    if (!descriptionLabel || !characteristicsLabel || !remarksLabel) return;

    const insertionAnchor = findAdvancedPreparationSection(drawer) ?? findCostReferenceRow(drawer);
    if (!insertionAnchor?.parentElement) return;

    const outputSection = buildOutputSection(drawer);
    outputSection.append(descriptionLabel, characteristicsLabel, remarksLabel);
    insertionAnchor.insertAdjacentElement("afterend", outputSection);
    drawer.dataset.batiproCocoTemplateOrganized = "true";
  }

  void updateSummary(drawer);
}

function ensureLotSelect(drawer: HTMLElement) {
  const profiles = getTaskTemplateLotProfiles();
  const existingSelect = drawer.querySelector("select[data-batipro-lot-select='true']") as HTMLSelectElement | null;
  if (existingSelect) {
    syncLotOptions(existingSelect, profiles);
    return;
  }

  const lotInput = getLabeledInput(drawer, "lot");
  if (!lotInput) return;
  const select = document.createElement("select");
  select.dataset.batiproLotSelect = "true";
  select.className = lotInput.className;
  select.disabled = lotInput.disabled;
  syncLotOptions(select, profiles, lotInput.value.trim());
  select.addEventListener("change", () => {
    setInputValue(lotInput, select.value);
    applyLotDefaults(drawer, true);
    void updateSummary(drawer);
  });

  lotInput.type = "hidden";
  lotInput.insertAdjacentElement("afterend", select);
}

function syncLotOptions(select: HTMLSelectElement, profiles = getTaskTemplateLotProfiles(), currentValue = select.value) {
  const selected = currentValue || select.value;
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Choisir un lot métier";
  select.append(empty);
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.label;
    option.textContent = `${profile.label} - MO +${profile.laborMarginRate} %`;
    select.append(option);
  }
  if (selected && !profiles.some((profile) => profile.label === selected)) {
    const custom = document.createElement("option");
    custom.value = selected;
    custom.textContent = `${selected} (non paramétré)`;
    select.append(custom);
  }
  select.value = selected;
}

function applyLotDefaults(drawer: HTMLElement, force = false) {
  const lot = getLotValue(drawer);
  const profile = matchTaskTemplateLotProfile(lot);
  const unitInput = getLabeledInput(drawer, "unite") ?? getLabeledInput(drawer, "unité");
  if (unitInput && profile.defaultUnit && (force || !unitInput.value.trim())) setInputValue(unitInput, profile.defaultUnit);
  setCheckboxByText(drawer, "Visible dans les devis", profile.defaultUsage.quoteVisible, force);
  setCheckboxByText(drawer, "Visible côté chantier", profile.defaultUsage.chantierVisible, force);
  applyLaborMargin(drawer, profile.laborMarginRate, force);
}

function applyLaborMargin(drawer: HTMLElement, marginRate: number, force = false) {
  for (const row of findLaborRows(drawer)) {
    const inputs = Array.from(row.querySelectorAll("input"));
    const costInput = inputs[2];
    const saleInput = inputs[3];
    if (!(costInput instanceof HTMLInputElement) || !(saleInput instanceof HTMLInputElement)) continue;
    const cost = parseFrenchNumber(costInput.value);
    if (cost === null) continue;
    if (!force && saleInput.value.trim()) continue;
    setInputValue(saleInput, formatNumber(cost * (1 + marginRate / 100)));
  }
}

function buildOutputSection(drawer: HTMLElement) {
  const section = document.createElement("section");
  section.dataset.batiproCocoTemplateOutput = "true";
  section.className = "space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4";
  section.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Coco template</div>
        <div class="mt-1 text-sm font-semibold text-slate-950">Génération intelligente de la tâche</div>
        <div class="mt-1 text-xs text-slate-600">Coco analyse le lot, les produits liés, leurs documents, la main d'oeuvre, le matériel et les frais pour préparer la tâche.</div>
      </div>
      <button type="button" data-coco-generate class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Générer avec Coco</button>
    </div>
    <div data-batipro-coco-template-summary class="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600"></div>
    <div class="grid gap-3 xl:grid-cols-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-sm font-semibold text-slate-900">Liste matériaux Coco</div><div data-coco-materials class="mt-2 whitespace-pre-line text-sm text-slate-700">Clique sur Générer avec Coco.</div></div>
      <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-sm font-semibold text-slate-900">Liste matériel Coco</div><div data-coco-equipment class="mt-2 whitespace-pre-line text-sm text-slate-700">Coco proposera le matériel nécessaire.</div></div>
      <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-sm font-semibold text-slate-900">Mode opératoire complet</div><div data-coco-procedure class="mt-2 whitespace-pre-line text-sm text-slate-700">Coco générera les étapes terrain.</div></div>
      <div class="rounded-2xl border border-slate-200 bg-white p-3"><div class="text-sm font-semibold text-slate-900">Contrôles / erreurs à éviter</div><div data-coco-controls class="mt-2 whitespace-pre-line text-sm text-slate-700">Coco ajoutera les points de contrôle.</div></div>
    </div>
  `;
  section.querySelector("[data-coco-generate]")?.addEventListener("click", (event) => {
    void generateWithCoco(drawer, event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null);
  });
  return section;
}

async function generateWithCoco(drawer: HTMLElement, button: HTMLButtonElement | null) {
  applyLotDefaults(drawer, false);
  const previousLabel = button?.textContent ?? "Générer avec Coco";
  if (button) {
    button.disabled = true;
    button.textContent = "Coco réfléchit...";
  }

  try {
    const context = await readContext(drawer);
    const remote = await callCocoTemplateFunction(context);
    const generated = normalizeRemoteResult(remote, context);
    applyGeneratedResult(drawer, generated, false);
    updateSummaryText(drawer, `Coco a généré la tâche avec confiance ${generated.confidence}.`);
  } catch (error) {
    const context = await readContext(drawer);
    const fallback = buildFallbackResult(context, error);
    applyGeneratedResult(drawer, fallback, true);
    updateSummaryText(drawer, `IA indisponible : génération locale minimale utilisée. ${fallback.error ?? ""}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }
}

async function callCocoTemplateFunction(context: TemplateContext): Promise<CocoTemplateResult> {
  const { data, error } = await supabase.functions.invoke("generate-task-template", { body: context });
  if (error) throw new Error(error.message);
  return (data?.result ?? data) as CocoTemplateResult;
}

function normalizeRemoteResult(result: CocoTemplateResult, context: TemplateContext) {
  return {
    materialLines: formatMaterialResults(result.materials, context),
    equipmentLines: formatEquipmentResults(result.equipment),
    procedureLines: toStringArray(result.procedure),
    controlLines: [...toStringArray(result.controls), ...toStringArray(result.errorsToAvoid)],
    description: result.technicalDescription || buildFallbackDescription(context),
    characteristics: toStringArray(result.characteristics),
    fieldReturns: [...toStringArray(result.fieldReturns), ...toStringArray(result.missingInformation).map((item) => `Information manquante : ${item}`)],
    confidence: result.confidence || "low",
    error: "",
  };
}

function applyGeneratedResult(drawer: HTMLElement, generated: ReturnType<typeof normalizeRemoteResult> | ReturnType<typeof buildFallbackResult>, forceReplace: boolean) {
  setGeneratedOutput(drawer, "[data-coco-materials]", generated.materialLines);
  setGeneratedOutput(drawer, "[data-coco-equipment]", generated.equipmentLines);
  setGeneratedOutput(drawer, "[data-coco-procedure]", generated.procedureLines);
  setGeneratedOutput(drawer, "[data-coco-controls]", generated.controlLines);

  const descriptionInput = getLabeledTextarea(drawer, "description technique");
  const characteristicsInput = getLabeledTextarea(drawer, "caracteristiques") ?? getLabeledTextarea(drawer, "caractéristiques");
  const remarksInput = getLabeledTextarea(drawer, "remarques");

  if (descriptionInput && canReplace(descriptionInput.value, "description technique", forceReplace)) setTextareaValue(descriptionInput, generated.description);
  if (characteristicsInput && canReplace(characteristicsInput.value, "caractéristiques", forceReplace)) setTextareaValue(characteristicsInput, generated.characteristics.join("\n"));
  if (remarksInput && canReplace(remarksInput.value, "retours terrain", forceReplace)) setTextareaValue(remarksInput, generated.fieldReturns.join("\n"));
}

async function readContext(drawer: HTMLElement): Promise<TemplateContext> {
  const products = await loadProducts();
  const lot = getLotValue(drawer) || "Lot à préciser";
  const profile = matchTaskTemplateLotProfile(lot);
  return {
    title: getLabeledInput(drawer, "titre")?.value.trim() || "Template de tâche",
    lot,
    unit: getLabeledInput(drawer, "unite")?.value.trim() || getLabeledInput(drawer, "unité")?.value.trim() || profile.defaultUnit || "unité",
    usage: {
      quoteVisible: getCheckboxByText(drawer, "Visible dans les devis") ?? profile.defaultUsage.quoteVisible,
      chantierVisible: getCheckboxByText(drawer, "Visible côté chantier") ?? profile.defaultUsage.chantierVisible,
    },
    materials: readMaterialRows(drawer, products),
    equipment: readEquipmentRows(drawer),
    labor: readLaborRows(drawer),
    fees: readFeeRows(drawer),
    lotProfile: profile,
  };
}

function loadProducts() {
  productsPromise ??= listProductCatalogItems().catch(() => []);
  return productsPromise;
}

function readMaterialRows(drawer: HTMLElement, products: ProductCatalogItem[]): MaterialRow[] {
  return findRows(drawer, "Matériau #").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    const select = row.querySelector("select") as HTMLSelectElement | null;
    const productId = select?.value.trim() ?? "";
    const selectedLabel = select?.selectedOptions[0]?.textContent?.trim() ?? "";
    const name = inputs[0]?.value.trim() || selectedLabel.replace(/\s*\(.*\)\s*$/, "");
    const product = products.find((item) => item.id === productId) ?? products.find((item) => normalizeText(item.designation) === normalizeText(name)) ?? null;
    return {
      productId,
      name: product?.designation || name,
      sourceUnit: inputs[1]?.value.trim() ?? "",
      quantity: inputs[2]?.value.trim() ?? "",
      ratioUnit: inputs[3]?.value.trim() ?? "",
      loss: inputs[4]?.value.trim() ?? "",
      note: inputs[5]?.value.trim() ?? "",
      purchasePrice: inputs[6]?.value.trim() ?? "",
      salePrice: inputs[7]?.value.trim() ?? "",
      product,
    };
  }).filter((row) => row.name || row.quantity || row.note || row.productId);
}

function readEquipmentRows(drawer: HTMLElement): EquipmentRow[] {
  return findRows(drawer, "Matériel #").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return { name: inputs[0]?.value.trim() ?? "", quantity: inputs[1]?.value.trim() ?? "", unit: inputs[2]?.value.trim() ?? "", note: inputs[4]?.value.trim() ?? "" };
  }).filter((row) => row.name || row.quantity || row.note);
}

function readLaborRows(drawer: HTMLElement): LaborRow[] {
  return findLaborRows(drawer).map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return { duration: inputs[0]?.value.trim() ?? "", unit: inputs[1]?.value.trim() ?? "h", cost: inputs[2]?.value.trim() ?? "", sale: inputs[3]?.value.trim() ?? "" };
  }).filter((row) => row.duration || row.cost || row.sale);
}

function readFeeRows(drawer: HTMLElement): FeeRow[] {
  return findRows(drawer, "Location matériel").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return { name: inputs[0]?.value.trim() ?? "", cost: inputs[1]?.value.trim() ?? "", sale: inputs[2]?.value.trim() ?? "", note: inputs[3]?.value.trim() ?? "" };
  }).filter((row) => row.name || row.cost || row.sale || row.note);
}

function buildFallbackResult(context: TemplateContext, error: unknown) {
  const materials = context.materials.map((material, index) => `${index + 1}. ${material.name || "Matériau à préciser"} : ${material.quantity || "quantité à préciser"} ${material.ratioUnit || material.product?.unit || "unité"} pour 1 ${material.sourceUnit || context.unit}`);
  const equipment = context.equipment.length ? context.equipment.map((item, index) => `${index + 1}. ${item.name}${item.quantity ? ` : ${item.quantity} ${item.unit || "u"}` : ""}`) : ["1. Matériel à compléter par Coco ou le conducteur de travaux."];
  const procedure = [
    `1. Vérifier le support et les conditions chantier avant ${context.title}.`,
    "2. Préparer la zone, protéger les ouvrages existants et vérifier le matériel.",
    "3. Préparer les produits selon les ratios renseignés.",
    "4. Exécuter la tâche et contrôler la finition.",
    "5. Renseigner le retour terrain : quantités, temps, écarts et matériel manquant.",
  ];
  return {
    materialLines: materials.length ? materials : ["1. Aucun matériau renseigné."],
    equipmentLines: equipment,
    procedureLines: procedure,
    controlLines: ["Support propre, sec et compatible.", "Comparer consommation réelle et ratio prévu.", "Noter les écarts pour améliorer le template."],
    description: buildFallbackDescription(context),
    characteristics: [`Lot : ${context.lot}`, `Unité : ${context.unit}`, ...materials, ...equipment],
    fieldReturns: ["Retour terrain à alimenter : consommation réelle, temps passé, matériel manquant, difficultés support.", error instanceof Error ? `Erreur IA : ${error.message}` : "Erreur IA inconnue"],
    confidence: "low",
    error: error instanceof Error ? error.message : "Erreur IA inconnue",
  };
}

function buildFallbackDescription(context: TemplateContext) {
  return `${context.title} - ${context.lot}. Unité de production : ${context.unit}.`;
}

function formatMaterialResults(materials: unknown[] | undefined, context: TemplateContext) {
  if (!Array.isArray(materials) || materials.length === 0) return context.materials.map((material, index) => `${index + 1}. ${material.name} : ${material.quantity || "?"} ${material.ratioUnit || material.product?.unit || "unité"} pour 1 ${material.sourceUnit || context.unit}`);
  return materials.map((item, index) => `${index + 1}. ${formatObjectLine(item)}`);
}

function formatEquipmentResults(equipment: unknown[] | undefined) {
  if (!Array.isArray(equipment) || equipment.length === 0) return ["1. Aucun matériel généré par Coco : compléter ou relancer avec plus d'informations produit."];
  return equipment.map((item, index) => `${index + 1}. ${formatObjectLine(item)}`);
}

function formatObjectLine(value: unknown) {
  if (!value || typeof value !== "object") return String(value ?? "");
  const source = value as Record<string, unknown>;
  const main = [source.name, source.quantity, source.unit ? String(source.unit) : "", source.forUnit ? `pour 1 ${source.forUnit}` : ""].filter(Boolean).join(" ");
  const extra = [source.reasoning, source.uncertain ? "incertain" : ""].filter(Boolean).join(" - ");
  return [main, extra].filter(Boolean).join(" - ");
}

async function updateSummary(drawer: HTMLElement) {
  const context = await readContext(drawer);
  updateSummaryText(drawer, `Coco utilisera : ${context.materials.length} matériau(x), ${context.equipment.length} matériel(s), ${context.labor.length} ligne(s) main d'oeuvre, ${context.fees.length} frais. Lot : ${context.lot}.`);
}

function updateSummaryText(drawer: HTMLElement, message: string) {
  const summary = drawer.querySelector("[data-batipro-coco-template-summary]") as HTMLElement | null;
  if (summary) summary.textContent = message;
}

function setGeneratedOutput(drawer: HTMLElement, selector: string, lines: string[]) {
  const target = drawer.querySelector(selector) as HTMLElement | null;
  if (target) target.textContent = lines.filter(Boolean).join("\n");
}

function getLotValue(drawer: HTMLElement) {
  const select = drawer.querySelector("select[data-batipro-lot-select='true']") as HTMLSelectElement | null;
  return select?.value.trim() || getLabeledInput(drawer, "lot")?.value.trim() || "";
}

function findLaborRows(drawer: HTMLElement) { return findRows(drawer, "Saisie manuelle"); }
function isLaborCostInput(drawer: HTMLElement, target: Element) { return findLaborRows(drawer).some((row) => Array.from(row.querySelectorAll("input"))[2] === target); }
function findRows(drawer: HTMLElement, marker: string) { return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-slate-200.bg-slate-50, .grid.rounded-2xl.border.border-slate-200.bg-slate-50")).filter((element): element is HTMLElement => element instanceof HTMLElement).filter((element) => element.textContent?.includes(marker)); }
function findTaskTemplateDrawers() { return Array.from(document.querySelectorAll(".fixed.inset-0")).filter((element): element is HTMLElement => element instanceof HTMLElement).filter(isTaskTemplateDrawer); }
function isTaskTemplateDrawer(element: HTMLElement) { return Boolean(element.textContent?.includes("Nouveau template") || element.textContent?.includes("Préparation avancée") || element.textContent?.includes("Usage métier")); }
function findAdvancedPreparationSection(drawer: HTMLElement) { return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-blue-200")).find((element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.textContent?.includes("Préparation avancée"))) ?? null; }
function findCostReferenceRow(drawer: HTMLElement) { return getLabeledInput(drawer, "coût de référence")?.closest(".grid") as HTMLElement | null; }
function getLabeledInput(root: HTMLElement, labelText: string) { const input = findLabel(root, labelText)?.querySelector("input"); return input instanceof HTMLInputElement ? input : null; }
function getLabeledTextarea(root: HTMLElement, labelText: string) { const textarea = findLabel(root, labelText)?.querySelector("textarea"); return textarea instanceof HTMLTextAreaElement ? textarea : null; }
function findLabel(root: HTMLElement, labelText: string) { const expected = normalizeText(labelText); return Array.from(root.querySelectorAll("label")).find((label) => normalizeText(label.textContent).includes(expected)) as HTMLLabelElement | undefined; }
function getCheckboxByText(drawer: HTMLElement, labelText: string) { const input = findLabel(drawer, labelText)?.querySelector("input[type='checkbox']"); return input instanceof HTMLInputElement ? input.checked : null; }
function setCheckboxByText(drawer: HTMLElement, labelText: string, checked: boolean, force: boolean) { const input = findLabel(drawer, labelText)?.querySelector("input[type='checkbox']"); if (!(input instanceof HTMLInputElement)) return; if (!force && input.checked === checked) return; input.checked = checked; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); }
function canReplace(value: string, _label: string, force = false) { return force || !value.trim() || window.confirm("Le champ contient déjà du texte. Remplacer par la proposition Coco ?"); }
function setInputValue(input: HTMLInputElement, value: string) { const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; valueSetter?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); }
function setTextareaValue(textarea: HTMLTextAreaElement, value: string) { const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; valueSetter?.call(textarea, value); textarea.dispatchEvent(new Event("input", { bubbles: true })); textarea.dispatchEvent(new Event("change", { bubbles: true })); }
function parseFrenchNumber(value: unknown) { const number = Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", ".")); return Number.isFinite(number) ? number : null; }
function formatNumber(value: number) { return String(Math.round(value * 100) / 100).replace(".", ","); }
function toStringArray(value: unknown) { return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []; }
function normalizeText(value: unknown) { return String(value ?? "").replace(/²/g, "2").replace(/³/g, "3").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").replace(/\s+/g, " ").trim().toLowerCase(); }
