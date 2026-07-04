import {
  getTaskTemplateLotProfiles,
  matchTaskTemplateLotProfile,
  TASK_TEMPLATE_LOT_PROFILES_CHANGED,
} from "./taskTemplateLotProfiles";

let installed = false;
let observer: MutationObserver | null = null;
let pending = false;

type MaterialRow = {
  name: string;
  sourceUnit: string;
  quantity: string;
  ratioUnit: string;
  loss: string;
  note: string;
  purchasePrice: string;
  salePrice: string;
};

type EquipmentRow = {
  name: string;
  quantity: string;
  unit: string;
  note: string;
};

type GeneratedOutputs = {
  materialLines: string[];
  equipmentLines: string[];
  procedureLines: string[];
  controlLines: string[];
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
    updateSummary(drawer);
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

    const advancedSection = findAdvancedPreparationSection(drawer);
    const insertionAnchor = advancedSection ?? findCostReferenceRow(drawer);
    if (!insertionAnchor?.parentElement) return;

    const outputSection = buildOutputSection(drawer);
    outputSection.append(descriptionLabel, characteristicsLabel, remarksLabel);
    insertionAnchor.insertAdjacentElement("afterend", outputSection);
    drawer.dataset.batiproCocoTemplateOrganized = "true";
  }

  updateSummary(drawer);
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
    updateSummary(drawer);
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
  const context = readContext(drawer);
  const profile = matchTaskTemplateLotProfile(context.lot);

  const unitInput = getLabeledInput(drawer, "unite") ?? getLabeledInput(drawer, "unité");
  if (unitInput && profile.defaultUnit && (force || !unitInput.value.trim())) {
    setInputValue(unitInput, profile.defaultUnit);
  }

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

  const header = document.createElement("div");
  header.className = "flex flex-wrap items-start justify-between gap-3";
  const text = document.createElement("div");
  text.innerHTML = `
    <div class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Coco template</div>
    <div class="mt-1 text-sm font-semibold text-slate-950">Génération intelligente de la tâche</div>
    <div class="mt-1 text-xs text-slate-600">Coco analyse les produits liés, leurs notes techniques, le lot, la main d'oeuvre et les frais pour produire les besoins chantier.</div>
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

  const generated = document.createElement("div");
  generated.dataset.batiproCocoGeneratedOutputs = "true";
  generated.className = "grid gap-3 xl:grid-cols-4";
  generated.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-3">
      <div class="text-sm font-semibold text-slate-900">Liste matériaux Coco</div>
      <div data-coco-materials class="mt-2 whitespace-pre-line text-sm text-slate-700">Clique sur "Générer avec Coco" après avoir ajouté les matériaux.</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-3">
      <div class="text-sm font-semibold text-slate-900">Liste matériel Coco</div>
      <div data-coco-equipment class="mt-2 whitespace-pre-line text-sm text-slate-700">Coco proposera aussi le matériel à partir des fiches techniques.</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-3">
      <div class="text-sm font-semibold text-slate-900">Mode opératoire complet</div>
      <div data-coco-procedure class="mt-2 whitespace-pre-line text-sm text-slate-700">Clique sur "Générer avec Coco" pour créer les étapes terrain.</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white p-3">
      <div class="text-sm font-semibold text-slate-900">Contrôles / erreurs à éviter</div>
      <div data-coco-controls class="mt-2 whitespace-pre-line text-sm text-slate-700">Coco ajoutera les contrôles et alertes utiles.</div>
    </div>
  `;

  section.append(header, summary, generated);
  return section;
}

function generateWithCoco(drawer: HTMLElement) {
  applyLotDefaults(drawer, false);
  const context = readContext(drawer);
  const profile = matchTaskTemplateLotProfile(context.lot);
  const generated = buildGeneratedOutputs(context, profile);
  const description = buildDescription(context, profile, generated);
  const characteristics = buildCharacteristics(context, profile, generated);
  const fieldReturns = buildFieldReturns(profile.fieldGuidance, generated.controlLines);

  setGeneratedOutput(drawer, "[data-coco-materials]", generated.materialLines);
  setGeneratedOutput(drawer, "[data-coco-equipment]", generated.equipmentLines);
  setGeneratedOutput(drawer, "[data-coco-procedure]", generated.procedureLines);
  setGeneratedOutput(drawer, "[data-coco-controls]", generated.controlLines);

  const descriptionInput = getLabeledTextarea(drawer, "description technique");
  const characteristicsInput = getLabeledTextarea(drawer, "caracteristiques") ?? getLabeledTextarea(drawer, "caractéristiques");
  const remarksInput = getLabeledTextarea(drawer, "remarques");

  if (descriptionInput && canReplace(descriptionInput.value, "description technique")) setTextareaValue(descriptionInput, description);
  if (characteristicsInput && canReplace(characteristicsInput.value, "caractéristiques")) setTextareaValue(characteristicsInput, characteristics.join("\n"));
  if (remarksInput && canReplace(remarksInput.value, "retours terrain")) setTextareaValue(remarksInput, fieldReturns.join("\n"));

  updateSummary(drawer, "Coco a analysé les matériaux, proposé le matériel, créé le mode opératoire et rempli les champs enregistrés.");
}

function readContext(drawer: HTMLElement) {
  return {
    title: getLabeledInput(drawer, "titre")?.value.trim() || "Template de tâche",
    lot: getLotValue(drawer) || "Lot à préciser",
    unit: getLabeledInput(drawer, "unite")?.value.trim() || getLabeledInput(drawer, "unité")?.value.trim() || "unité",
    materials: readMaterialRows(drawer),
    equipment: readEquipmentRows(drawer),
    labor: readLaborRows(drawer),
    fees: readFeeRows(drawer),
  };
}

function getLotValue(drawer: HTMLElement) {
  const select = drawer.querySelector("select[data-batipro-lot-select='true']") as HTMLSelectElement | null;
  return select?.value.trim() || getLabeledInput(drawer, "lot")?.value.trim() || "";
}

function buildGeneratedOutputs(context: ReturnType<typeof readContext>, profile: ReturnType<typeof matchTaskTemplateLotProfile>): GeneratedOutputs {
  const enrichedMaterials = context.materials.map((material) => enrichMaterial(material, context.unit));

  const materialLines = enrichedMaterials.length
    ? enrichedMaterials.map((material, index) => {
      const price = material.purchasePrice || material.salePrice
        ? ` - PR ${material.purchasePrice || "?"} HT${material.salePrice ? ` / PV ${material.salePrice} HT` : ""}`
        : "";
      const loss = material.loss ? ` - perte ${material.loss} %` : "";
      return `${index + 1}. ${material.name || "Matériau à préciser"} : ${material.quantity} ${material.ratioUnit} pour 1 ${material.sourceUnit}${loss}${price}`;
    })
    : [`1. Aucun matériau renseigné : ajouter les produits liés avant génération.`];

  const inferredEquipment = inferEquipment(context, enrichedMaterials, profile.label || context.lot);
  const equipmentLines = inferredEquipment.map((item, index) => `${index + 1}. ${item}`);

  const procedureLines = buildProcedureLines(context, profile, enrichedMaterials, inferredEquipment);
  const controlLines = buildControlLines(context, enrichedMaterials, profile.fieldGuidance);

  return { materialLines, equipmentLines, procedureLines, controlLines };
}

function enrichMaterial(material: MaterialRow, taskUnit: string) {
  const note = cleanTechnicalNote(material.note);
  const extractedRatio = extractRatioFromText(note, taskUnit);
  const extractedLoss = extractLossFromText(note);
  return {
    ...material,
    sourceUnit: normalizeUnit(material.sourceUnit || extractedRatio.sourceUnit || taskUnit),
    quantity: material.quantity || extractedRatio.quantity || "à préciser",
    ratioUnit: normalizeUnit(material.ratioUnit || extractedRatio.ratioUnit || material.sourceUnit || "unité"),
    loss: material.loss || extractedLoss || "",
    note,
  };
}

function inferEquipment(context: ReturnType<typeof readContext>, materials: ReturnType<typeof enrichMaterial>[], lot: string) {
  const lines: string[] = [];

  for (const item of context.equipment) {
    if (item.name) lines.push(`${item.name}${item.quantity ? ` : ${item.quantity} ${item.unit || "u"}` : ""}${item.note ? ` - ${item.note}` : ""}`);
  }
  for (const fee of context.fees) {
    if (fee.name) lines.push(`${fee.name}${fee.cost ? ` - PR ${fee.cost} € HT` : ""}${fee.sale ? ` - PV ${fee.sale} € HT` : ""}${fee.note ? ` - ${fee.note}` : ""}`);
  }

  const text = normalizeText(`${context.title} ${lot} ${materials.map((material) => `${material.name} ${material.note}`).join(" ")}`);
  const addIf = (condition: boolean, label: string) => {
    if (condition) lines.push(label);
  };

  addIf(/peinture|facade|facade|pantifilm|revêtement|revetement|impritex|pantiprim/.test(text), "Protections chantier : bâches, adhésif de masquage, protection menuiseries/sols");
  addIf(/peinture|pantifilm|revêtement|revetement/.test(text), "Application : brosse et rouleau polyamide texturé 18 mm");
  addIf(/pistolet|buse|200 bars|519/.test(text), "Application mécanisée si prévue : pistolet 200 bars avec buse 519");
  addIf(/lavage|haute pression|facade|façade/.test(text), "Préparation support : nettoyeur haute pression adapté au support");
  addIf(/brossage|epoussetage|egrenage|égrenage/.test(text), "Préparation support : brosse, grattoir, abrasif/égrenoir et moyen de dépoussiérage");
  addIf(/eau|nettoyage/.test(text), "Nettoyage : seau d'eau, chiffons, rinçage/nettoyage du matériel");
  addIf(/facade|façade|exterieur|extérieur/.test(text), "Accès/façade : échelle, escabeau ou échafaudage selon hauteur et sécurité");
  addIf(/peinture|solvant|poussiere|poussière/.test(text), "EPI : gants, lunettes, protection respiratoire si ponçage/pulvérisation");

  if (lines.length === 0) lines.push("Matériel à compléter : Coco n'a pas assez d'informations produit pour proposer une liste fiable.");
  return uniqueLines(lines);
}

function buildProcedureLines(
  context: ReturnType<typeof readContext>,
  profile: ReturnType<typeof matchTaskTemplateLotProfile>,
  materials: ReturnType<typeof enrichMaterial>[],
  equipment: string[],
) {
  const text = normalizeText(`${context.title} ${context.lot} ${materials.map((material) => `${material.name} ${material.note}`).join(" ")}`);
  const lines = [
    `1. Vérifier le support, les surfaces à traiter, l'accès et les conditions météo avant ${context.title}.`,
    `2. Protéger la zone : ${equipment.filter((item) => /protection|bache|masquage/i.test(item)).join(", ") || "bâcher, masquer et sécuriser les zones sensibles"}.`,
  ];

  if (/egrenage|égrenage|brossage|epoussetage|lavage|haute pression|preparation|préparation/.test(text)) {
    lines.push("3. Préparer le support : égrenage/grattage des parties non adhérentes, brossage, dépoussiérage, lavage haute pression si nécessaire, puis séchage complet.");
  } else {
    lines.push("3. Préparer le support suivant l'état réel : nettoyage, dépoussiérage et suppression des parties non adhérentes.");
  }

  const hasPrimer = /pantiprim|impritex|impriderme|primaire/.test(text);
  lines.push(hasPrimer
    ? "4. Appliquer l'impression/primer adapté au support avant finition, puis respecter le séchage indiqué."
    : "4. Vérifier si une impression est nécessaire selon le support et la fiche produit.");

  const finishMaterial = materials.find((material) => normalizeText(material.name).includes("pantifilm")) ?? materials[0];
  if (finishMaterial) {
    lines.push(`5. Appliquer ${finishMaterial.name} au ratio prévu : ${finishMaterial.quantity} ${finishMaterial.ratioUnit} pour 1 ${finishMaterial.sourceUnit}. Garnir régulièrement le support et éviter les manques.`);
  } else {
    lines.push(`5. Appliquer les matériaux selon les ratios renseignés pour 1 ${context.unit}.`);
  }

  if (/recouvrable|24 h|sechage|séchage|hors pluie/.test(text)) {
    lines.push("6. Respecter les temps de séchage/recouvrement avant couche suivante ou réception.");
  }

  lines.push("7. Contrôler la finition : aspect, recouvrement, zones oubliées, coulures/surcharges, propreté des protections et réserves éventuelles.");
  lines.push("8. Renseigner le retour terrain : surface réalisée, consommation réelle, temps passé, matériel manquant et écarts avec le template.");
  if (profile.fieldGuidance) lines.push(`9. Consigne lot : ${profile.fieldGuidance}`);
  return uniqueLines(lines);
}

function buildControlLines(context: ReturnType<typeof readContext>, materials: ReturnType<typeof enrichMaterial>[], profileGuidance: string) {
  const text = normalizeText(`${context.title} ${materials.map((material) => `${material.name} ${material.note}`).join(" ")}`);
  const lines = [
    "Contrôle support : support sain, propre, sec, cohérent et compatible avec le système prévu.",
    "Contrôle quantité : comparer consommation réelle et ratio prévu, expliquer tout écart important.",
    "Contrôle qualité : vérifier aspect final, régularité, recouvrement, nettoyage et photos avant clôture.",
  ];

  if (/gel|averse|brise|humidite|humidité|5 c|80/.test(text) || /facade|façade|exterieur|extérieur/.test(text)) {
    lines.push("Erreurs à éviter : appliquer par gel, pluie menaçante, forte humidité, support trop froid ou support non sec.");
  }
  if (/interieur|intérieur/.test(text)) lines.push("Erreur à éviter : ne pas employer ce produit en intérieur si la fiche le proscrit.");
  if (/teinte|soleil|absorption solaire/.test(text)) lines.push("Point d'attention : vérifier les teintes foncées exposées au soleil et les prescriptions fabricant.");
  if (/25 cm|sol/.test(text)) lines.push("Point d'attention façade : respecter l'arrêt du revêtement à 25 cm minimum du sol si indiqué par la fiche.");
  if (profileGuidance) lines.push(`Retour terrain lot : ${profileGuidance}`);

  return uniqueLines(lines);
}

function buildDescription(
  context: ReturnType<typeof readContext>,
  profile: ReturnType<typeof matchTaskTemplateLotProfile>,
  generated: GeneratedOutputs,
) {
  const laborLine = context.labor.length
    ? `Main d'oeuvre estimée : ${context.labor.map((row) => `${row.duration || "?"} ${row.unit || "h"}`).join(", ")}.`
    : "Main d'oeuvre : à compléter.";

  return [
    `${context.title} - ${profile.label || context.lot}. Unité de production : ${context.unit}.`,
    "Matériaux prévus pour 1 unité :",
    ...generated.materialLines,
    "Matériel/outillage à prévoir :",
    ...generated.equipmentLines,
    laborLine,
    "Mode opératoire complet :",
    ...generated.procedureLines,
  ].filter(Boolean).join("\n");
}

function buildCharacteristics(
  context: ReturnType<typeof readContext>,
  profile: ReturnType<typeof matchTaskTemplateLotProfile>,
  generated: GeneratedOutputs,
) {
  const lines = [
    `Lot : ${profile.label || context.lot}`,
    `Unité de production : ${context.unit}`,
    `Marge main d'oeuvre cible : ${profile.laborMarginRate} %`,
    "Matériaux pour 1 unité :",
    ...generated.materialLines,
    "Matériel proposé par Coco :",
    ...generated.equipmentLines,
    "Contrôles / erreurs à éviter :",
    ...generated.controlLines,
  ];

  for (const labor of context.labor) {
    lines.push(`Main d'oeuvre : ${labor.duration || "?"} ${labor.unit || "h"}${labor.cost ? ` - PR ${labor.cost} €/h` : ""}${labor.sale ? ` - PV ${labor.sale} €/h` : ""}`);
  }

  return uniqueLines(lines);
}

function buildFieldReturns(profileGuidance: string, controlLines: string[]) {
  return uniqueLines([
    "Retour terrain à alimenter après chantier : surface réalisée, quantité réellement consommée, temps passé et écart avec le ratio prévu.",
    "Noter le matériel manquant, les consommables oubliés, les problèmes support et les attentes/séchages qui ont ralenti l'équipe.",
    ...controlLines,
    profileGuidance,
  ].filter(Boolean));
}

function updateSummary(drawer: HTMLElement, message?: string) {
  const summary = drawer.querySelector("[data-batipro-coco-template-summary]") as HTMLElement | null;
  if (!summary) return;
  const context = readContext(drawer);
  const profile = matchTaskTemplateLotProfile(context.lot);
  summary.textContent = message ?? `Coco utilisera : ${context.materials.length} matériau(x), ${context.equipment.length} matériel(s) saisi(s), ${context.labor.length} ligne(s) main d'oeuvre, ${context.fees.length} frais. Lot détecté : ${profile.label}. Il proposera aussi le matériel manquant depuis les fiches produits.`;
}

function setGeneratedOutput(drawer: HTMLElement, selector: string, lines: string[]) {
  const target = drawer.querySelector(selector) as HTMLElement | null;
  if (!target) return;
  target.textContent = lines.join("\n");
}

function readMaterialRows(drawer: HTMLElement): MaterialRow[] {
  return findRows(drawer, "Matériau #").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      name: readSelectOrInputValue(row, 0) || inputs[0]?.value.trim() || "",
      sourceUnit: inputs[1]?.value.trim() ?? "",
      quantity: inputs[2]?.value.trim() ?? "",
      ratioUnit: inputs[3]?.value.trim() ?? "",
      loss: inputs[4]?.value.trim() ?? "",
      note: inputs[5]?.value.trim() ?? "",
      purchasePrice: inputs[6]?.value.trim() ?? "",
      salePrice: inputs[7]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.quantity || row.note);
}

function readEquipmentRows(drawer: HTMLElement): EquipmentRow[] {
  return findRows(drawer, "Matériel #").map((row) => {
    const inputs = Array.from(row.querySelectorAll("input"));
    return {
      name: inputs[0]?.value.trim() ?? "",
      quantity: inputs[1]?.value.trim() ?? "",
      unit: inputs[2]?.value.trim() ?? "",
      note: inputs[4]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.quantity || row.note);
}

function readLaborRows(drawer: HTMLElement) {
  return findLaborRows(drawer).map((row) => {
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
      note: inputs[3]?.value.trim() ?? "",
    };
  }).filter((row) => row.name || row.cost || row.sale || row.note);
}

function findLaborRows(drawer: HTMLElement) {
  return findRows(drawer, "Saisie manuelle");
}

function isLaborCostInput(drawer: HTMLElement, target: Element) {
  return findLaborRows(drawer).some((row) => Array.from(row.querySelectorAll("input"))[2] === target);
}

function findRows(drawer: HTMLElement, marker: string) {
  return Array.from(drawer.querySelectorAll(".rounded-2xl.border.border-slate-200.bg-slate-50, .grid.rounded-2xl.border.border-slate-200.bg-slate-50"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => element.textContent?.includes(marker));
}

function findTaskTemplateDrawers() {
  return Array.from(document.querySelectorAll(".fixed.inset-0"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter(isTaskTemplateDrawer);
}

function isTaskTemplateDrawer(element: HTMLElement) {
  return Boolean(element.textContent?.includes("Nouveau template") || element.textContent?.includes("Préparation avancée"));
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

function setCheckboxByText(drawer: HTMLElement, labelText: string, checked: boolean, force: boolean) {
  const label = Array.from(drawer.querySelectorAll("label"))
    .find((candidate) => normalizeText(candidate.textContent).includes(normalizeText(labelText)));
  const input = label?.querySelector("input[type='checkbox']");
  if (!(input instanceof HTMLInputElement)) return;
  if (!force && input.checked === checked) return;
  input.checked = checked;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function readSelectOrInputValue(row: HTMLElement, index: number) {
  const controls = Array.from(row.querySelectorAll("select, input"));
  const control = controls[index];
  if (control instanceof HTMLSelectElement) return control.selectedOptions[0]?.textContent?.trim() || control.value.trim();
  if (control instanceof HTMLInputElement) return control.value.trim();
  return "";
}

function cleanTechnicalNote(value: string) {
  return value
    .replace(/Fichier importé pour analyse automatique[^.]*\./gi, "")
    .replace(/Stockage documentaire[^.]*\./gi, "")
    .replace(/Dernière mise[\s\S]*?www\.seigneurie\.com/gi, "")
    .replace(/PPG AC[\s\S]*?www\.seigneurie\.com/gi, "")
    .replace(/Prix achat standard retenu[^\n]*/gi, "")
    .replace(/Prix vente conseillé[^\n]*/gi, "")
    .replace(/Conditionnement\s*:\s*[^\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRatioFromText(text: string, taskUnit: string) {
  const direct = text.match(/([0-9]+(?:[,.][0-9]+)?)\s*(l|litre|litres|kg|g|ml)\s*\/\s*m[²2]/i)
    ?? text.match(/([0-9]+(?:[,.][0-9]+)?)\s*(l|litre|litres|kg|g|ml)\s*par\s*m[²2]/i);
  if (direct) {
    let quantity = parseFrenchNumber(direct[1]) ?? 0;
    let unit = direct[2].toLowerCase();
    if (unit === "g") {
      quantity = quantity / 1000;
      unit = "kg";
    }
    if (unit === "ml") {
      quantity = quantity / 1000;
      unit = "l";
    }
    if (unit === "litre" || unit === "litres") unit = "l";
    return { quantity: formatNumber(quantity), ratioUnit: unit, sourceUnit: "m2" };
  }

  const inverse = text.match(/([0-9]+(?:[,.][0-9]+)?)\s*m[²2]\s*\/\s*(l|litre|litres|kg)/i);
  if (inverse) {
    const yieldValue = parseFrenchNumber(inverse[1]);
    if (yieldValue && yieldValue > 0) {
      let unit = inverse[2].toLowerCase();
      if (unit === "litre" || unit === "litres") unit = "l";
      return { quantity: formatNumber(1 / yieldValue), ratioUnit: unit, sourceUnit: "m2" };
    }
  }

  return { quantity: "", ratioUnit: "", sourceUnit: taskUnit };
}

function extractLossFromText(text: string) {
  const match = text.match(/perte\s*(?:préconisée|prevue|estimée|estimee)?\s*:?\s*([0-9]+(?:[,.][0-9]+)?)\s*%/i);
  return match?.[1]?.replace(",", ".") ?? "";
}

function normalizeUnit(value: string) {
  const clean = value.trim().toLowerCase().replace("²", "2");
  if (["m2", "m 2", "m²"].includes(clean)) return "m2";
  if (["litre", "litres", "l"].includes(clean)) return "l";
  return value.trim() || "unité";
}

function canReplace(value: string, label: string) {
  return !value.trim() || window.confirm(`Le champ ${label} contient déjà du texte. Remplacer par la proposition Coco ?`);
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

function parseFrenchNumber(value: unknown) {
  const number = Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100).replace(".", ",");
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

function uniqueLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, all) => all.findIndex((candidate) => normalizeText(candidate) === normalizeText(line)) === index);
}
