import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COCO_NAME_PATTERN = /(^|[\s._-])coco($|[\s._-])/i;
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

Tu dois notamment répondre à ces questions :
- Est-ce qu'on a assez de travail dans les semaines/mois à venir ?
- Est-ce qu'on doit relancer la prospection ?
- Quels devis doivent être relancés en priorité ?
- Quels chantiers risquent de prendre du retard ?
- Quels chantiers sont déjà en retard ?
- Quels chantiers avancent moins vite que prévu ?
- Quelles tâches bloquent l'avancement ?
- Quels chantiers risquent de coûter plus cher que prévu ?
- Quel retard risque d'impacter les chantiers suivants ?
- Faut-il replanifier ?
- Faut-il relancer un fournisseur ?
- Faut-il renforcer l'équipe, embaucher ou sous-traiter ?

Garde-fou : tu analyses, tu recommandes et tu priorises. Tu ne modifies jamais les données Batipro sans validation humaine explicite.

Format attendu : commence par une synthèse dirigeant courte, hiérarchise les risques par impact, distingue les faits des hypothèses, puis termine par 3 à 7 actions recommandées.`;

type ChatRole = "user" | "assistant";
type ChatMessage = { role?: ChatRole; content?: string };
type RequestBody = { message?: string; history?: ChatMessage[]; context?: unknown };
type ProfileRow = { role?: string | null; display_name?: string | null; feature_permissions?: Record<string, unknown> | null };

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

function allowedCocoEmails(): Set<string> {
  return new Set(optionalEnv("COCO_ADMIN_EMAILS").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function profileCanUseAssistant(profile: ProfileRow | null, email: string | null) {
  const role = String(profile?.role ?? "").trim().toUpperCase();
  if (role !== "ADMIN") return false;
  const permissions = profile?.feature_permissions && typeof profile.feature_permissions === "object" ? profile.feature_permissions : {};
  if (permissions[PROFILE_PERMISSION_KEY] === false) return false;
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const displayName = String(profile?.display_name ?? "").trim().toLowerCase();
  const emails = allowedCocoEmails();
  if (normalizedEmail && emails.has(normalizedEmail)) return true;
  return COCO_NAME_PATTERN.test(displayName) || COCO_NAME_PATTERN.test(normalizedEmail);
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

function trimContext(context: unknown) {
  const jsonContext = JSON.stringify(context ?? {});
  if (jsonContext.length <= 24000) return jsonContext;
  return `${jsonContext.slice(0, 24000)}\n[Contexte tronqué côté assistant pour limiter la taille de requête]`;
}

async function assertCanUseAssistant(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { allowed: false, status: 401, error: "Session utilisateur manquante." };
  const admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user ?? null;
  if (userError || !user?.id) return { allowed: false, status: 401, error: "Session utilisateur invalide." };
  const { data: profile, error: profileError } = await admin.from("profiles").select("role, display_name, feature_permissions").eq("id", user.id).maybeSingle();
  if (profileError) return { allowed: false, status: 500, error: "Lecture du profil impossible." };
  if (!profileCanUseAssistant(profile as ProfileRow | null, user.email ?? null)) return { allowed: false, status: 403, error: "Assistant Direction COCO réservé au compte admin COCO." };
  return { allowed: true, status: 200, error: null };
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
  const message = normalizeMessage(body.message, 4000);
  if (!message) return json({ error: "Message manquant." }, 400);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: optionalEnv("OPENAI_COCO_DIRECTION_MODEL") || optionalEnv("OPENAI_MODEL") || "gpt-4.1-mini",
      instructions: optionalEnv("OPENAI_COCO_DIRECTION_SYSTEM_PROMPT") || DEFAULT_SYSTEM_PROMPT,
      input: [{ role: "user", content: `Contexte Batipro disponible en lecture seule pour l'analyse direction :\n${trimContext(body.context)}` }, ...sanitizeHistory(body.history), { role: "user", content: message }],
      temperature: 0.25,
      max_output_tokens: 1200,
    }),
  });
  if (!response.ok) return json({ error: "OpenAI request failed" }, 502);
  const reply = extractOutputText(await response.json());
  if (!reply) return json({ error: "Réponse vide de l'assistant direction." }, 502);
  return json({ reply });
});
