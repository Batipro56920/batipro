import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown): string | null {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function confidence(value: unknown): "high" | "medium" | "low" {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CONFIDENCE_VALUES.has(normalized) ? normalized as "high" | "medium" | "low" : "low";
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter((item): item is string => Boolean(item)).slice(0, 40);
}

function block(raw: any, value: unknown, fallbackSource: string | null) {
  return {
    value,
    confidence: confidence(raw?.confidence),
    reasoning: text(raw?.reasoning) ?? "",
    sourceDocument: text(raw?.sourceDocument) ?? fallbackSource,
  };
}

function bool(value: unknown) {
  return value === true;
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

function parseJsonObject(content: string): any | null {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeKnowledge(raw: any) {
  const sourceDocument = text(raw?.sourceDocument);
  return {
    identity: block(raw?.identity, {
      designation: text(raw?.identity?.value?.designation ?? raw?.identity?.designation),
      brand: text(raw?.identity?.value?.brand ?? raw?.identity?.brand),
      manufacturer: text(raw?.identity?.value?.manufacturer ?? raw?.identity?.manufacturer),
      manufacturerReference: text(raw?.identity?.value?.manufacturerReference ?? raw?.identity?.manufacturerReference),
      ean: text(raw?.identity?.value?.ean ?? raw?.identity?.ean),
      conditionnement: text(raw?.identity?.value?.conditionnement ?? raw?.identity?.conditionnement),
      unit: text(raw?.identity?.value?.unit ?? raw?.identity?.unit),
    }, sourceDocument),
    supplier: block(raw?.supplier, {
      supplier: text(raw?.supplier?.value?.supplier ?? raw?.supplier?.supplier),
      supplierReference: text(raw?.supplier?.value?.supplierReference ?? raw?.supplier?.supplierReference),
      supplierProductCode: text(raw?.supplier?.value?.supplierProductCode ?? raw?.supplier?.supplierProductCode),
    }, sourceDocument),
    pricing: block(raw?.pricing, {
      purchasePrice: number(raw?.pricing?.value?.purchasePrice ?? raw?.pricing?.purchasePrice),
      recommendedSalePrice: number(raw?.pricing?.value?.recommendedSalePrice ?? raw?.pricing?.recommendedSalePrice),
      currency: text(raw?.pricing?.value?.currency ?? raw?.pricing?.currency) ?? "EUR",
      vat: number(raw?.pricing?.value?.vat ?? raw?.pricing?.vat),
    }, sourceDocument),
    materialUsage: block(raw?.materialUsage, {
      ratioQuantity: number(raw?.materialUsage?.value?.ratioQuantity ?? raw?.materialUsage?.ratioQuantity),
      ratioUnit: text(raw?.materialUsage?.value?.ratioUnit ?? raw?.materialUsage?.ratioUnit),
      sourceUnit: text(raw?.materialUsage?.value?.sourceUnit ?? raw?.materialUsage?.sourceUnit),
      lossPercent: number(raw?.materialUsage?.value?.lossPercent ?? raw?.materialUsage?.lossPercent),
      minimumOrder: number(raw?.materialUsage?.value?.minimumOrder ?? raw?.materialUsage?.minimumOrder),
      coverage: number(raw?.materialUsage?.value?.coverage ?? raw?.materialUsage?.coverage),
    }, sourceDocument),
    application: block(raw?.application, {
      interior: bool(raw?.application?.value?.interior ?? raw?.application?.interior),
      exterior: bool(raw?.application?.value?.exterior ?? raw?.application?.exterior),
      wall: bool(raw?.application?.value?.wall ?? raw?.application?.wall),
      floor: bool(raw?.application?.value?.floor ?? raw?.application?.floor),
      ceiling: bool(raw?.application?.value?.ceiling ?? raw?.application?.ceiling),
      wood: bool(raw?.application?.value?.wood ?? raw?.application?.wood),
      metal: bool(raw?.application?.value?.metal ?? raw?.application?.metal),
      placo: bool(raw?.application?.value?.placo ?? raw?.application?.placo),
      concrete: bool(raw?.application?.value?.concrete ?? raw?.application?.concrete),
      facade: bool(raw?.application?.value?.facade ?? raw?.application?.facade),
    }, sourceDocument),
    supports: block(raw?.supports, strings(raw?.supports?.value ?? raw?.supports), sourceDocument),
    forbiddenSupports: block(raw?.forbiddenSupports, strings(raw?.forbiddenSupports?.value ?? raw?.forbiddenSupports), sourceDocument),
    tools: block(raw?.tools, strings(raw?.tools?.value ?? raw?.tools), sourceDocument),
    consumables: block(raw?.consumables, strings(raw?.consumables?.value ?? raw?.consumables), sourceDocument),
    PPE: block(raw?.PPE, strings(raw?.PPE?.value ?? raw?.PPE), sourceDocument),
    weatherLimits: block(raw?.weatherLimits, {
      minTemperature: number(raw?.weatherLimits?.value?.minTemperature ?? raw?.weatherLimits?.minTemperature),
      maxTemperature: number(raw?.weatherLimits?.value?.maxTemperature ?? raw?.weatherLimits?.maxTemperature),
      humidity: text(raw?.weatherLimits?.value?.humidity ?? raw?.weatherLimits?.humidity),
      frost: text(raw?.weatherLimits?.value?.frost ?? raw?.weatherLimits?.frost),
      rain: text(raw?.weatherLimits?.value?.rain ?? raw?.weatherLimits?.rain),
      wind: text(raw?.weatherLimits?.value?.wind ?? raw?.weatherLimits?.wind),
      sun: text(raw?.weatherLimits?.value?.sun ?? raw?.weatherLimits?.sun),
    }, sourceDocument),
    dryingTimes: block(raw?.dryingTimes, strings(raw?.dryingTimes?.value ?? raw?.dryingTimes), sourceDocument),
    procedure: block(raw?.procedure, strings(raw?.procedure?.value ?? raw?.procedure), sourceDocument),
    controls: block(raw?.controls, strings(raw?.controls?.value ?? raw?.controls), sourceDocument),
    commonMistakes: block(raw?.commonMistakes, strings(raw?.commonMistakes?.value ?? raw?.commonMistakes), sourceDocument),
    doe: block(raw?.doe, strings(raw?.doe?.value ?? raw?.doe), sourceDocument),
    fieldExperience: block(raw?.fieldExperience, strings(raw?.fieldExperience?.value ?? raw?.fieldExperience), sourceDocument),
    confidence: block(raw?.confidence, {
      global: confidence(raw?.confidence?.value?.global ?? raw?.confidence?.global),
      missingInformation: strings(raw?.confidence?.value?.missingInformation ?? raw?.confidence?.missingInformation),
    }, sourceDocument),
  };
}

function buildInstructions() {
  return [
    "Tu es COCO Lecteur Produit pour Batipro.",
    "Mission: transformer des documents fournisseur en connaissance produit structurée persistante.",
    "Ce n'est pas un OCR et pas un résumé. Tu dois extraire uniquement les connaissances utiles aux modules métier Batipro.",
    "",
    "Tu dois répondre à: fabricant, vendeur, prix achat, prix conseillé, unité, ratio numérique, unité du ratio, supports, outils, EPI, limites météo, erreurs, mode opératoire, DOE.",
    "",
    "Interdictions: ne copie pas adresses, téléphone, fax, mail, mentions légales, COV, FDES, certifications, copyright, sites web, sauf utilité métier directe.",
    "Le fournisseur ne doit jamais devenir CB RENOVATION si ce nom vient du client, de l'entreprise utilisatrice ou d'une adresse de devis.",
    "Le ratio doit être numérique quand il est présent ou déductible. Sinon null avec reasoning.",
    "Le mode opératoire doit être une liste chronologique d'actions terrain, pas un paragraphe.",
    "Les outils doivent être exploitables terrain.",
    "fieldExperience reste vide aujourd'hui.",
    "Chaque bloc doit porter confidence, reasoning, sourceDocument.",
    "",
    "Réponds uniquement en JSON valide avec la forme:",
    "{",
    ' "knowledge": {',
    '  "identity": {"value": {"designation": string|null, "brand": string|null, "manufacturer": string|null, "manufacturerReference": string|null, "ean": string|null, "conditionnement": string|null, "unit": string|null}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "supplier": {"value": {"supplier": string|null, "supplierReference": string|null, "supplierProductCode": string|null}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "pricing": {"value": {"purchasePrice": number|null, "recommendedSalePrice": number|null, "currency": string|null, "vat": number|null}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "materialUsage": {"value": {"ratioQuantity": number|null, "ratioUnit": string|null, "sourceUnit": string|null, "lossPercent": number|null, "minimumOrder": number|null, "coverage": number|null}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "application": {"value": {"interior": boolean, "exterior": boolean, "wall": boolean, "floor": boolean, "ceiling": boolean, "wood": boolean, "metal": boolean, "placo": boolean, "concrete": boolean, "facade": boolean}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "supports": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "forbiddenSupports": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "tools": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "consumables": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "PPE": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "weatherLimits": {"value": {"minTemperature": number|null, "maxTemperature": number|null, "humidity": string|null, "frost": string|null, "rain": string|null, "wind": string|null, "sun": string|null}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "dryingTimes": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "procedure": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "controls": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "commonMistakes": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "doe": {"value": string[], "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null},',
    '  "fieldExperience": {"value": [], "confidence": "low", "reasoning": "Alimente plus tard par retours terrain", "sourceDocument": null},',
    '  "confidence": {"value": {"global": "high|medium|low", "missingInformation": string[]}, "confidence": "high|medium|low", "reasoning": string, "sourceDocument": string|null}',
    " }",
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
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_PRODUCT_READER_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: buildInstructions(),
      input: [{ role: "user", content: JSON.stringify(body).slice(0, 70000) }],
      temperature: 0.05,
      max_output_tokens: 5000,
    }),
  });

  if (!response.ok) return json({ error: "OpenAI request failed" }, 502);
  const parsed = parseJsonObject(extractOutputText(await response.json()));
  if (!parsed?.knowledge) return json({ error: "Réponse IA non structurée." }, 502);
  return json({ knowledge: normalizeKnowledge(parsed.knowledge) });
});
