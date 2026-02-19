import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  visite_id?: string | null;
  notes_terrain?: string;
  points_bloquants?: string;
  snapshot?: {
    stats?: {
      avancement_pct?: number;
      tasks_total?: number;
      tasks_retard?: number;
      reserves_ouvertes?: number;
    };
    lots?: Array<{ lot?: string; tasks_total?: number; tasks_retard?: number }>;
  };
  actions?: Array<{ description?: string; statut?: string | null }>;
};

type Decision = {
  action: string;
  responsable: string | null;
  echeance: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const stripped = trimmed.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
    return JSON.parse(stripped);
  }
}

function cleanPoints(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function cleanDecisions(raw: unknown): Decision[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const action = String(row.action ?? "").trim();
      if (!action) return null;
      return {
        action,
        responsable: String(row.responsable ?? "").trim() || null,
        echeance: String(row.echeance ?? "").trim() || null,
      };
    })
    .filter((entry): entry is Decision => Boolean(entry))
    .slice(0, 20);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) {
    return json({ error: "OPENAI_API_KEY missing" }, 503);
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const notes = String(body.notes_terrain ?? "").trim();
  const bloquants = String(body.points_bloquants ?? "").trim();
  const stats = body.snapshot?.stats ?? {};
  const lots = Array.isArray(body.snapshot?.lots) ? body.snapshot?.lots : [];
  const actions = Array.isArray(body.actions) ? body.actions : [];

  const prompt = [
    "You write a concise French construction site visit synthesis.",
    "Return strict JSON only with this shape:",
    '{"resume":"3-6 lines","points_positifs":["..."],"points_bloquants":["..."],"decisions":[{"action":"...","responsable":"...","echeance":"YYYY-MM-DD or null"}]}',
    "No markdown. No extra keys.",
    "Be factual, use only provided data, no invention.",
  ].join("\n");

  const payload = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: JSON.stringify(
          {
            visite_id: body.visite_id ?? null,
            notes_terrain: notes,
            points_bloquants: bloquants,
            stats: {
              avancement_pct: Number(stats.avancement_pct ?? 0),
              tasks_total: Number(stats.tasks_total ?? 0),
              tasks_retard: Number(stats.tasks_retard ?? 0),
              reserves_ouvertes: Number(stats.reserves_ouvertes ?? 0),
            },
            lots: lots.slice(0, 20),
            actions: actions.slice(0, 20),
          },
          null,
          2,
        ),
      },
    ],
  };

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!aiRes.ok) {
    const details = await aiRes.text();
    return json({ error: "OpenAI request failed", details }, 502);
  }

  const completion = await aiRes.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    return json({ error: "Empty AI response" }, 502);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(content);
  } catch (error) {
    return json({ error: "Invalid AI JSON response", details: String(error) }, 422);
  }

  const resume = String(parsed.resume ?? "").trim();
  const pointsPositifs = cleanPoints(parsed.points_positifs, 10);
  const pointsBloquants = cleanPoints(parsed.points_bloquants, 10);
  const decisions = cleanDecisions(parsed.decisions);

  if (!resume) {
    return json({ error: "Missing resume in response" }, 422);
  }

  return json({
    resume,
    points_positifs: pointsPositifs,
    points_bloquants: pointsBloquants,
    decisions,
    synthese: resume,
    points_cles: [...pointsPositifs, ...pointsBloquants].slice(0, 10),
  });
});
