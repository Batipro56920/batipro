import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  cleaned_text?: string;
  lots?: string[];
};

type TaskLine = {
  title: string;
  lot: string | null;
  intervenant_name: string | null;
  quantity: number | null;
  unit: string | null;
  date: string | null;
  confidence: number;
  source_line: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonPayload(content: string): unknown {
  const trimmed = String(content ?? "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const stripped = trimmed.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();
    return JSON.parse(stripped);
  }
}

function normalizeUnit(raw: unknown): string | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (["m²", "m2", "m 2", "mq"].includes(value)) return "m2";
  if (["ml", "m", "mètre linéaire", "metre lineaire"].includes(value)) return "ml";
  if (["u", "unité", "unite", "pièce", "piece", "pcs"].includes(value)) return "u";
  if (["h", "heure", "heures"].includes(value)) return "h";
  if (["forfait", "ens", "ensemble"].includes(value)) return "forfait";
  return value;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function confidence(value: unknown): number {
  const n = toNumber(value);
  if (n === null) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function isDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function isNoiseTitle(title: string): boolean {
  const t = title.toLowerCase();
  return [
    "total",
    "sous-total",
    "tva",
    "ttc",
    "conditions",
    "validité",
    "validite",
    "adresse",
    "client",
    "devis",
    "référence",
    "reference",
    "page",
  ].some((bad) => t.includes(bad));
}

function validateLine(raw: any, lots: string[]): TaskLine | null {
  const title = String(raw?.title ?? "").replace(/\s+/g, " ").trim();
  if (!title || title.length < 3) return null;
  if (isNoiseTitle(title)) return null;

  const lotRaw = String(raw?.lot ?? "").trim();
  const lot = lotRaw && lots.some((allowed) => allowed.toLowerCase() === lotRaw.toLowerCase()) ? lotRaw : null;

  const sourceLine = String(raw?.source_line ?? raw?.sourceLine ?? title).trim();
  const intervenantName = String(raw?.intervenant_name ?? raw?.intervenantName ?? "").trim() || null;

  return {
    title,
    lot,
    intervenant_name: intervenantName,
    quantity: toNumber(raw?.quantity),
    unit: normalizeUnit(raw?.unit),
    date: isDate(raw?.date),
    confidence: confidence(raw?.confidence),
    source_line: sourceLine || title,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const cleanedText = String(body.cleaned_text ?? "").trim();
  if (!cleanedText || cleanedText.length < 20) {
    return json({ ok: false, error: "cleaned_text vide ou trop court." }, 400);
  }

  const lots = Array.isArray(body.lots) && body.lots.length ? body.lots.map((lot) => String(lot)) : [
    "Démolition",
    "Maçonnerie",
    "Plâtrerie/Isolation",
    "Menuiserie intérieure",
    "Menuiserie extérieure",
    "Électricité",
    "Plomberie",
    "Chauffage/Ventilation",
    "Peinture",
    "Sols",
    "Façade/Toiture",
    "Divers",
  ];

  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAiKey) {
    return json({ ok: false, error: "OPENAI_API_KEY manquante." }, 500);
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const prompt = [
    "Tu extrais des lignes de travaux depuis un devis BTP.",
    "Tu dois ignorer strictement: entêtes, adresses, client, références, titres de sections/sous-sections, sous-totaux, totaux, TVA, remises, conditions, numéros de page.",
    "Ne conserver que les vraies lignes de travaux exécutables.",
    `lot doit être parmi: ${lots.join(", ")} ou null si incertain.`,
    "unit standard: m2, ml, u, h, forfait ou null.",
    "confidence entre 0 et 1.",
    "Réponds en JSON strict uniquement avec ce format: {\"tasks\": TaskLine[]}.",
    "TaskLine = {title, lot, intervenant_name, quantity, unit, date, confidence, source_line}.",
  ].join("\n");

  const payload = {
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: cleanedText.slice(0, 120000) },
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
    return json({ ok: false, error: "OpenAI request failed", details }, 502);
  }

  const completion = await aiRes.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    return json({ ok: false, error: "Réponse IA vide." }, 502);
  }

  let parsed: any;
  try {
    parsed = parseJsonPayload(content);
  } catch (error) {
    return json({ ok: false, error: "Réponse IA non JSON.", details: String(error) }, 422);
  }

  const rawTasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
  if (!Array.isArray(rawTasks)) {
    return json({ ok: false, error: "Format JSON invalide (tasks[] attendu)." }, 422);
  }

  const tasks = rawTasks.map((task: any) => validateLine(task, lots)).filter(Boolean) as TaskLine[];
  return json({ ok: true, tasks });
});

