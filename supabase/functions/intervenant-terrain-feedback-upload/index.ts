import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "terrain-feedbacks";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function normalizeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sanitizeFileName(name: string) {
  const base = normalizeString(name);
  if (!base) return "photo";
  const noAccents = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = noAccents.toLowerCase();
  const underscored = lower.replace(/\s+/g, "_");
  const safe = underscored.replace(/[^a-z0-9._-]/g, "");
  const trimmed = safe.replace(/^_+|_+$/g, "") || "photo";
  return trimmed.slice(0, 120);
}

function getPublicUrl(supabaseUrl: string, bucket: string, path: string) {
  const safeBase = supabaseUrl.replace(/\/+$/, "");
  return `${safeBase}/storage/v1/object/public/${bucket}/${path}`;
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
    const feedbackId = normalizeString(formData.get("feedback_id"));
    const file = formData.get("file");

    if (!token) return json({ error: "token required" }, 400);
    if (!chantierId) return json({ error: "chantier_id required" }, 400);
    if (!feedbackId) return json({ error: "feedback_id required" }, 400);
    if (!(file instanceof File)) return json({ error: "file required" }, 400);
    if (!file.size || file.size <= 0) return json({ error: "empty file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 400);

    const contentType = normalizeString(file.type).toLowerCase() || "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json({ error: "unsupported_file_type" }, 400);
    }

    const { data: accessData, error: accessError } = await (admin as any).rpc("_intervenant_assert_chantier_access", {
      p_token: token,
      p_chantier_id: chantierId,
    });

    if (accessError) {
      return json({ error: accessError.message || "forbidden" }, 403);
    }

    const intervenantId = normalizeString(accessData);
    if (!intervenantId) return json({ error: "intervenant_required" }, 403);

    const { data: feedbackRow, error: feedbackError } = await admin
      .from("terrain_feedbacks")
      .select("id, chantier_id, author_intervenant_id")
      .eq("id", feedbackId)
      .maybeSingle();

    if (feedbackError) return json({ error: feedbackError.message }, 400);
    if (!feedbackRow) return json({ error: "feedback_not_found" }, 404);
    if (String(feedbackRow.chantier_id ?? "") !== chantierId || String(feedbackRow.author_intervenant_id ?? "") !== intervenantId) {
      return json({ error: "forbidden_feedback_scope" }, 403);
    }

    const attachmentId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${chantierId}/${feedbackId}/${attachmentId}-${safeName}`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, file, {
      contentType,
      upsert: false,
    });

    if (uploadError) return json({ error: uploadError.message }, 400);

    const { data: attachmentRow, error: attachmentError } = await admin
      .from("terrain_feedback_attachments")
      .insert({
        id: attachmentId,
        feedback_id: feedbackId,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: contentType,
        size_bytes: file.size,
      })
      .select("id, storage_bucket, storage_path, file_name, mime_type, size_bytes, created_at")
      .single();

    if (attachmentError) return json({ error: attachmentError.message }, 400);

    await admin.from("terrain_feedback_history").insert({
      feedback_id: feedbackId,
      changed_by_name: "Portail intervenant",
      action: "attachment_added",
      changes: { file_name: safeName },
    });

    return json({
      attachment: {
        ...attachmentRow,
        public_url: getPublicUrl(SUPABASE_URL, BUCKET, storagePath),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
