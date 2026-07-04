let installed = false;
let observer: MutationObserver | null = null;

const LOT_MARGIN_PROFILES = [
  { patterns: ["electricite", "elec", "courant fort", "courant faible"], label: "Électricité", laborMarginRate: 55 },
  { patterns: ["platrerie", "placo", "cloison", "doublage", "isolation"], label: "Plâtrerie", laborMarginRate: 30 },
  { patterns: ["peinture", "revetement mural", "papier peint"], label: "Peinture", laborMarginRate: 30 },
  { patterns: ["plomberie", "sanitaire", "chauffage", "cvc"], label: "Plomberie", laborMarginRate: 45 },
  { patterns: ["menuiserie", "agencement"], label: "Menuiserie", laborMarginRate: 35 },
  { patterns: ["sol", "carrelage", "parquet", "faience", "faïence"], label: "Sols / carrelage", laborMarginRate: 35 },
  { patterns: ["facade", "façade", "ite", "ravalement"], label: "Façade", laborMarginRate: 35 },
];

export function installTaskTemplateCocoAssistantBridge() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("input", onTemplateInput, true);
  document.addEventListener("change", onTemplateInput, true);
  observer = new MutationObserver(() => installAssistantCards());
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(installAssistantCards, 0);
}

function onTemplateInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const drawer = findTaskTemplateDrawer(target);
  if (!drawer) return;

  if (isLotInput(drawer, target) || isLaborCostInput(drawer, target)) {
    applyLaborMargin(drawer);
    updateAssistantSummary(drawer);
  }
}

function installAssistantCards() {
  for (const drawer of findTaskTemplateDrawers()) {
    if (drawer.dataset.batiproTaskCocoAssistant === "true") continue;
    const titleInput = getLabeledInput(drawer, "titre");
    const anchor = titleInput?.closest("label") as HTMLElement | null;
    if (!anchor?.parentElement) continue;

    drawer.dataset.batiproTaskCocoAssistant = "true";
    anchor.insertAdjacentElement("afterend", buildAssistantCard(drawer));
    applyLaborMargin(drawer);
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
  title.textContent = "Assistant Coco template";
  const subtitle = document.createElement("div");
  subtitle.className = "mt-1 text-xs text-slate-600";
  subtitle.textContent = "Pré-remplit le template à partir du lot, de la désignation, des matériaux, de la main d'oeuvre et des frais saisis.";
  text.append(title, subtitle);

  const actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2";

  const marginButton = document.createElement("button");
  marginButton.type = "button";
  marginButton.className = "rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-50";
  marginButton.textContent = "Appliquer marge lot";
  marginButton.addEventListener("click", () => {
    applyLaborMargin(drawer, true);
    updateAssistantSummary(drawer);
  });

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800";
  generateButton.textContent = "Générer avec Coco";
  generateButton.addEventListener("click", () => generateTemplateFields(drawer));

  actions.append(marginButton, generateButton);
  header.append(text, actions);

  const summary = document.createElement("div");
  summary.dataset.batiproTaskCocoAssistantSummary = "true";
  summary.className = "mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600";

  card.append(header, summary);
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

  applyLaborMargin(drawer, true);
  updateAssistantSummary(drawer, "Coco a généré les champs métier à partir du template en cours.");
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
  const unit = context.unit || "unité";
  const materials = context.materials.map((material) => material.name).filter(Boolean).slice(0, 4);
  const materialText = materials.length ? ` avec ${joinFrench(materials)}` : "";
  const laborText = context.labor.length ? ` Main d'oeuvre prévue : ${context.labor.map((row) => `${row.duration || "?"} ${row.unit || "h"}`).join(", ")}.` : "";

  return [
    `${title} - lot ${profile.label}.`,
    `Exécution prévue au ${unit}${materialText}.`,
    laborText,
    "Préparer la zone, vérifier les supports, appliquer les produits conformément aux fiches produit et contrôler le résultat avant validation.",
  ].filter(Boolean).join("\n");
}

function buildCharacteristics(context: ReturnType<typeof readTemplateContext>, profile: ReturnType<typeof getLotProfile>) {
  const lines = [
    `Lot : ${profile.label}`,
    `Unité de production : ${context.unit || "à préciser"}`,
    `Marge main d'oeuvre cible : ${profile.laborMarginRate} %`,
  ];

  for (const material of context.materials.slice(0, 6)) {
    const ratio = material.ratioQuantity && material.ratioUnit && material.sourceUnit
      ? ` - ratio ${material.ratioQuantity} ${material.ratioUnit}/${material.sourceUnit}`
      : "";
    lines.push(`Matériau : ${material.name || "à préciser"}${ratio}`);
  }

  for (const fee of context.fees.slice(0, 4)) {
    if (fee.designation) lines.push(`Matériel/frais : ${fee.designation}${fee.cost ? ` - coût ${fee.cost} € HT` : ""}`);
  }

  if (context.labor.length) {
    lines.push(`Main d'oeuvre : ${context.labor.map((row) => `${row.duration || "?"} ${row.unit || "h"} à ${row.cost || "?"} € HT`).join(" / ")}`);
  }

  return uniqueLines(lines);
}

function buildFieldReturns(profile: ReturnType<typeof getLotProfile>) {
  const lines = [
    "Retour terrain attendu : confirmer quantité réellement consommée, temps passé et éventuels écarts avec le ratio prévu.",
    "Contrôle qualité : vérifier support, finition, conformité aux fiches produit et réserves éventuelles avant clôture.",
    "Point d'attention : signaler toute incompatibilité support/produit, manque matériel, temps d'attente ou condition chantier bloquante.",
  ];

  if (profile.label === "Électricité") {
    lines.push("Électricité : vérifier repérage, continuité, protections, essais et conformité avant rebouchage ou fermeture.");
  }
  if (profile.label === "Plâtrerie") {
    lines.push("Plâtrerie : vérifier planéité, aplomb, fixation, traitement des joints et réservations avant finition.");
  }
  if (profile.label === "Peinture") {
    lines.push("Peinture : vérifier préparation support, teinte, nombre de couches, séchage et aspect final à la lumière.");
  }

  return lines;
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
  const key = normalizeText(lot);
  return LOT_MARGIN_PROFILES.find((profile) => profile.patterns.some((pattern) => key.includes(normalizeText(pattern)))) ?? {
    label: lot.trim() || "Lot standard",
    laborMarginRate: 30,
  };
}

function updateAssistantSummary(drawer: HTMLElement, message?: string) {
  const summary = drawer.querySelector("[data-batipro-task-coco-assistant-summary]") as HTMLElement | null;
  if (!summary) return;
  const profile = getLotProfile(getLabeledInput(drawer, "lot")?.value ?? "");
  summary.textContent = message ?? `Profil détecté : ${profile.label} - marge main d'oeuvre ${profile.laborMarginRate} %. Coco utilise les matériaux, ratios, main d'oeuvre et frais du template.`;
}

function shouldFill(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return window.confirm("Ce champ contient déjà du texte. Coco peut le remplacer par une proposition recalculée. Continuer ?");
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
