import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function array(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean).slice(0, 80);
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function normalize(raw: any) {
  return {
    preparation: array(raw?.preparation),
    materials: Array.isArray(raw?.materials) ? raw.materials : [],
    equipment: array(raw?.equipment),
    smallEquipment: array(raw?.smallEquipment),
    consumables: array(raw?.consumables),
    ppe: array(raw?.ppe ?? raw?.PPE),
    protections: array(raw?.protections),
    procedure: Array.isArray(raw?.procedure) ? raw.procedure : [],
    qualityControls: Array.isArray(raw?.qualityControls) ? raw.qualityControls : [],
    safety: array(raw?.safety),
    photoRequirements: Array.isArray(raw?.photoRequirements) ? raw.photoRequirements : [],
    doeRequirements: Array.isArray(raw?.doeRequirements) ? raw.doeRequirements : [],
    weatherAlerts: array(raw?.weatherAlerts),
    confidence: ["high", "medium", "low"].includes(text(raw?.confidence)) ? text(raw.confidence) : "low",
    reasoning: text(raw?.reasoning),
  };
}

function instructions() {
  return [
    "Tu es COCO conducteur de travaux Batipro.",
    "Mission: transformer une tache chantier en connaissance terrain executable.",
    "Tu raisonnes depuis Product.knowledge, profil lot, TaskCostEngine, documents et contraintes fournis.",
    "Ne copie jamais les textes commerciaux, adresses, fax, mentions legales, COV, FDES ou copyright.",
    "Ne modifie aucune bibliotheque. Produit uniquement une preparation structuree.",
    "Le mode operatoire est une checklist chronologique. Chaque etape contient objectif, duree estimee, materiel, controle, risques.",
    "Reponds en JSON valide uniquement.",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) {
    return json({
      fieldKnowledge: normalize({
        preparation: [],
        reasoning: "OPENAI_API_KEY absente: generation IA non disponible.",
        confidence: "low",
      }),
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_FIELD_KNOWLEDGE_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: instructions(),
      input: [{ role: "user", content: JSON.stringify(body).slice(0, 90000) }],
      temperature: 0.1,
      max_output_tokens: 5000,
    }),
  });

  if (!response.ok) return json({ error: "OpenAI request failed" }, 502);
  const parsed = parseJson(extractOutputText(await response.json()));
  if (!parsed) return json({ error: "Reponse IA non structuree." }, 502);
  return json({ fieldKnowledge: normalize(parsed) });
});
