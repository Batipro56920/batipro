import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Result = {
  materials: string[];
  equipment: string[];
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
  costSummary: {
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
  confidence: "high" | "medium" | "low";
  missingInformation: string[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean).slice(0, 40);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function confidence(value: unknown): Result["confidence"] {
  const normalized = text(value).toLowerCase();
  if (normalized === "high" || normalized === "haute") return "high";
  if (normalized === "medium" || normalized === "moyenne") return "medium";
  return "low";
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") chunks.push(content.text);
      if (content?.type === "text" && typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseJsonPayload(content: string): unknown {
  const trimmed = text(content);
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

function normalizeCostSummary(value: unknown): Result["costSummary"] {
  if (Array.isArray(value)) {
    return {
      materialCostHt: null,
      materialSaleHt: null,
      laborCostHt: null,
      laborSaleHt: null,
      equipmentCostHt: null,
      equipmentSaleHt: null,
      feeCostHt: null,
      feeSaleHt: null,
      totalCostHt: null,
      salePriceHt: null,
      marginHt: null,
      marginRate: null,
      estimatedTimeHours: null,
      humanTimeHours: null,
      teamTimeHours: null,
      dailyCostHt: null,
      profitabilityRate: null,
      lines: stringArray(value),
    };
  }
  const raw = value as Record<string, unknown> | null;
  return {
    materialCostHt: nullableNumber(raw?.materialCostHt ?? raw?.materialCost),
    materialSaleHt: nullableNumber(raw?.materialSaleHt ?? raw?.materialSale),
    laborCostHt: nullableNumber(raw?.laborCostHt ?? raw?.laborCost),
    laborSaleHt: nullableNumber(raw?.laborSaleHt ?? raw?.laborSale),
    equipmentCostHt: nullableNumber(raw?.equipmentCostHt ?? raw?.equipmentCost),
    equipmentSaleHt: nullableNumber(raw?.equipmentSaleHt ?? raw?.equipmentSale),
    feeCostHt: nullableNumber(raw?.feeCostHt ?? raw?.feeCost),
    feeSaleHt: nullableNumber(raw?.feeSaleHt ?? raw?.feeSale),
    totalCostHt: nullableNumber(raw?.totalCostHt ?? raw?.totalCost),
    salePriceHt: nullableNumber(raw?.salePriceHt ?? raw?.salePrice),
    marginHt: nullableNumber(raw?.marginHt ?? raw?.margin),
    marginRate: nullableNumber(raw?.marginRate),
    estimatedTimeHours: nullableNumber(raw?.estimatedTimeHours),
    humanTimeHours: nullableNumber(raw?.humanTimeHours),
    teamTimeHours: nullableNumber(raw?.teamTimeHours),
    dailyCostHt: nullableNumber(raw?.dailyCostHt ?? raw?.dailyCost),
    profitabilityRate: nullableNumber(raw?.profitabilityRate),
    lines: stringArray(raw?.lines),
  };
}

function normalizeResult(raw: any): Result {
  return {
    materials: stringArray(raw?.materials),
    equipment: stringArray(raw?.equipment),
    consumables: stringArray(raw?.consumables),
    ppe: stringArray(raw?.ppe ?? raw?.PPE),
    procedure: stringArray(raw?.procedure),
    controls: stringArray(raw?.controls),
    errorsToAvoid: stringArray(raw?.errorsToAvoid),
    safetyPoints: stringArray(raw?.safetyPoints),
    doePhotos: stringArray(raw?.doePhotos),
    doeDocuments: stringArray(raw?.doeDocuments),
    technicalDescription: text(raw?.technicalDescription),
    characteristics: stringArray(raw?.characteristics),
    fieldReturns: stringArray(raw?.fieldReturns),
    fieldReturnQuestions: stringArray(raw?.fieldReturnQuestions),
    costSummary: normalizeCostSummary(raw?.costSummary),
    confidence: confidence(raw?.confidence),
    missingInformation: stringArray(raw?.missingInformation),
  };
}

function buildPrompt() {
  return [
    "Tu es COCO, assistant technique Batipro pour construire un template de tache BTP exploitable terrain.",
    "",
    "Objectif: a partir des donnees reelles du drawer et des produits catalogue lies, produire un brouillon technique structure pour 1 unite d'ouvrage.",
    "",
    "Ordre de raisonnement obligatoire:",
    "1. designation, unite, lot et usage metier;",
    "2. materiaux lies aux produits catalogue, connaissance IA produit, ratios, prix, fournisseur et notes;",
    "3. main d'oeuvre;",
    "4. materiel, outillage et frais;",
    "5. generation du contenu terrain.",
    "",
    "Regles strictes:",
    "- Ne pas inventer de produit, prix, fournisseur, document ou ratio absent du contexte.",
    "- Le produit catalogue est la source unique de verite: utiliser product.knowledge quand il existe, sans relire ni extrapoler les documents.",
    "- Si un ratio produit existe dans product.knowledge.materialUsage ou dans la ligne materiau, l'utiliser explicitement.",
    "- Le calcul ouvrage vient du TaskCostEngine transmis dans costSummary: ne pas recalculer autrement, seulement expliquer/structurer.",
    "- Pour PANTIFILM OS MAT ou un produit peinture similaire, exploiter les ratios L/m2 fournis et proposer des outils plausibles: protections, rouleau adapte, brosse/rechampir, pistolet/buse si coherent, nettoyage/preparation support si le lot le justifie.",
    "- Exclure les mentions legales, adresses, fax, sites web, COV, FDES, textes reglementaires et informations sans utilite terrain.",
    "- Distinguer les informations manquantes au lieu d'inventer.",
    "- Le mode operatoire doit etre chronologique, numerote et exploitable chantier.",
    "- Chaque etape du mode operatoire doit indiquer objectif, materiel, duree, controle et risque quand disponible.",
    "- Produire les photos attendues pour le DOE, les documents DOE et les questions de retour terrain.",
    "- Repondre uniquement en JSON valide, sans markdown.",
    "",
    "Format exact:",
    "{",
    '  "materials": ["liste materiaux pour 1 unite"],',
    '  "equipment": ["materiel/outillage utile"],',
    '  "consumables": ["consommables et protections"],',
    '  "ppe": ["EPI"],',
    '  "procedure": ["mode operatoire terrain complet, par etapes"],',
    '  "controls": ["controles qualite"],',
    '  "errorsToAvoid": ["erreurs a eviter"],',
    '  "safetyPoints": ["points securite"],',
    '  "doePhotos": ["photos attendues DOE"],',
    '  "doeDocuments": ["documents DOE"],',
    '  "technicalDescription": "description technique concise",',
    '  "characteristics": ["caracteristiques enregistrables"],',
    '  "fieldReturns": ["retours terrain a alimenter"],',
    '  "fieldReturnQuestions": ["questions a poser au terrain apres chantier"],',
    '  "costSummary": {"materialCostHt": number|null, "materialSaleHt": number|null, "laborCostHt": number|null, "laborSaleHt": number|null, "equipmentCostHt": number|null, "equipmentSaleHt": number|null, "feeCostHt": number|null, "feeSaleHt": number|null, "totalCostHt": number|null, "salePriceHt": number|null, "marginHt": number|null, "marginRate": number|null, "estimatedTimeHours": number|null, "humanTimeHours": number|null, "teamTimeHours": number|null, "dailyCostHt": number|null, "profitabilityRate": number|null, "lines": ["resume couts"]},',
    '  "confidence": "high|medium|low",',
    '  "missingInformation": ["informations manquantes"]',
    "}",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) return json({ error: "OPENAI_API_KEY manquante." }, 500);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TASK_TEMPLATE_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: buildPrompt(),
      input: [{
        role: "user",
        content: JSON.stringify(body).slice(0, 60000),
      }],
      temperature: 0.1,
      max_output_tokens: 3500,
    }),
  });

  if (!response.ok) {
    return json({ error: "OpenAI request failed" }, 502);
  }

  const parsed = parseJsonPayload(extractOutputText(await response.json()));
  if (!parsed) return json({ error: "Reponse IA non structuree." }, 502);

  return json({ result: normalizeResult(parsed) });
});
