import { supabase } from "../../lib/supabaseClient";

export type CocoConfidence = "high" | "medium" | "low";

export type CocoMaterialResult = {
  label: string;
  quantity: number | null;
  unit: string | null;
  detail: string | null;
};

export type CocoEquipmentResult = {
  label: string;
  quantity: number | null;
  unit: string | null;
  required: boolean;
  detail: string | null;
};

export type CocoTaskTemplateCostSummary = {
  materialCostHt: number | null;
  materialSaleHt: number | null;
  laborCostHt: number | null;
  laborSaleHt: number | null;
  equipmentCostHt: number | null;
  equipmentSaleHt: number | null;
  feeCostHt: number | null;
  feeSaleHt: number | null;
  totalCostHt: number | null;
  salePriceHt: number | null;
  marginHt: number | null;
  marginRate: number | null;
  estimatedTimeHours: number | null;
  humanTimeHours: number | null;
  teamTimeHours: number | null;
  dailyCostHt: number | null;
  profitabilityRate: number | null;
  lines: string[];
};

export type CocoTaskTemplateResult = {
  materials: CocoMaterialResult[];
  equipment: CocoEquipmentResult[];
  consumables: string[];
  ppe: string[];
  procedure: string[];
  controls: string[];
  errorsToAvoid: string[];
  safetyPoints: string[];
  doePhotos: string[];
  doeDocuments: string[];
  technicalDescription: string;
  characteristics: string[];
  fieldReturns: string[];
  fieldReturnQuestions: string[];
  costSummary: CocoTaskTemplateCostSummary;
  confidence: CocoConfidence;
  missingInformation: string[];
  usedFallback?: boolean;
  errorMessage?: string | null;
};

export type CocoTaskTemplateContext = {
  task: {
    title: string;
    lot: string;
    unit: string;
    usage: string;
    defaultQuantity: number | null;
    timePerUnit: number | null;
    referenceUnitCostHt: number | null;
    existingTechnicalDescription: string;
    existingCharacteristics: string;
    existingNotes: string;
  };
  materials: Array<Record<string, unknown>>;
  labor: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  fees: Array<Record<string, unknown>>;
  lotProfile?: Record<string, unknown> | null;
  costSummary: {
    materialCost: number;
    materialSale: number;
    laborCost: number;
    laborSale: number;
    equipmentCost?: number;
    equipmentSale?: number;
    feeCost: number;
    feeSale: number;
    cost: number;
    sale: number;
    margin: number;
    marginRate: number;
    estimatedTimeHours?: number;
    humanTimeHours?: number;
    teamTimeHours?: number;
    dailyCost?: number;
    profitabilityRate?: number;
    lines?: string[];
  };
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function normalizeConfidence(value: unknown): CocoConfidence {
  const normalized = text(value).toLowerCase();
  if (normalized === "high" || normalized === "haute") return "high";
  if (normalized === "medium" || normalized === "moyenne") return "medium";
  return "low";
}

function materialFromUnknown(value: unknown): CocoMaterialResult | null {
  if (typeof value === "string") {
    const label = text(value);
    return label ? { label, quantity: null, unit: null, detail: null } : null;
  }
  const raw = value as Record<string, unknown> | null;
  const label = nullableText(raw?.label ?? raw?.designation ?? raw?.name ?? raw?.materialName);
  if (!label) return null;
  return {
    label,
    quantity: nullableNumber(raw?.quantity),
    unit: nullableText(raw?.unit),
    detail: nullableText(raw?.detail ?? raw?.notes ?? raw?.source),
  };
}

function equipmentFromUnknown(value: unknown): CocoEquipmentResult | null {
  if (typeof value === "string") {
    const label = text(value);
    return label ? { label, quantity: null, unit: null, required: false, detail: null } : null;
  }
  const raw = value as Record<string, unknown> | null;
  const label = nullableText(raw?.label ?? raw?.designation ?? raw?.name ?? raw?.equipmentName);
  if (!label) return null;
  return {
    label,
    quantity: nullableNumber(raw?.quantity),
    unit: nullableText(raw?.unit),
    required: raw?.required === true,
    detail: nullableText(raw?.detail ?? raw?.notes),
  };
}

function normalizeCostSummary(value: unknown, context: CocoTaskTemplateContext): CocoTaskTemplateCostSummary {
  if (Array.isArray(value)) {
    return {
      materialCostHt: context.costSummary.materialCost,
      materialSaleHt: context.costSummary.materialSale,
      laborCostHt: context.costSummary.laborCost,
      laborSaleHt: context.costSummary.laborSale,
      equipmentCostHt: context.costSummary.equipmentCost ?? 0,
      equipmentSaleHt: context.costSummary.equipmentSale ?? 0,
      feeCostHt: context.costSummary.feeCost,
      feeSaleHt: context.costSummary.feeSale,
      totalCostHt: context.costSummary.cost,
      salePriceHt: context.costSummary.sale,
      marginHt: context.costSummary.margin,
      marginRate: context.costSummary.marginRate,
      estimatedTimeHours: context.costSummary.estimatedTimeHours ?? null,
      humanTimeHours: context.costSummary.humanTimeHours ?? null,
      teamTimeHours: context.costSummary.teamTimeHours ?? null,
      dailyCostHt: context.costSummary.dailyCost ?? null,
      profitabilityRate: context.costSummary.profitabilityRate ?? null,
      lines: stringArray(value),
    };
  }
  const raw = value as Record<string, unknown> | null;
  return {
    materialCostHt: nullableNumber(raw?.materialCostHt ?? raw?.materialCost) ?? context.costSummary.materialCost,
    materialSaleHt: nullableNumber(raw?.materialSaleHt ?? raw?.materialSale) ?? context.costSummary.materialSale,
    laborCostHt: nullableNumber(raw?.laborCostHt ?? raw?.laborCost) ?? context.costSummary.laborCost,
    laborSaleHt: nullableNumber(raw?.laborSaleHt ?? raw?.laborSale) ?? context.costSummary.laborSale,
    equipmentCostHt: nullableNumber(raw?.equipmentCostHt ?? raw?.equipmentCost) ?? context.costSummary.equipmentCost ?? 0,
    equipmentSaleHt: nullableNumber(raw?.equipmentSaleHt ?? raw?.equipmentSale) ?? context.costSummary.equipmentSale ?? 0,
    feeCostHt: nullableNumber(raw?.feeCostHt ?? raw?.feeCost) ?? context.costSummary.feeCost,
    feeSaleHt: nullableNumber(raw?.feeSaleHt ?? raw?.feeSale) ?? context.costSummary.feeSale,
    totalCostHt: nullableNumber(raw?.totalCostHt ?? raw?.totalCost) ?? context.costSummary.cost,
    salePriceHt: nullableNumber(raw?.salePriceHt ?? raw?.salePrice) ?? context.costSummary.sale,
    marginHt: nullableNumber(raw?.marginHt ?? raw?.margin) ?? context.costSummary.margin,
    marginRate: nullableNumber(raw?.marginRate) ?? context.costSummary.marginRate,
    estimatedTimeHours: nullableNumber(raw?.estimatedTimeHours) ?? context.costSummary.estimatedTimeHours ?? null,
    humanTimeHours: nullableNumber(raw?.humanTimeHours) ?? context.costSummary.humanTimeHours ?? null,
    teamTimeHours: nullableNumber(raw?.teamTimeHours) ?? context.costSummary.teamTimeHours ?? null,
    dailyCostHt: nullableNumber(raw?.dailyCostHt ?? raw?.dailyCost) ?? context.costSummary.dailyCost ?? null,
    profitabilityRate: nullableNumber(raw?.profitabilityRate) ?? context.costSummary.profitabilityRate ?? null,
    lines: stringArray(raw?.lines).length ? stringArray(raw?.lines) : stringArray(context.costSummary.lines),
  };
}

function normalizeResult(raw: unknown, context: CocoTaskTemplateContext): CocoTaskTemplateResult {
  const result = raw as Record<string, unknown> | null;
  return {
    materials: (Array.isArray(result?.materials) ? result.materials : []).map(materialFromUnknown).filter((item): item is CocoMaterialResult => Boolean(item)),
    equipment: (Array.isArray(result?.equipment) ? result.equipment : []).map(equipmentFromUnknown).filter((item): item is CocoEquipmentResult => Boolean(item)),
    consumables: stringArray(result?.consumables),
    ppe: stringArray(result?.ppe ?? result?.PPE),
    procedure: stringArray(result?.procedure),
    controls: stringArray(result?.controls),
    errorsToAvoid: stringArray(result?.errorsToAvoid),
    safetyPoints: stringArray(result?.safetyPoints),
    doePhotos: stringArray(result?.doePhotos),
    doeDocuments: stringArray(result?.doeDocuments),
    technicalDescription: text(result?.technicalDescription),
    characteristics: stringArray(result?.characteristics),
    fieldReturns: stringArray(result?.fieldReturns),
    fieldReturnQuestions: stringArray(result?.fieldReturnQuestions),
    costSummary: normalizeCostSummary(result?.costSummary, context),
    confidence: normalizeConfidence(result?.confidence),
    missingInformation: stringArray(result?.missingInformation),
    usedFallback: result?.usedFallback === true,
    errorMessage: nullableText(result?.errorMessage),
  };
}

function fallbackResult(context: CocoTaskTemplateContext, error: unknown): CocoTaskTemplateResult {
  const materials = context.materials
    .map((row): CocoMaterialResult | null => {
      const label = nullableText(row.materialName);
      if (!label) return null;
      return {
        label,
        quantity: nullableNumber(row.ratioQuantity),
        unit: nullableText(row.ratioUnit ?? row.sourceUnit),
        detail: nullableText(row.notes),
      };
    })
    .filter((item): item is CocoMaterialResult => Boolean(item));
  const equipment = context.equipment
    .map((row): CocoEquipmentResult | null => {
      const label = nullableText(row.name);
      if (!label) return null;
      return {
        label,
        quantity: nullableNumber(row.defaultQuantity),
        unit: nullableText(row.unit),
        required: row.required === true,
        detail: nullableText(row.notes),
      };
    })
    .filter((item): item is CocoEquipmentResult => Boolean(item));

  return {
    materials,
    equipment,
    consumables: [],
    ppe: [],
    procedure: [
      "Verifier le support, les dimensions et les contraintes chantier avant demarrage.",
      "Preparer les materiaux, protections et outillages selon les ratios saisis.",
      "Executer l'ouvrage conformement aux fiches produits et controler le rendu avant repli.",
    ],
    controls: ["Support pret", "Quantites coherentes", "Finition conforme", "Zone nettoyee"],
    errorsToAvoid: ["Demarrer sans verifier le support", "Oublier les pertes ou consommables", "Ne pas tracer les ecarts terrain"],
    safetyPoints: ["Verifier les EPI et protections collectives adaptes avant demarrage."],
    doePhotos: ["Photo avant intervention", "Photo du support prepare", "Photo du resultat fini"],
    doeDocuments: ["Fiches techniques des produits utilises"],
    technicalDescription: context.task.existingTechnicalDescription || `${context.task.title} - preparation technique a completer depuis les donnees chantier.`,
    characteristics: [
      ...materials.map((item) => `${item.label}${item.quantity ? `: ${item.quantity} ${item.unit ?? ""}` : ""}`.trim()),
      ...equipment.map((item) => `Materiel: ${item.label}`),
    ],
    fieldReturns: ["Signaler les ecarts de consommation, blocages support, manque materiel ou informations techniques."],
    fieldReturnQuestions: ["Consommation reelle conforme au ratio ?", "Blocage ou support non conforme ?", "Photos DOE prises ?"],
    costSummary: {
      materialCostHt: context.costSummary.materialCost,
      materialSaleHt: context.costSummary.materialSale,
      laborCostHt: context.costSummary.laborCost,
      laborSaleHt: context.costSummary.laborSale,
      equipmentCostHt: context.costSummary.equipmentCost ?? 0,
      equipmentSaleHt: context.costSummary.equipmentSale ?? 0,
      feeCostHt: context.costSummary.feeCost,
      feeSaleHt: context.costSummary.feeSale,
      totalCostHt: context.costSummary.cost,
      salePriceHt: context.costSummary.sale,
      marginHt: context.costSummary.margin,
      marginRate: context.costSummary.marginRate,
      estimatedTimeHours: context.costSummary.estimatedTimeHours ?? null,
      humanTimeHours: context.costSummary.humanTimeHours ?? null,
      teamTimeHours: context.costSummary.teamTimeHours ?? null,
      dailyCostHt: context.costSummary.dailyCost ?? null,
      profitabilityRate: context.costSummary.profitabilityRate ?? null,
      lines: context.costSummary.lines?.length ? context.costSummary.lines : [
        `Materiaux: ${context.costSummary.materialCost.toFixed(2)} EUR HT`,
        `Main d'oeuvre: ${context.costSummary.laborCost.toFixed(2)} EUR HT`,
        `Frais: ${context.costSummary.feeCost.toFixed(2)} EUR HT`,
        `Total revient: ${context.costSummary.cost.toFixed(2)} EUR HT`,
      ],
    },
    confidence: "low",
    missingInformation: ["Generation IA indisponible: resultat local minimal a verifier."],
    usedFallback: true,
    errorMessage: error instanceof Error ? error.message : "Generation IA indisponible.",
  };
}

export async function generateTaskTemplateWithCoco(context: CocoTaskTemplateContext): Promise<CocoTaskTemplateResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-task-template", { body: context });
    if (error) throw error;
    const result = (data as { result?: unknown } | null)?.result;
    if (!result) throw new Error("Reponse IA vide pour le template de tache.");
    return normalizeResult(result, context);
  } catch (error) {
    return fallbackResult(context, error);
  }
}
