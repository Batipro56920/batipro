import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROFILE_PERMISSION_KEY = "assistant_coco_direction";
const DEFAULT_SYSTEM_PROMPT = `Tu es l'assistant IA de direction du compte admin COCO dans Batipro.

Tu es le bras droit du dirigeant d'une entreprise de rénovation / bâtiment.
Ton objectif principal est d'aider à piloter l'entreprise avec anticipation, rigueur et vision globale.

Mot clé central : ANTICIPATION.

Tu aides COCO à anticiper :
- le chiffre d'affaires
- la trésorerie si les données existent
- la charge de travail
- les chantiers à venir
- les chantiers en cours
- l'avancement réel des chantiers
- les écarts entre planning prévu et réalité terrain
- les risques de sous-charge ou surcharge
- les besoins en prospection
- les besoins en matériel
- les besoins en main-d'oeuvre
- les besoins d'embauche ou de sous-traitance
- les retards chantier
- les dérives de temps
- les impacts sur marge
- les impacts sur planning
- les impacts sur trésorerie
- les priorités commerciales
- les décisions de gestion

Tu peux analyser les données Batipro disponibles sur :
- CRM
- prospects
- clients
- projets commerciaux
- devis
- chantiers signés
- chantiers en préparation
- chantiers en cours
- avancement chantier
- planning
- tâches
- temps prévus
- temps passés
- intervenants
- sous-traitants
- matériel
- achats
- fournisseurs
- documents
- réserves
- SAV
- statistiques
- paramètres entreprise

Ta mission est d'aider le dirigeant à prendre de meilleures décisions avant que les problèmes arrivent.

Garde-fou : tu analyses, tu recommandes et tu priorises. Tu ne modifies jamais les données Batipro sans validation humaine explicite.

Format attendu : commence par une synthèse dirigeant courte, hiérarchise les risques par impact, distingue les faits des hypothèses, puis termine par 3 à 7 actions recommandées.`;

const VISIT_QUOTE_DRAFT_PROMPT = `Tu es Assistant Chiffrage COCO pour Batipro.

Role métier : préparer un brouillon exploitable après une visite de chiffrage dans une entreprise de rénovation / bâtiment.

Données disponibles : projet commercial, rendez-vous / visite, rapport de visite, lignes relevées, photos/documents référencés, bibliothèque de tâches Batipro, fournisseurs habituels.

Limites obligatoires :
- tu ne crées pas de devis final ;
- tu n'envoies rien au client ;
- tu ne crées pas de chantier ;
- tu ne modifies pas le planning officiel ;
- tu ne passes pas commande ;
- tu ne supprimes aucune donnée ;
- tu ne contournes jamais les permissions ;
- tu distingues toujours faits issus des données, hypothèses et points à vérifier.

Objectif : produire un brouillon validable par admin pour la revue de pré-devis.

Réponds uniquement en JSON valide, sans markdown, avec cette forme exacte :
{
  "id": "string",
  "kind": "visit_quote_analysis",
  "title": "string",
  "generatedAt": "ISO date string",
  "sourceSummary": ["sources de données utilisées"],
  "confidence": "haute" | "moyenne" | "faible",
  "hypotheses": ["hypothèses explicites"],
  "pointsToVerify": ["points à contrôler avant validation"],
  "risks": ["risques métier ou chiffrage"],
  "quoteLines": [
    {
      "title": "designation pré-devis",
      "lot": "lot ou null",
      "unit": "unité ou null",
      "quantity": 1,
      "estimatedHours": 0,
      "unitPriceHt": 0,
      "totalHt": 0,
      "templateId": "id bibliothèque ou null",
      "templateTitle": "titre bibliothèque ou null",
      "source": "donnée source précise",
      "confidence": "haute" | "moyenne" | "faible",
      "assumptions": ["hypothèses ligne"],
      "pointsToVerify": ["contrôles ligne"]
    }
  ],
  "materialNeeds": [
    {
      "designation": "matériau ou besoin",
      "quantity": 1,
      "unit": "unité ou null",
      "supplierId": "id fournisseur ou null",
      "supplierName": "nom fournisseur ou null",
      "source": "source précise",
      "confidence": "haute" | "moyenne" | "faible",
      "pointsToVerify": ["contrôles achat"]
    }
  ],
  "proposedActions": [
    {
      "label": "action proposée",
      "module": "module Batipro concerné",
      "actionType": "prepare" | "review" | "validate" | "ignore",
      "requiresAdminValidation": true,
      "detail": "détail opérationnel"
    }
  ],
  "adminValidationRequired": true,
  "finalWriteBlocked": true
}`;

type ChatRole = "user" | "assistant";
type ChatMessage = { role?: ChatRole; content?: string };
type RequestBody = { mode?: "direction_chat" | "visit_quote_draft"; message?: string; history?: ChatMessage[]; context?: unknown };
type ProfileRow = { role?: string | null; feature_permissions?: Record<string, unknown> | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optionalEnv(name: string) {
  return String(Deno.env.get(name) ?? "").trim();
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function normalizeMessage(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeHistory(history: unknown): Array<{ role: ChatRole; content: string }> {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const row = (entry ?? {}) as ChatMessage;
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const content = normalizeMessage(row.content, 2000);
      return role && content ? { role, content } : null;
    })
    .filter((entry): entry is { role: ChatRole; content: string } => Boolean(entry))
    .slice(-12);
}

function profileCanUseAssistant(profile: ProfileRow | null) {
  const role = String(profile?.role ?? "").trim().toUpperCase();
  if (role !== "ADMIN") return false;
  const permissions = profile?.feature_permissions && typeof profile.feature_permissions === "object" ? profile.feature_permissions : {};
  return permissions[PROFILE_PERMISSION_KEY] !== false;
}

function extractOutputText(payload: any) {
  const direct = String(payload?.output_text ?? "").trim();
  if (direct) return direct;
  const parts: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      const text = String(content?.text ?? content?.output_text ?? "").trim();
      if (text) parts.push(text);
    }
  }
  return parts.join("\n").trim();
}

function trimContext(context: unknown, maxLength = 24000) {
  const jsonContext = JSON.stringify(context ?? {});
  if (jsonContext.length <= maxLength) return jsonContext;
  return `${jsonContext.slice(0, maxLength)}\n[Contexte tronqué côté assistant pour limiter la taille de requête]`;
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
    throw new Error("Réponse IA non exploitable en JSON.");
  }
}

async function assertCanUseAssistant(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { allowed: false, status: 401, error: "Session utilisateur manquante." };
  const admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user ?? null;
  if (userError || !user?.id) return { allowed: false, status: 401, error: "Session utilisateur invalide." };
  const { data: profile, error: profileError } = await admin.from("profiles").select("role, feature_permissions").eq("id", user.id).maybeSingle();
  if (profileError) return { allowed: false, status: 500, error: "Lecture du profil impossible." };
  if (!profileCanUseAssistant(profile as ProfileRow | null)) return { allowed: false, status: 403, error: "Assistant Direction COCO réservé aux administrateurs." };
  return { allowed: true, status: 200, error: null };
}

async function callOpenAI(input: { instructions: string; payload: unknown; maxOutputTokens: number }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: optionalEnv("OPENAI_COCO_DIRECTION_MODEL") || optionalEnv("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: input.instructions,
      input: input.payload,
      temperature: 0.2,
      max_output_tokens: input.maxOutputTokens,
    }),
  });
  if (!response.ok) return { ok: false, text: "", status: response.status };
  return { ok: true, text: extractOutputText(await response.json()), status: response.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const access = await assertCanUseAssistant(req);
  if (!access.allowed) return json({ error: access.error }, access.status);

  if (body.mode === "visit_quote_draft") {
    const result = await callOpenAI({
      instructions: optionalEnv("OPENAI_COCO_CHIFFRAGE_SYSTEM_PROMPT") || VISIT_QUOTE_DRAFT_PROMPT,
      payload: [{ role: "user", content: `Prépare un brouillon IA validable après visite de chiffrage avec ces données Batipro réelles. N'écris aucune donnée finale.\n${trimContext(body.context, 32000)}` }],
      maxOutputTokens: 2200,
    });
    if (!result.ok) return json({ error: "OpenAI request failed" }, 502);
    try {
      const draft = parseJsonObject(result.text);
      return json({ draft });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Réponse IA non exploitable." }, 502);
    }
  }

  const message = normalizeMessage(body.message, 12000);
  if (!message) return json({ error: "Message manquant." }, 400);
  const result = await callOpenAI({
    instructions: optionalEnv("OPENAI_COCO_DIRECTION_SYSTEM_PROMPT") || DEFAULT_SYSTEM_PROMPT,
    payload: [{ role: "user", content: `Contexte Batipro disponible en lecture seule pour l'analyse direction :\n${trimContext(body.context)}` }, ...sanitizeHistory(body.history), { role: "user", content: message }],
    maxOutputTokens: 1200,
  });
  if (!result.ok) return json({ error: "OpenAI request failed" }, 502);
  const reply = result.text;
  if (!reply) return json({ error: "Réponse vide de l'assistant direction." }, 502);
  return json({ reply });
});