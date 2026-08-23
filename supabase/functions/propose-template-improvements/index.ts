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

function confidence(value: unknown): "high" | "medium" | "low" {
  const raw = text(value);
  return raw === "high" || raw === "medium" || raw === "low" ? raw : "low";
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output ?? []).flatMap((item: any) => item?.content ?? []).map((content: any) => content?.text ?? "").join("\n").trim();
}

function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function normalizeImprovement(raw: any, body: any) {
  return {
    improvement_type: text(raw?.improvementType ?? raw?.improvement_type ?? "other"),
    chantier_id: raw?.chantierId ?? raw?.chantier_id ?? null,
    task_id: raw?.taskId ?? raw?.task_id ?? body?.taskId ?? null,
    task_template_id: raw?.taskTemplateId ?? raw?.task_template_id ?? null,
    product_id: raw?.productId ?? raw?.product_id ?? null,
    lot: raw?.lot ?? null,
    current_value: raw?.currentValue ?? raw?.current_value ?? {},
    proposed_value: raw?.proposedValue ?? raw?.proposed_value ?? {},
    reason: text(raw?.reason ?? raw?.why ?? "Proposition issue des retours terrain."),
    confidence: confidence(raw?.confidence),
    chantier_count: Math.max(1, Number(raw?.chantierCount ?? raw?.chantier_count ?? 1) || 1),
    validation_required: true,
    status: "pending",
    source: { agent: "propose-template-improvements", inputTaskId: body?.taskId ?? null },
  };
}

async function insertImprovements(rows: any[]) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key || rows.length === 0) return [];
  const response = await fetch(`${url}/rest/v1/knowledge_improvements?select=*`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) return [];
  return await response.json();
}

function fallback(body: any) {
  const feedback = Array.isArray(body?.bundle?.feedback) ? body.bundle.feedback : [];
  const proposals = feedback
    .filter((row: any) => Number(row.actualQuantity ?? 0) > 0 && Number(row.plannedQuantity ?? 0) > 0)
    .map((row: any) => normalizeImprovement({
      improvementType: "ratio",
      chantierId: row.chantierId,
      taskId: row.taskId,
      taskTemplateId: row.taskTemplateId,
      productId: row.productId,
      currentValue: { quantity: row.plannedQuantity, unit: row.unit },
      proposedValue: { quantity: row.actualQuantity, unit: row.unit },
      reason: "Quantite reelle differente de la quantite prevue sur le retour terrain.",
      confidence: "medium",
      chantierCount: 1,
    }, body));
  return proposals;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  let rows = fallback(body);
  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (openAiKey) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_FIELD_IMPROVEMENT_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        instructions: [
          "Tu es COCO amelioration continue Batipro.",
          "Compare prevu vs reel et propose uniquement des ameliorations validables.",
          "Ne modifie jamais directement produit, template ou lot.",
          "Types autorises: ratio,time,equipment,consumable,mistake,control,procedure,ppe,doe,pricing,other.",
          "Chaque proposition contient type, produit/template/lot si connu, valeur actuelle, valeur proposee, pourquoi, confiance, nombre de chantiers.",
          "Reponds en JSON: {improvements:[...]}",
        ].join("\n"),
        input: [{ role: "user", content: JSON.stringify(body).slice(0, 90000) }],
        temperature: 0.1,
        max_output_tokens: 4000,
      }),
    });
    if (response.ok) {
      const parsed = parseJson(extractOutputText(await response.json()));
      const improvements = Array.isArray(parsed?.improvements) ? parsed.improvements : [];
      if (improvements.length) rows = improvements.map((item: any) => normalizeImprovement(item, body));
    }
  }

  const inserted = await insertImprovements(rows);
  return json({ improvements: inserted.length ? inserted : rows });
});
