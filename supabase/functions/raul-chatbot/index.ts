import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROFILE_PERMISSION_KEY = "chatbot_raul";
const DEFAULT_RAUL_INSTRUCTIONS = [
  "Tu es Raul, assistant Batipro pour une entreprise de rénovation.",
  "Réponds en français, de façon courte, concrète et orientée chantier.",
  "Tu aides les profils autorisés sur l'organisation, les devis, les chantiers, les tâches, les réserves, les documents et le pilotage terrain.",
  "Ne promets pas d'action dans Supabase ou Batipro si l'outil ne te donne pas explicitement accès à cette action.",
  "Si une demande touche aux droits, aux secrets, à la production ou à une décision métier sensible, demande une validation humaine.",
].join("\n");
const DEFAULT_RAUL_WORKER_INSTRUCTIONS = [
  "Tu es Raul, l'assistant Batipro pour les ouvriers sur le terrain.",
  "Réponds en français, très court, simple et concret — pas de jargon informatique, une réponse directement utile sur le chantier.",
  "Tu aides sur : où trouver une info sur sa tâche du jour, comment déclarer un imprévu, du matériel manquant ou un matériau utilisé, comment lire une consigne ou un document du chantier.",
  "Tu n'as pas accès aux données financières, aux marges, ni aux autres chantiers que celui en cours — ne réponds pas à ce sujet, redirige vers le bureau.",
  "Ne promets jamais d'action que tu ne peux pas réellement faire.",
].join("\n");

type ChatRole = "user" | "assistant";
type ChatMessage = {
  role?: ChatRole;
  content?: string;
};

type RequestBody = {
  message?: string;
  history?: ChatMessage[];
  token?: string;
  chantier_id?: string;
};

type ProfileRow = {
  role?: string | null;
  feature_permissions?: Record<string, unknown> | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((entry): entry is { role: ChatRole; content: string } => Boolean(entry))
    .slice(-12);
}

function profileCanUseRaul(profile: ProfileRow | null) {
  const role = String(profile?.role ?? "").trim().toUpperCase();
  const permissions = profile?.feature_permissions && typeof profile.feature_permissions === "object" ? profile.feature_permissions : {};
  if (role === "ADMIN") return permissions[PROFILE_PERMISSION_KEY] !== false;
  return permissions[PROFILE_PERMISSION_KEY] === true;
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

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

async function assertCanUseRaul(req: Request, body: RequestBody) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Chemin bureau : session Supabase réelle + permission chatbot_raul.
  const bearerToken = getBearerToken(req);
  if (bearerToken) {
    const { data: userData } = await admin.auth.getUser(bearerToken);
    const userId = userData.user?.id ?? null;
    if (userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role, feature_permissions")
        .eq("id", userId)
        .maybeSingle();
      if (profileCanUseRaul(profile as ProfileRow | null)) {
        return { allowed: true, status: 200, error: null, scope: "backoffice" as const };
      }
    }
  }

  // Chemin portail ouvrier : jeton chantier_access (ou compte intervenant), scopé à un chantier.
  const portalToken = normalizeString(body.token);
  const chantierId = normalizeString(body.chantier_id);
  if (portalToken && chantierId) {
    const { data: intervenantId, error: accessError } = await admin.rpc("_intervenant_assert_chantier_access", {
      p_token: portalToken,
      p_chantier_id: chantierId,
    });
    if (!accessError && normalizeString(intervenantId)) {
      return { allowed: true, status: 200, error: null, scope: "intervenant" as const };
    }
  }

  return { allowed: false, status: 403, error: "Raul n'est pas actif pour ce profil.", scope: null };
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

  const access = await assertCanUseRaul(req, body);
  if (!access.allowed) return json({ error: access.error }, access.status);

  const message = normalizeMessage(body.message, 4000);
  if (!message) return json({ error: "Message manquant." }, 400);

  const openAiKey = requireEnv("OPENAI_API_KEY");
  const model = optionalEnv("OPENAI_RAUL_MODEL") || optionalEnv("OPENAI_MODEL") || "gpt-4.1-mini";
  const instructions =
    access.scope === "intervenant"
      ? optionalEnv("OPENAI_RAUL_WORKER_SYSTEM_PROMPT") || DEFAULT_RAUL_WORKER_INSTRUCTIONS
      : optionalEnv("OPENAI_RAUL_SYSTEM_PROMPT") || DEFAULT_RAUL_INSTRUCTIONS;
  const history = sanitizeHistory(body.history).filter((entry) => entry.content !== message);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input: [...history, { role: "user", content: message }],
      temperature: 0.3,
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    return json({ error: "OpenAI request failed" }, 502);
  }

  const data = await response.json();
  const reply = extractOutputText(data);
  if (!reply) return json({ error: "Réponse vide de Raul." }, 502);

  return json({ reply });
});
