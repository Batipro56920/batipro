import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROFILE_PERMISSION_KEY = "chatbot_raul";
const AUTH_SESSION_PORTAL_TOKEN = "__AUTH_SESSION__";

const DEFAULT_RAUL_INSTRUCTIONS = [
  "Tu es Raul, assistant Batipro pour une entreprise de rénovation.",
  "Réponds en français, de façon courte, concrète et orientée chantier.",
  "Tu aides les profils autorisés sur l'organisation, les devis, les chantiers, les tâches, les réserves, les documents et le pilotage terrain.",
  "Tu peux analyser les photos et fichiers joints au message lorsqu'ils sont fournis.",
  "Quand une photo est jointe, base tes conseils sur ce que tu vois réellement et signale ce qui n'est pas certain.",
  "Ne promets pas d'action dans Supabase ou Batipro si l'outil ne te donne pas explicitement accès à cette action.",
  "Si une demande touche aux droits, aux secrets, à la production ou à une décision métier sensible, demande une validation humaine.",
].join("\n");

const DEFAULT_RAUL_WORKER_INSTRUCTIONS = [
  "Tu es Raul, l'assistant Batipro pour les ouvriers sur le terrain.",
  "Réponds en français, très court, simple et concret — pas de jargon informatique, une réponse directement utile sur le chantier.",
  "Tu aides sur : où trouver une info sur sa tâche du jour, comment déclarer un imprévu, du matériel manquant ou un matériau utilisé, comment lire une consigne, une photo ou un document du chantier.",
  "Quand une photo est jointe, base ta réponse sur ce que tu vois réellement et dis clairement ce qui reste incertain.",
  "Tu n'as pas accès aux données financières, aux marges, ni aux autres chantiers que celui en cours — ne réponds pas à ce sujet, redirige vers le bureau.",
  "Ne promets jamais d'action que tu ne peux pas réellement faire.",
].join("\n");

const TECH_SHEET_INSTRUCTIONS = [
  "La demande nécessite un livrable visuel.",
  "Tu DOIS utiliser l'outil image_generation pour produire une fiche technique illustrée en français.",
  "Conçois une fiche chantier professionnelle, lisible sur téléphone et imprimable : grand titre, vue d'ensemble ou schéma principal, flèches et annotations, matériel nécessaire, étapes ou détails de mise en œuvre, points de vigilance et sécurité.",
  "Si une photo chantier est fournie, utilise-la comme référence visuelle pour que la fiche corresponde à la situation réelle, sans inventer des éléments absents.",
  "N'invente jamais de norme, de cote, de charge, de dimension ou de valeur technique non fournie ou non certaine. Si une valeur manque, reste générique ou indique qu'elle doit être vérifiée.",
  "Privilégie une mise en page paysage 3:2, claire, sobre et professionnelle, avec du texte français correctement orthographié.",
  "Après l'image, ajoute seulement une courte phrase indiquant que la fiche est prête et, si nécessaire, une réserve technique importante.",
].join("\n");

type ChatRole = "user" | "assistant";
type ChatMessage = { role?: ChatRole; content?: string };
type RaulAttachment = { name?: string; mime_type?: string; data_url?: string };
type RequestBody = {
  message?: string;
  history?: ChatMessage[];
  attachments?: RaulAttachment[];
  token?: string;
  chantier_id?: string;
};
type ProfileRow = { role?: string | null; feature_permissions?: Record<string, unknown> | null };

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
  return header.slice(7).trim() || null;
}

function normalizeMessage(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
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

function sanitizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 3)
    .map((raw) => {
      const item = (raw ?? {}) as RaulAttachment;
      const name = normalizeMessage(item.name, 180) || "piece-jointe";
      const mimeType = normalizeString(item.mime_type).toLowerCase();
      const dataUrl = normalizeString(item.data_url);
      if (!dataUrl.startsWith("data:") || dataUrl.length > 12_000_000) return null;
      const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
      if (!match) return null;
      const actualMime = match[1].toLowerCase();
      if (mimeType && actualMime !== mimeType) return null;
      return { name, mimeType: actualMime, dataUrl };
    })
    .filter((item): item is { name: string; mimeType: string; dataUrl: string } => Boolean(item));
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

function extractGeneratedImage(payload: any) {
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type === "image_generation_call" && typeof item?.result === "string" && item.result.length > 100) {
      return `data:image/jpeg;base64,${item.result}`;
    }
  }
  return null;
}

function wantsVisualTechnicalSheet(message: string) {
  if (/\b(sans image|texte seulement|pas d['’]?image)\b/i.test(message)) return false;
  if (/\b(fiche technique|fiche chantier|fiche illustr[eé]e|infographie)\b/i.test(message)) return true;
  const visualNoun = /\b(sch[eé]ma|image|visuel|illustration|dessin)\b/i.test(message);
  const creationVerb = /\b(fais|faire|cr[eé]e|cr[eé]er|g[eé]n[eè]re|g[eé]n[eé]rer|produis|produire|fabrique|dessine)\b/i.test(message);
  return visualNoun && creationVerb;
}

async function assertCanUseRaul(req: Request, body: RequestBody) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bearerToken = getBearerToken(req);
  const chantierId = normalizeString(body.chantier_id);
  const portalToken = normalizeString(body.token);

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

      if (chantierId && (!portalToken || portalToken === AUTH_SESSION_PORTAL_TOKEN)) {
        const userClient = createClient(supabaseUrl, serviceRoleKey, {
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: intervenantId, error: accessError } = await userClient.rpc(
          "_intervenant_assert_chantier_access",
          { p_token: null, p_chantier_id: chantierId },
        );
        if (!accessError && normalizeString(intervenantId)) {
          return { allowed: true, status: 200, error: null, scope: "intervenant" as const };
        }
        if (accessError) console.error("Raul authenticated worker access denied", accessError.message);
      }
    }
  }

  if (portalToken && portalToken !== AUTH_SESSION_PORTAL_TOKEN && chantierId) {
    const { data: intervenantId, error: accessError } = await admin.rpc(
      "_intervenant_assert_chantier_access",
      { p_token: portalToken, p_chantier_id: chantierId },
    );
    if (!accessError && normalizeString(intervenantId)) {
      return { allowed: true, status: 200, error: null, scope: "intervenant" as const };
    }
    if (accessError) console.error("Raul token worker access denied", accessError.message);
  }

  return { allowed: false, status: 403, error: "Raul n'est pas actif pour ce profil ou ce chantier.", scope: null };
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
  const attachments = sanitizeAttachments(body.attachments);
  if (!message && attachments.length === 0) return json({ error: "Message manquant." }, 400);

  const history = sanitizeHistory(body.history).filter((entry) => entry.content !== message);
  const userContent: any[] = [{ type: "input_text", text: message || "Analyse la pièce jointe." }];

  for (const attachment of attachments) {
    if (attachment.mimeType.startsWith("image/")) {
      userContent.push({ type: "input_image", image_url: attachment.dataUrl, detail: "high" });
    } else {
      userContent.push({ type: "input_file", filename: attachment.name, file_data: attachment.dataUrl });
    }
  }

  const baseInstructions =
    access.scope === "intervenant"
      ? optionalEnv("OPENAI_RAUL_WORKER_SYSTEM_PROMPT") || DEFAULT_RAUL_WORKER_INSTRUCTIONS
      : optionalEnv("OPENAI_RAUL_SYSTEM_PROMPT") || DEFAULT_RAUL_INSTRUCTIONS;

  const visualRequest = wantsVisualTechnicalSheet(message);
  const requestPayload: Record<string, unknown> = {
    model: visualRequest
      ? optionalEnv("OPENAI_RAUL_VISUAL_MODEL") || "gpt-5.6-sol"
      : optionalEnv("OPENAI_RAUL_MODEL") || optionalEnv("OPENAI_MODEL") || "gpt-4.1-mini",
    instructions: visualRequest ? `${baseInstructions}\n\n${TECH_SHEET_INSTRUCTIONS}` : baseInstructions,
    input: [...history, { role: "user", content: userContent }],
    max_output_tokens: visualRequest ? 900 : 700,
  };

  if (!visualRequest) requestPayload.temperature = 0.3;
  if (visualRequest) {
    requestPayload.tools = [{
      type: "image_generation",
      size: "1536x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 85,
    }];
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Raul OpenAI request failed", response.status, details.slice(0, 1500));
    return json({ error: visualRequest ? "Raul n'a pas pu générer la fiche visuelle pour le moment." : "Raul n'a pas pu analyser la demande pour le moment." }, 502);
  }

  const data = await response.json();
  const reply = extractOutputText(data);
  const generatedImage = extractGeneratedImage(data);

  if (visualRequest && !generatedImage) {
    console.error("Raul visual request completed without image_generation_call", JSON.stringify(data?.output ?? []).slice(0, 1500));
    return json({ error: "Raul a préparé le contenu mais l'image n'a pas été générée. Réessaie dans quelques secondes." }, 502);
  }

  if (!reply && !generatedImage) return json({ error: "Réponse vide de Raul." }, 502);

  return json({
    reply: reply || "La fiche technique illustrée est prête.",
    generated_image: generatedImage,
    generated_image_name: generatedImage ? "fiche-technique-raul.jpg" : null,
  });
});
