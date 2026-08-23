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

function fallback(body: any) {
  const feedback = Array.isArray(body?.bundle?.feedback) ? body.bundle.feedback : [];
  const actualTime = feedback.reduce((sum: number, row: any) => sum + Number(row.actualTimeHours ?? 0), 0);
  const actualQuantityRows = feedback.filter((row: any) => row.actualQuantity !== null && row.actualQuantity !== undefined);
  return {
    summary: {
      feedbackCount: feedback.length,
      actualTimeHours: Number.isFinite(actualTime) ? Math.round(actualTime * 100) / 100 : 0,
      actualQuantityCount: actualQuantityRows.length,
      issues: feedback.map((row: any) => text([row.supportProblem, row.weatherConditions, row.difficulty, row.remark].filter(Boolean).join(" - "))).filter(Boolean),
      confidence: feedback.length ? "medium" : "low",
      reasoning: "Synthese locale sans IA.",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) return json(fallback(body));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_FIELD_FEEDBACK_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: [
        "Tu es COCO conducteur de travaux.",
        "Analyse les retours terrain en comparant prevu vs reel.",
        "Distingue faits, hypotheses, risques et actions.",
        "Ne propose aucune modification automatique de bibliotheque.",
        "Reponds en JSON: {summary:{facts:[], variances:[], likelyCauses:[], risks:[], actions:[], confidence:'high|medium|low', reasoning:string}}",
      ].join("\n"),
      input: [{ role: "user", content: JSON.stringify(body).slice(0, 90000) }],
      temperature: 0.1,
      max_output_tokens: 3000,
    }),
  });
  if (!response.ok) return json(fallback(body));
  const parsed = parseJson(extractOutputText(await response.json()));
  return json({ summary: parsed?.summary ?? parsed ?? fallback(body).summary });
});
