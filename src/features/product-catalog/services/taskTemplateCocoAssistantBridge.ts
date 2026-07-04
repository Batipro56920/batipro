import { matchTaskTemplateLotProfile } from "./taskTemplateLotProfiles";

let installed = false;
let observer: MutationObserver | null = null;
let pending = false;

export function installTaskTemplateCocoAssistantBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  observer = new MutationObserver(scheduleOrganization);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleOrganization();
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
  if (drawer.dataset.batiproCocoTemplateOrganized === "true") return;

  const descriptionLabel = getLabeledTextarea(drawer, "description technique")?.closest("label") as HTMLElement | null;
  const characteristicsLabel =
    getLabeledTextarea(drawer, "caracteristiques")?.closest("label") as HTMLElement | null
    ?? getLabeledTextarea(drawer, "caractéristiques")?.closest("label") as HTMLElement | null;
  const remarksLabel = getLabeledTextarea(drawer, "remarques")?.closest("label") as HTMLElement | null;
  if (!descriptionLabel || !characteristicsLabel || !remarksLabel) return;

  const advancedSection = findAdvancedPreparationSection(drawer);
  const insertionAnchor = advancedSection ?? findCostReferenceRow(drawer);
  if (!insertionAnchor?.parentElement) return;

  const outputSection = buildOutputSection(drawer);
  outputSection.append(descriptionLabel, characteristicsLabel, remarksLabel);
  insertionAnchor.insertAdjacentElement("afterend", outputSection);
  drawer.dataset.batiproCocoTemplateOrganized = "true";
  updateSummary(drawer);
}

function buildOutputSection(drawer: HTMLElement) {
  const section = document.createElement("section");
  section.dataset.batiproCocoTemplateOutput = "true";
  section.className = "space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4";

  const header = document.createElement("div");
  header.className = "flex flex-wrap items-start justify-between gap-3";
  const text = document.createElement("div");
  text.innerHTML = `
    <div class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Coco template</div>
    <div class="mt-1 text-sm font-semibold text-slate-950">Génération après saisie métier</div>
    <div class="mt-1 text-xs text-slate-600">Ordre attendu : désignation, unité, usage métier, matériaux, main d'oeuvre, matériel/frais, puis synthèse Coco.</div>
  `;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800";
  button.textContent = "Générer avec Coco";
  button.addEventListener("click", () => generateWithCoco(drawer));

  header.append(text, button);

  const summary = document.createElement("div");
  summary.dataset.batiproCocoTemplateSummary = "true";
  summary.className = "rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600";

  section.append(header, summary);
  return section;
}

function generateWithCoco(drawer: HTMLElement) {
  const context = readContext(drawer);
  const profile = matchTaskTemplateLotProfile(context.lot);
  const description = buildDescription(context, profile);
  const characteristics = buildCharacteristics(context, profile);
  const fieldReturns = buildFieldReturns(profile.fieldGuidance);

  const descriptionInput = getLabeledTextarea(drawer, "description technique");
  const characteristicsInput = getLabeledTextarea(drawer, "caracteristiques") ?? getLabeledTextarea(drawer, "caractéristiques");
  const remarksInput = getLabeledTextarea(drawer, "remarques");

  if (descriptionInput && canReplace(descriptionInput.value, "description technique")) setTextareaValue(descriptionInput, description);
  if (characteristicsInput && canReplace(characteristicsInput.value, "caractéristiques")) setTextareaValue(characteristicsInput, characteristics.join("\n"));
  if (remarksInput && canReplace(remarksInput.value, "retours terrain")) setTextareaValue(remarksInput, fieldReturns.join("\n"));

  updateSummary(drawer, "Coco a généré les champs de sortie à partir des données saisies au-dessus.");
}

function readContext(drawer: HTMLElement) {
  return {
    title: getLabeledInput(drawer, "titre")?.value.trim() || "Template de tâche",
    lot: getLabeledInput(drawer, "lot")?.value.trim() || "Lot à préciser",
    unit: getLabeledInput(drawer, "unite")?.value.trim() || getLabeledInput(drawer, "unité")?.value.trim() || "unité",
    materials: readMaterialRows(drawer),
    equipment: readEquipmentRows(drawer),
    labor: readLaborRows(drawer),
    fees: readFeeRows(drawer),
  };
}

function buildDescription(context: ReturnType<typeof readContext>, profile: ReturnType<typeof matchTaskTemplateLotProfile>) {
  const materialLine = context.materials.length
    ? `Matériaux pour 1 ${context.unit} : ${joinFrench(context.materials.map((row) => row.name).filter(Boolean))}.`
    : `Matériaux pour 1 ${context.unit} : à compléter.`;
  const equipmentLine = context.equipment.length
    ? `Matériel à prévoir : ${joinFrench(context.equipment.map((row) => row.name).filter(Boolean))}.`
    : "Matériel à prévoir : à compléter si nécessaire.";
  const laborLine = context.labor.length
    ? `Main d'oeuvre estimée : ${context.labor.map((row) => `${row.duration || "?"} ${row.unit || "h"}`).join(", ")}.`
    : "Main d'oeuvre : à compléter.";
  const feesLine = context.fees.length
    ? `Frais intégrés : ${joinFrench(context.fees.map((row) => row.name).filter(Boolean))}.`
    : "Frais : aucun frais spécifique renseigné.";

  return [
    `${context.title} - ${profile.label || context.lot}. Unité de production : ${context.unit}.`,
    materialLine,
    equipmentLine,
    laborLine,
    feesLine,
    "Mode opératoire : contrôler le support, préparer et protéger la zone, exécuter les matériaux dans l'ordre logique, contrôler la finition, nettoyer, puis renseigner les écarts terrain.",
    profile.fieldGuidance,
  ].filter(Boolean).join("\n");
}

function buildCharacteristics(context: ReturnType<typeof readContext>, profile: ReturnType<typeof matchTaskTemplateLotProfile>) {
  const lines = [
    `Lot : ${profile.label || context.lot}`,
    `Unité de production : ${context.unit}`,
    `Marge main d'oeuvre cible : ${profile.laborMarginRate} %`,
  ];

  for (const material of context.materials) {
    const ratio = material.quantity && material.ratioUnit && material.sourceUnit
      ? ` - quantité pour 1 ${material.sourceUnit} : ${material.quantity} ${material.ratioUnit}`
      : " - quantité pour 1 unité : à préciser";
    lines.push(`Matériau : ${material.name || "à préciser"}${ratio}`);
  }
  for (const equipment of context.equipment) {
    if (equipment.name) lines.push(`Matériel : ${equipment.name}${equipment.quantity ? ` - ${equipment.quantity} ${equipment.unit}` : ""}`);
  }
  for (const labor of context.labor) {
    lines.push(`Main d'oeuvre : ${labor.duration || "?"} ${labor.unit || "h"}${labor.cost ? ` - PR ${labor.cost} €/h` : ""}${labor.sale ? ` - PV ${labor.sale} €/h` : ""}`);
  }
  for (const fee of context.fees) {
    if (fee.name) lines.push(`Matériel/frais : ${fee.name}${fee.cost ? ` - PR ${fee.cost} € HT` : ""}${fee.sale ? ` - PV ${fee.sale} € HT` : ""}`);
  }

  return uniqueLines(lines);
}

function buildFieldReturns(profileGuidance: string) {
  return uniqueLines([
    "Retour terrain à alimenter : quantité réellement consommée, temps passé et écart avec le ratio prévu.",
    "Points à contrôler : support, préparation, compatibilité produit, finition, nettoyage, réserves éventuelles.",
    "Erreurs à éviter : démarrer sans support validé, oublier protections, sous-estimer attente/séchage, oublier matériel ou consommables.",
    profileGuidance,
  ].filter(Boolean));
}

function updateSummary(drawer: HTMLElement, message?: string) {
  const summary = drawer.querySelector("[data-batipro-coco-template-summary]") as HTMLElement | null;
  if (!summary) return;
  const context = readContext(drawer);
  const profile = matchTaskTemplateLotProfile(context.lot);
  summary.textContent = message ?? `Coco utilisera : ${context.materials.length} matériau(x), ${context.equipment.length} matériel(s), ${context.labor.length} ligne(s) main d'oeuvre, ${context.fees.length} frais. Lot détecté : ${profile.label}.`;
}

function readMaterialRows(drawer: HTMLElement) {
  return findRows(drawer, "Matériau #").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      name: inputs[0]?.value.trim() ?? "",
      sourceUnit: inputs[1]?.value.trim() ?? "",
      quantity: inputs[2]?.value.trim() ?? "",
      ratioUnit: inputs[3]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.quantity);
}

function readEquipmentRows(drawer: HTMLElement) {
  return findRows(drawer, "Matériel #").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      name: inputs[0]?.value.trim() ?? "",
      quantity: inputs[1]?.value.trim() ?? "",
      unit: inputs[2]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.quantity);
}

function readLaborRows(drawer: HTMLElement) {
  return findRows(drawer, "Saisie manuelle").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      duration: inputs[0]?.value.trim() ?? "",
      unit: inputs[1]?.value.trim() ?? "h",
      cost: inputs[2]?.value.trim() ?? "",
      sale: inputs[3]?.value.trim() ?? "",
    };
  }).filter((row) => row.duration || row.cost || row.sale);
}

function readFeeRows(drawer: HTMLElement) {
  return findRows(drawer, "Location matériel").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      name: inputs[0]?.value.trim() ?? "",
      cost: inputs[1]?.value.trim() ?? "",
      sale: inputs[2]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.cost || row.sale);
}

function findRows(drawer: HTMLElement, marker: string) {
  return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-slate-200.bg-slate-50, .grid.rounded-2xl.border.border-slate-200.bg-slate-50"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => element.textContent?.includes(marker));
}

function findTaskTemplateDrawers() {
  return Array.from(document.querySelectorAll(".fixed.inset-0"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => Boolean(element.textContent?.includes("Nouveau template") || element.textContent?.includes("Préparation avancée")));
}

function findAdvancedPreparationSection(drawer: HTMLElement) {
  return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-blue-200"))
    .find((element): element is HTMLElement => element instanceof HTMLElement && Boolean(element.textContent?.includes("Préparation avancée"))) ?? null;
}

function findCostReferenceRow(drawer: HTMLElement) {
  const input = getLabeledInput(drawer, "coût de référence");
  return input?.closest(".grid") as HTMLElement | null;
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

function canReplace(value: string, label: string) {
  return !value.trim() || window.confirm(`Le champ ${label} contient déjà du texte. Remplacer par la proposition Coco ?`);
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
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
  const clean = values.filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} et ${clean[clean.length - 1]}`;
}

function uniqueLines(lines: string[]) {
  return lines.filter((line, index) => lines.findIndex((candidate) => normalizeText(candidate) === normalizeText(line)) === index);
}
