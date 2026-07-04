import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Tu es Coco, assistant métier Batipro.
Tu ne copies pas les documents : tu raisonnes comme un conducteur de travaux.
Tu reçois lot, désignation, unité, produits liés, notes techniques, main d'oeuvre, frais et matériel saisi.
Tu dois créer un template chantier pour 1 unité de production : matériaux, matériel, mode opératoire, contrôles, erreurs à éviter, description, retours terrain.
Supprime les mentions légales, coordonnées, adresses, fax, sites web, COV, FDES et certifications non utiles terrain.
Retourne uniquement un JSON avec les clés materials, equipment, procedure, controls, errorsToAvoid, technicalDescription, characteristics, fieldReturns, costSummary, confidence, missingInformation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    const endpoint = Deno.env.get("COCO_LLM_ENDPOINT");
    if (!endpoint) return jsonResponse({ error: "COCO_LLM_ENDPOINT is not configured" }, 500);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM_PROMPT, input: payload, format: "json" }),
    });

    if (!response.ok) return jsonResponse({ error: "Coco generation failed", detail: await response.text() }, response.status);

    const data = await response.json();
    const result = normalizeResult(data.result ?? data);
    return jsonResponse({ result });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeResult(value: Record<string, unknown>) {
  return {
    materials: Array.isArray(value.materials) ? value.materials : [],
    equipment: Array.isArray(value.equipment) ? value.equipment : [],
    procedure: stringArray(value.procedure),
    controls: stringArray(value.controls),
    errorsToAvoid: stringArray(value.errorsToAvoid),
    technicalDescription: typeof value.technicalDescription === "string" ? value.technicalDescription : "",
    characteristics: stringArray(value.characteristics),
    fieldReturns: stringArray(value.fieldReturns),
    costSummary: typeof value.costSummary === "object" && value.costSummary !== null ? value.costSummary : {},
    confidence: typeof value.confidence === "string" ? value.confidence : "low",
    missingInformation: stringArray(value.missingInformation),
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}
