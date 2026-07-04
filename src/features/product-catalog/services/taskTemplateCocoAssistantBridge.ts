import { matchTaskTemplateLotProfile, TASK_TEMPLATE_LOT_PROFILES_CHANGED } from "./taskTemplateLotProfiles";

let installed = false;
let observer: MutationObserver | null = null;

export function installTaskTemplateCocoAssistantBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("input", onTemplateInput, true);
  document.addEventListener("change", onTemplateInput, true);
  window.addEventListener(TASK_TEMPLATE_LOT_PROFILES_CHANGED, () => {
    for (const drawer of findTaskTemplateDrawers()) {
      applyLotDefaults(drawer, true);
      updateAssistantSummary(drawer);
    }
  });
  observer = new MutationObserver(() => installAssistantCards());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(installAssistantCards, 0);
}

function onTemplateInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const drawer = findTaskTemplateDrawer(target);
  if (!drawer) return;

  if (isLotInput(drawer, target)) {
    applyLotDefaults(drawer);
    updateAssistantSummary(drawer);
    return;
  }

  if (isLaborCostInput(drawer, target)) {
    applyLaborMargin(drawer);
    updateAssistantSummary(drawer);
  }
}

function installAssistantCards() {
  for (const drawer of findTaskTemplateDrawers()) {
    const anchor = findCocoInsertionAnchor(drawer);
    if (!anchor?.parentElement) continue;

    const existingCard = drawer.querySelector("[data-batipro-task-coco-assistant-card]") as HTMLElement | null;
    const card = existingCard ?? buildAssistantCard(drawer);
    if (card.nextElementSibling !== anchor) anchor.insertAdjacentElement("beforebegin", card);

    drawer.dataset.batiproTaskCocoAssistant = "true";
    applyLotDefaults(drawer);
    updateAssistantSummary(drawer);
  }
}

function buildAssistantCard(drawer: HTMLElement) {
  const card = document.createElement("div");
  card.dataset.batiproTaskCocoAssistantCard = "true";
  card.className = "rounded-2xl border border-blue-200 bg-blue-50/60 p-4";

  const header = document.createElement("div");
  header.className = "flex flex-wrap items-start justify-between gap-3";

  const text = document.createElement("div");
  const title = document.createElement("div");
  title.className = "text-sm font-semibold text-slate-950";
  title.textContent = "Coco - génération du template";
  const subtitle = document.createElement("div");
  subtitle.className = "mt-1 text-xs text-slate-600";
  subtitle.textContent = "À lancer seulement après les 6 blocs : désignation, unité, usage métier, matériaux, main d'oeuvre, matériel/frais.";
  text.append(title, subtitle);

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";

  const marginButton = document.createElement("button");
  marginButton.type = "button";
  marginButton.className = "rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-50";
  marginButton.textContent = "Appliquer lot";
  marginButton.addEventListener("click", () => {
    applyLotDefaults(drawer, true);
    updateAssistantSummary(drawer);
  });

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800";
  generateButton.textContent = "Générer avec Coco";
  generateButton.addEventListener("click", () => generateTemplateFields(drawer));

  actions.append(marginButton, generateButton);
  header.append(text, actions);

  const checklist = document.createElement("div");
  checklist.className = "mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2";
  checklist.innerHTML = `
    <div class="rounded-xl border border-blue-100 bg-white px-3 py-2">1. Désignation + unité + usage métier</div>
    <div class="rounded-xl border border-blue-100 bg-white px-3 py-2">2. Matériaux liés aux produits et ratios</div>
    <div class="rounded-xl border border-blue-100 bg-white px-3 py-2">3. Main d'oeuvre et coûts horaires</div>
    <div class="rounded-xl border border-blue-100 bg-white px-3 py-2">4. Matériel, frais, puis synthèse Coco</div>
  `;

  const summary = document.createElement("div");
  summary.dataset.batiproTaskCocoAssistantSummary = "true";
  summary.className = "mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600";

  card.append(header, checklist, summary);
  return card;
}

function generateTemplateFields(drawer: HTMLElement) {
  const context = readTemplateContext(drawer);
  const profile = getLotProfile(context.lot);
  const description = buildTechnicalDescription(context, profile);
  const characteristics = buildCharacteristics(context, profile);
  const remarks = buildFieldReturns(profile);

  const descriptionInput = getLabeledTextarea(drawer, "description technique");
  const characteristicsInput = getLabeledTextarea(drawer, "caracteristiques") ?? getLabeledTextarea(drawer, "caractéristiques");
  const remarksInput = getLabeledTextarea(drawer, "remarques");

  if (descriptionInput && shouldFill(descriptionInput.value)) setTextareaValue(descriptionInput, description);
  if (characteristicsInput && shouldFill(characteristicsInput.value)) setTextareaValue(characteristicsInput, characteristics.join("\n"));
  if (remarksInput && shouldFill(remarksInput.value)) setTextareaValue(remarksInput, remarks.join("\n"));

  applyLotDefaults(drawer, true);
  updateAssistantSummary(drawer, "Coco a généré les sorties du template à partir des 6 blocs saisis plus haut.");
}

function readTemplateContext(drawer: HTMLElement) {
  return {
    title: getLabeledInput(drawer, "titre")?.value.trim() ?? "",
    lot: getLabeledInput(drawer, "lot")?.value.trim() ?? "",
    unit: getLabeledInput(drawer, "unite")?.value.trim() || getLabeledInput(drawer, "unité")?.value.trim() || "unité",
    materials: readMaterialRows(drawer),
    labor: readLaborRows(drawer),
    fees: readFeeRows(drawer),
  };
}

function buildTechnicalDescription(context: ReturnType<typeof readTemplateContext>, profile: ReturnType<typeof getLotProfile>) {
  const title = context.title || "Tâche à exécuter";
  const unit = context.unit || profile.defaultUnit || "unité";
  const materials = context.materials.map((material) => material.name).filter(Boolean).slice(0, 6);
  const materialText = materials.length ? `Matériaux prévus pour 1 ${unit} : ${joinFrench(materials)}.` : `Matériaux pour 1 ${unit} : à compléter.`;
  const laborText = context.labor.length ? `Main d'oeuvre prévue : ${context.labor.map((row) => `${row.duration || "?"} ${row.unit || "h"}`).join(", ")}.` : "Main d'oeuvre : à compléter.";
  const feeText = context.fees.length ? `Matériel / frais intégrés : ${context.fees.map((fee) => fee.designation).filter(Boolean).join(", ")}.` : "Matériel / frais : à compléter si nécessaire.";

  return [
    `${title} - lot ${profile.label}, unité de production : ${unit}.`,
    materialText,
    laborText,
    feeText,
    "Mode opératoire synthétique : 1) contrôler le support et les conditions chantier ; 2) préparer/protéger la zone ; 3) appliquer ou poser les matériaux dans l'ordre logique ; 4) contrôler la conformité ; 5) nettoyer et renseigner les écarts terrain.",
    profile.fieldGuidance,
  ].filter(Boolean).join("\n");
}

function buildCharacteristics(context: ReturnType<typeof readTemplateContext>, profile: ReturnType<typeof getLotProfile>) {
  const lines = [
    `Lot : ${profile.label}`,
    `Unité de production : ${context.unit || profile.defaultUnit || "à préciser"}`,
    `Marge main d'oeuvre cible : ${profile.laborMarginRate} %`,
  ];

  for (const material of context.materials.slice(0, 8)) {
    const ratio = material.ratioQuantity && material.ratioUnit && material.sourceUnit
      ? ` - quantité pour 1 ${material.sourceUnit} : ${material.ratioQuantity} ${material.ratioUnit}`
      : " - quantité pour 1 unité : à préciser";
    lines.push(`Matériau : ${material.name || "à préciser"}${ratio}`);
  }

  for (const fee of context.fees.slice(0, 5)) {
    if (fee.designation) lines.push(`Matériel/frais : ${fee.designation}${fee.cost ? ` - coût ${fee.cost} € HT` : ""}`);
  }

  if (context.labor.length) {
    lines.push(`Main d'oeuvre : ${context.labor.map((row) => `${row.duration || "?"} ${row.unit || "h"} à ${row.cost || "?"} € HT`).join(" / ")}`);
  }

  return uniqueLines(lines);
}

function buildFieldReturns(profile: ReturnType<typeof getLotProfile>) {
  return uniqueLines([
    "Retour terrain attendu : confirmer quantité réellement consommée, temps passé et éventuels écarts avec le ratio prévu.",
    "À alimenter au fil des chantiers : conditions support, points bloquants, erreurs à éviter, ajustements de temps, matériel manquant.",
    "Contrôle qualité : vérifier support, finition, conformité aux fiches produit et réserves éventuelles avant clôture.",
    "Point d'attention : signaler toute incompatibilité support/produit, manque matériel, temps d'attente ou condition chantier bloquante.",
    profile.fieldGuidance,
  ].filter(Boolean));
}

function applyLotDefaults(drawer: HTMLElement, force = false) {
  const profile = getLotProfile(getLabeledInput(drawer, "lot")?.value ?? "");
  const unitInput = getLabeledInput(drawer, "unite") ?? getLabeledInput(drawer, "unité");
  if (unitInput && profile.defaultUnit && (force || !unitInput.value.trim())) {
    setInputValue(unitInput, profile.defaultUnit);
  }
  setCheckboxByText(drawer, "Visible dans les devis", profile.defaultUsage.quoteVisible, force);
  setCheckboxByText(drawer, "Visible côté chantier", profile.defaultUsage.chantierVisible, force);
  applyLaborMargin(drawer, force);
}

function applyLaborMargin(drawer: HTMLElement, force = false) {
  const profile = getLotProfile(getLabeledInput(drawer, "lot")?.value ?? "");
  for (const row of findLaborRows(drawer)) {
    const inputs = Array.from(row.querySelectorAll("input"));
    const costInput = inputs.find((input) => normalizeText(input.placeholder).includes("cout horaire"));
    const saleInput = inputs.find((input) => normalizeText(input.placeholder).includes("pv horaire"));
    const cost = parseFrenchNumber(costInput?.value);
    if (!saleInput || cost === null) continue;
    if (!force && saleInput.value.trim()) continue;
    const sale = roundPrice(cost * (1 + profile.laborMarginRate / 100));
    setInputValue(saleInput, formatInputNumber(sale));
  }
}

function readMaterialRows(drawer: HTMLElement) {
  return findMaterialRows(drawer).map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      name: inputs[0]?.value.trim() ?? "",
      sourceUnit: inputs[1]?.value.trim() ?? "",
      ratioQuantity: inputs[2]?.value.trim() ?? "",
      ratioUnit: inputs[3]?.value.trim() ?? "",
      lossPercent: inputs[4]?.value.trim() ?? "",
      note: inputs[5]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.ratioQuantity || row.note);
}

function readLaborRows(drawer: HTMLElement) {
  return findLaborRows(drawer).map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      duration: inputs.find((input) => normalizeText(input.placeholder).includes("temps"))?.value.trim() ?? "",
      unit: inputs.find((input) => normalizeText(input.placeholder) === "h")?.value.trim() ?? "h",
      cost: inputs.find((input) => normalizeText(input.placeholder).includes("cout horaire"))?.value.trim() ?? "",
      sale: inputs.find((input) => normalizeText(input.placeholder).includes("pv horaire"))?.value.trim() ?? "",
    };
  }).filter((row) => row.duration || row.cost || row.sale);
}

function readFeeRows(drawer: HTMLElement) {
  return findFeeRows(drawer).map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      designation: inputs.find((input) => normalizeText(input.placeholder).includes("designation"))?.value.trim() ?? inputs[0]?.value.trim() ?? "",
      cost: inputs.find((input) => normalizeText(input.placeholder).includes("cout ht"))?.value.trim() ?? "",
      sale: inputs.find((input) => normalizeText(input.placeholder).includes("pv ht"))?.value.trim() ?? "",
    };
  }).filter((row) => row.designation || row.cost || row.sale);
}

function findTaskTemplateDrawers() {
  return Array.from(document.querySelectorAll(".fixed.inset-0"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => Boolean(element.textContent?.includes("Préparation avancée") || element.textContent?.includes("Nouveau template")));
}

function findTaskTemplateDrawer(element: HTMLElement) {
  return element.closest(".fixed.inset-0") as HTMLElement | null;
}

function findCocoInsertionAnchor(drawer: HTMLElement) {
  return getLabeledTextarea(drawer, "description technique")?.closest("label") as HTMLElement | null
    ?? getLabeledTextarea(drawer, "caracteristiques")?.closest("label") as HTMLElement | null
    ?? getLabeledTextarea(drawer, "caractéristiques")?.closest("label") as HTMLElement | null
    ?? getLabeledTextarea(drawer, "remarques")?.closest("label") as HTMLElement | null
    ?? findAdvancedPreparationSection(drawer);
}

function findAdvancedPreparationSection(drawer: HTMLElement) {
  return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-blue-200"))
    .find((element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.textContent?.includes("Préparation avancée"))) ?? null;
}

function getLabeledInput(root: HTMLElement, labelText: string) {
  const label = findLabel(root, labelText);
  const input = label?.querySelector("input");
  return input instanceof HTMLInputElement ? input : null;
}

function getLabeledTextarea(root: HTMLElement, labelText: string) {
  const label = findLabel(root, labelText);
  const textarea = label?.querySelector("textarea");
  return textarea instanceof HTMLTextAreaElement ? textarea : null;
}

function findLabel(root: HTMLElement, labelText: string) {
  const expected = normalizeText(labelText);
  return Array.from(root.querySelectorAll("label")).find((label) => normalizeText(label.textContent).includes(expected)) as HTMLLabelElement | undefined;
}

function isLotInput(drawer: HTMLElement, target: Element) {
  return getLabeledInput(drawer, "lot") === target;
}

function isLaborCostInput(drawer: HTMLElement, target: Element) {
  return findLaborRows(drawer).some((row) => Array.from(row.querySelectorAll("input")).some((input) => input === target && normalizeText(input.placeholder).includes("cout horaire")));
}

function findMaterialRows(drawer: HTMLElement) {
  return findPreparationRows(drawer, "Matériau #");
}

function findLaborRows(drawer: HTMLElement) {
  return findPreparationRows(drawer, "Supprimer").filter((row) => Boolean(row.textContent?.includes("Saisie manuelle") || row.textContent?.includes("Rôle salarié") || row.textContent?.includes("Sous-traitant")));
}

function findFeeRows(drawer: HTMLElement) {
  return findPreparationRows(drawer, "Location matériel").filter((row) => Boolean(row.textContent?.includes("Frais fixe") || row.textContent?.includes("Autre")));
}

function findPreparationRows(drawer: HTMLElement, marker: string) {
  return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-slate-200.bg-slate-50"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => Boolean(element.textContent?.includes(marker)));
}

function getLotProfile(lot: string) {
  return matchTaskTemplateLotProfile(lot);
}

function updateAssistantSummary(drawer: HTMLElement, message?: string) {
  const summary = drawer.querySelector("[data-batipro-task-coco-assistant-summary]") as HTMLElement | null;
  if (!summary) return;
  const profile = getLotProfile(getLabeledInput(drawer, "lot")?.value ?? "");
  const context = readTemplateContext(drawer);
  summary.textContent = message ?? `Profil détecté : ${profile.label} - unité ${context.unit || profile.defaultUnit}, marge main d'oeuvre ${profile.laborMarginRate} %. Coco synthétise uniquement après les matériaux, la main d'oeuvre et les frais saisis.`;
}

function shouldFill(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return window.confirm("Ce champ contient déjà du texte. Coco peut le remplacer par une proposition recalculée. Continuer ?");
}

function setCheckboxByText(drawer: HTMLElement, labelText: string, checked: boolean, force: boolean) {
  const label = Array.from(drawer.querySelectorAll("label"))
    .find((candidate) => normalizeText(candidate.textContent).includes(normalizeText(labelText)));
  const input = label?.querySelector("input[type='checkbox']");
  if (!(input instanceof HTMLInputElement)) return;
  if (!force && input.checked === checked) return;
  if (input.checked === checked) return;
  input.checked = checked;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function parseFrenchNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function formatInputNumber(value: number) {
  return String(roundPrice(value)).replace(".", ",");
}

function normalizeText(value: unknown) {
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

function joinFrench(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} et ${values[values.length - 1]}`;
}

function uniqueLines(lines: string[]) {
  return lines.filter((line, index) => lines.findIndex((candidate) => normalizeText(candidate) === normalizeText(line)) === index);
}
