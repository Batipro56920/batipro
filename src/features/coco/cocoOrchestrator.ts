import { supabase } from "../../lib/supabaseClient";

export type CocoIntent =
  | "analyze_product"
  | "generate_task_template"
  | "prepare_field_task"
  | "summarize_field_feedback";

export type CocoTaskMaterialContext = {
  name: string;
  sourceUnit?: string;
  ratioQuantity?: number;
  ratioUnit?: string;
  lossPercent?: number;
  notes?: string;
};

export type CocoTaskTemplateContext = {
  title: string;
  lot?: string;
  unit?: string;
  technicalDescription?: string;
  characteristics?: string[];
  remarks?: string;
  materials?: CocoTaskMaterialContext[];
  equipment?: string[];
};

export type CocoTaskTemplateResult = {
  technicalDescription: string;
  characteristics: string[];
  remarks: string;
  materials: Array<{
    name: string;
    sourceUnit?: string;
    ratioQuantity?: number;
    ratioUnit?: string;
    lossPercent?: number;
    notes?: string;
  }>;
  equipment: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    required: boolean;
    notes?: string;
  }>;
  controls: string[];
  mistakesToAvoid: string[];
  missingInformation: string[];
  confidence: number;
  source: "remote" | "local";
};

type CocoOrchestratorRequest = {
  intent: CocoIntent;
  context: CocoTaskTemplateContext;
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeResult(value: unknown): CocoTaskTemplateResult | null {
  if (!value || typeof value !== "object") return null;
  const payload = "result" in value && value.result && typeof value.result === "object"
    ? value.result as Record<string, unknown>
    : value as Record<string, unknown>;
  if (!Array.isArray(payload.equipment) || !Array.isArray(payload.materials)) return null;

  const strings = (entry: unknown) =>
    Array.isArray(entry) ? entry.filter((item): item is string => typeof item === "string") : [];
  const materials = payload.materials
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? item.material_name ?? "").trim(),
      sourceUnit: typeof item.sourceUnit === "string" ? item.sourceUnit : undefined,
      ratioQuantity: typeof item.ratioQuantity === "number" ? item.ratioQuantity : undefined,
      ratioUnit: typeof item.ratioUnit === "string" ? item.ratioUnit : undefined,
      lossPercent: typeof item.lossPercent === "number" ? item.lossPercent : undefined,
      notes: typeof item.notes === "string" ? item.notes : undefined,
    }))
    .filter((item) => item.name.length > 0);
  const equipment = payload.equipment
    .map((item) => typeof item === "string" ? { name: item, required: true } : item)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? item.equipment_name ?? "").trim(),
      quantity: typeof item.quantity === "number" ? item.quantity : undefined,
      unit: typeof item.unit === "string" ? item.unit : undefined,
      required: item.required !== false,
      notes: typeof item.notes === "string" ? item.notes : undefined,
    }))
    .filter((item) => item.name.length > 0);

  return {
    technicalDescription: String(payload.technicalDescription ?? payload.description_technique ?? "").trim(),
    characteristics: strings(payload.characteristics ?? payload.caracteristiques),
    remarks: String(payload.remarks ?? payload.remarques ?? "").trim(),
    materials,
    equipment,
    controls: strings(payload.controls ?? payload.controles),
    mistakesToAvoid: strings(payload.mistakesToAvoid ?? payload.erreurs_a_eviter),
    missingInformation: strings(payload.missingInformation ?? payload.informations_manquantes),
    confidence: typeof payload.confidence === "number" ? payload.confidence : 0.7,
    source: "remote",
  };
}

function buildLocalFallback(context: CocoTaskTemplateContext): CocoTaskTemplateResult {
  const subject = `${context.lot ?? ""} ${context.title}`.toLocaleLowerCase("fr");
  const equipment = ["EPI adaptés", "Protections de la zone", "Matériel de mesure et de contrôle"];

  if (/peint|façade|facade|enduit/.test(subject)) {
    equipment.push("Bâches de protection", "Adhésif de masquage", "Brosse et grattoir", "Rouleau adapté au produit");
    if (/façade|facade/.test(subject)) equipment.push("Nettoyeur haute pression");
  } else if (/carrel|faïence|faience/.test(subject)) {
    equipment.push("Malaxeur", "Peigne à colle", "Coupe-carreaux", "Système de nivellement");
  } else if (/plâtr|platr|cloison|doublage/.test(subject)) {
    equipment.push("Laser ou niveau", "Visseuse", "Cutter", "Lève-plaque selon hauteur");
  } else if (/maçon|macon|béton|beton|mortier/.test(subject)) {
    equipment.push("Malaxeur ou bétonnière", "Truelle", "Niveau", "Règle de maçon");
  } else if (/plomb|sanitaire|chauffage/.test(subject)) {
    equipment.push("Clés et pinces adaptées", "Coupe-tube", "Matériel de contrôle d'étanchéité");
  } else if (/élect|elect/.test(subject)) {
    equipment.push("VAT", "Multimètre", "Outillage isolé", "Matériel de repérage");
  }

  const missingInformation: string[] = [];
  if (!context.lot?.trim()) missingInformation.push("Lot métier à préciser");
  if (!context.unit?.trim()) missingInformation.push("Unité d'ouvrage à préciser");
  if (!context.materials?.length) missingInformation.push("Produits ou matériaux à rattacher depuis le catalogue");

  const controls = [
    "Contrôler l'état et la conformité du support avant démarrage",
    "Vérifier les dimensions, niveaux et tolérances applicables",
    "Contrôler l'aspect final et nettoyer la zone avant réception",
  ];
  const mistakesToAvoid = [
    "Démarrer sur un support non préparé ou non conforme",
    "Utiliser un produit sans vérifier sa fiche technique",
    "Masquer un défaut au lieu de le signaler au conducteur de travaux",
  ];
  const details = [
    context.unit ? `Unité d'ouvrage : ${context.unit}` : "",
    context.materials?.length ? `${context.materials.length} matériau(x) rattaché(s)` : "",
    "Préparation du support et protections à valider avant exécution",
  ].filter(Boolean);

  return {
    technicalDescription: context.technicalDescription?.trim()
      || `Préparer puis exécuter « ${context.title.trim()} » selon le support, les plans et les prescriptions des fabricants. Protéger les ouvrages adjacents, respecter les temps de mise en œuvre et réaliser les contrôles avant réception.`,
    characteristics: context.characteristics?.length ? context.characteristics : details,
    remarks: context.remarks?.trim()
      || `Contrôles : ${controls.join(" ; ")}.
Erreurs à éviter : ${mistakesToAvoid.join(" ; ")}.`,
    materials: context.materials ?? [],
    equipment: unique(equipment).map((name) => ({ name, quantity: 1, unit: "u", required: true })),
    controls,
    mistakesToAvoid,
    missingInformation,
    confidence: context.materials?.length ? 0.65 : 0.5,
    source: "local",
  };
}

export async function runCocoOrchestrator({ intent, context }: CocoOrchestratorRequest) {
  try {
    const { data, error } = await supabase.functions.invoke("coco-orchestrator", {
      body: { intent, context },
    });
    if (!error) {
      const normalized = normalizeResult(data);
      if (normalized) return normalized;
    }
  } catch {
    // The local result keeps the preparation workflow usable before the Edge Function is deployed.
  }

  return buildLocalFallback(context);
}

export function generateTaskTemplateWithCoco(context: CocoTaskTemplateContext) {
  return runCocoOrchestrator({ intent: "generate_task_template", context });
}
