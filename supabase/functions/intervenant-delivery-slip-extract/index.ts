import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "chantier-documents";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EXTRACTION_PROMPT = `Tu lis une photo de bon de livraison ou de facture de matériaux de chantier (BTP / rénovation), prise par un ouvrier avec son téléphone.

Extrait la liste des lignes de matériaux livrés. Pour chaque ligne, donne :
- "designation": le nom du produit tel qu'écrit sur le bon (texte brut, garde les unités/dimensions visibles)
- "quantity": la quantité livrée, en nombre (ex: 10, 2.5)
- "unit": l'unité si elle est indiquée (ex: "u", "m2", "ml", "sac", "boîte", "rouleau"), sinon "u"

Ignore les lignes qui ne sont pas des matériaux (frais de port, remises, totaux, TVA, mentions légales).
Si l'image est illisible ou n'est pas un bon de livraison, renvoie une liste vide.

Réponds uniquement en JSON valide, sans texte autour, avec exactement cette forme :
{"lines": [{"designation": "...", "quantity": 0, "unit": "..."}]}`;

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

function normalizeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sanitizeFileName(name: string) {
  const base = normalizeString(name);
  if (!base) return "bon-livraison";
  const noAccents = base.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lower = noAccents.toLowerCase();
  const underscored = lower.replace(/\s+/g, "_");
  const safe = underscored.replace(/[^a-z0-9._-]/g, "");
  const trimmed = safe.replace(/^_+|_+$/g, "") || "bon-livraison";
  return trimmed.slice(0, 120);
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

function normalizeLines(raw: unknown) {
  const list = Array.isArray((raw as any)?.lines) ? (raw as any).lines : [];
  return list
    .map((item: any) => ({
      designation: normalizeString(item?.designation).slice(0, 200),
      quantity: Number(item?.quantity),
      unit: normalizeString(item?.unit).slice(0, 20) || "u",
    }))
    .filter((line: any) => line.designation && Number.isFinite(line.quantity) && line.quantity > 0)
    .slice(0, 40);
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const formData = await req.formData();
    const token = normalizeString(formData.get("token"));
    const chantierId = normalizeString(formData.get("chantier_id"));
    const file = formData.get("file");

    if (!token) return json({ error: "auth required" }, 400);
    if (!chantierId) return json({ error: "chantier_id required" }, 400);
    if (!(file instanceof File)) return json({ error: "file required" }, 400);
    if (!file.size || file.size <= 0) return json({ error: "empty file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 400);

    const contentType = normalizeString(file.type).toLowerCase() || "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json({ error: "unsupported_file_type" }, 400);
    }

    const { data: accessData, error: accessError } = await admin.rpc("_intervenant_assert_chantier_access", {
      p_token: token,
      p_chantier_id: chantierId,
    });
    if (accessError) return json({ error: accessError.message || "forbidden" }, 403);

    const intervenantId = normalizeString(accessData);
    if (!intervenantId) return json({ error: "intervenant_required" }, 403);

    const attachmentId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${chantierId}/bons-livraison/${attachmentId}-${safeName}`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, file, {
      contentType,
      upsert: false,
    });
    if (uploadError) return json({ error: uploadError.message }, 400);

    const base64 = await fileToBase64(file);

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: optionalEnv("OPENAI_MODEL") || "gpt-4.1-mini",
        temperature: 0.1,
        max_output_tokens: 1500,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: EXTRACTION_PROMPT },
              { type: "input_image", image_url: `data:${contentType};base64,${base64}` },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      return json({ error: "ai_unavailable", storage_path: storagePath, storage_bucket: BUCKET }, 502);
    }

    const outputText = extractOutputText(await aiResponse.json());
    if (!outputText) {
      return json({ error: "ai_empty_response", storage_path: storagePath, storage_bucket: BUCKET }, 502);
    }

    let lines: Array<{ designation: string; quantity: number; unit: string }> = [];
    try {
      lines = normalizeLines(parseJsonObject(outputText));
    } catch {
      return json({ error: "ai_invalid_response", storage_path: storagePath, storage_bucket: BUCKET }, 502);
    }

    return json({
      lines,
      storage_path: storagePath,
      storage_bucket: BUCKET,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
