import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "chantier-documents";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BODY_LENGTH = 5000;

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
  const noAccents = base.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lower = noAccents.toLowerCase();
  const underscored = lower.replace(/\s+/g, "_");
  const safe = underscored.replace(/[^a-z0-9._-]/g, "");
  const trimmed = safe.replace(/^_+|_+$/g, "") || "photo";
  return trimmed.slice(0, 120);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = normalizeString(req.headers.get("authorization") ?? req.headers.get("Authorization"));

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const sessionClient = authHeader
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          global: { headers: { Authorization: authHeader } },
        })
      : null;

    const formData = await req.formData();
    const token = normalizeString(formData.get("token"));
    const chantierId = normalizeString(formData.get("chantier_id"));
    const body = normalizeString(formData.get("body")).slice(0, MAX_BODY_LENGTH);
    const file = formData.get("file");

    if (!token && !sessionClient) return json({ error: "auth required" }, 400);
    if (!chantierId) return json({ error: "chantier_id required" }, 400);
    if (!(file instanceof File)) return json({ error: "file required" }, 400);
    if (!file.size || file.size <= 0) return json({ error: "empty file" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 400);

    const contentType = normalizeString(file.type).toLowerCase() || "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return json({ error: "unsupported_file_type" }, 400);
    }

    const accessClient = token ? admin : sessionClient;
    const { data: accessData, error: accessError } = await (accessClient as any).rpc("_intervenant_assert_chantier_access", {
      p_token: token || null,
      p_chantier_id: chantierId,
    });

    if (accessError) {
      return json({ error: accessError.message || "forbidden" }, 403);
    }

    const intervenantId = normalizeString(accessData);
    if (!intervenantId) return json({ error: "intervenant_required" }, 403);

    const { data: intervenantRow } = await admin
      .from("intervenants")
      .select("nom")
      .eq("id", intervenantId)
      .maybeSingle();
    const intervenantName = normalizeString(intervenantRow?.nom) || "Intervenant";

    const documentId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${chantierId}/${documentId}/${safeName}`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, file, {
      contentType,
      upsert: false,
    });

    if (uploadError) return json({ error: uploadError.message }, 400);

    const { data: documentRow, error: documentError } = await admin
      .from("chantier_documents")
      .insert({
        id: documentId,
        chantier_id: chantierId,
        title: body || safeName,
        file_name: safeName,
        storage_path: storagePath,
        mime_type: contentType,
        size_bytes: file.size,
        category: "Fil chantier",
        document_type: contentType.startsWith("image/") ? "PHOTO" : "PDF",
        visibility_mode: "GLOBAL",
        visibility: "INTERVENANT",
        allowed_intervenant_ids: null,
      })
      .select("id, file_name, mime_type, size_bytes")
      .single();

    if (documentError) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      return json({ error: documentError.message }, 400);
    }

    const postBody = body || (contentType.startsWith("image/") ? "📷 Photo envoyée depuis le chantier" : "📎 Document envoyé depuis le chantier");

    const { data: postRow, error: postError } = await admin
      .from("chantier_feed_posts")
      .insert({
        chantier_id: chantierId,
        author_id: intervenantId,
        author_intervenant_id: intervenantId,
        author_name: intervenantName,
        author_role: "INTERVENANT",
        body: postBody,
        visibility: "equipe",
      })
      .select("id, chantier_id, author_id, author_name, author_role, author_intervenant_id, body, visibility, parent_post_id, created_at, updated_at")
      .single();

    if (postError) {
      await admin.from("chantier_documents").delete().eq("id", documentId);
      await admin.storage.from(BUCKET).remove([storagePath]);
      return json({ error: postError.message }, 400);
    }

    const { error: attachmentError } = await admin
      .from("chantier_feed_attachments")
      .insert({ post_id: postRow.id, document_id: documentId });

    if (attachmentError) return json({ error: attachmentError.message }, 400);

    const { data: signedUrlData } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 15 * 60);

    return json({
      post: {
        ...postRow,
        attachment: {
          id: documentRow.id,
          file_name: documentRow.file_name,
          mime_type: documentRow.mime_type,
          size_bytes: documentRow.size_bytes,
          signed_url: signedUrlData?.signedUrl ?? null,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
