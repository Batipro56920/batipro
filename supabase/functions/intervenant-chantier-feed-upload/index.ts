import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "chantier-documents";
const MAX_FILES = 6;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
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
  return (safe.replace(/^_+|_+$/g, "") || "photo").slice(0, 120);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = normalizeString(req.headers.get("authorization") ?? req.headers.get("Authorization"));
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const sessionClient = authHeader
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          global: { headers: { Authorization: authHeader } },
        })
      : null;

    const requestContentType = normalizeString(req.headers.get("content-type")).toLowerCase();
    if (requestContentType.includes("application/json")) {
      const payload = await req.json() as Record<string, unknown>;
      const token = normalizeString(payload.token);
      const chantierId = normalizeString(payload.chantier_id);
      if (normalizeString(payload.action) !== "list") return json({ error: "unsupported_action" }, 400);
      if (!token && !sessionClient) return json({ error: "auth required" }, 400);
      if (!chantierId) return json({ error: "chantier_id required" }, 400);

      const accessClient = token ? admin : sessionClient;
      const { data: accessData, error: accessError } = await (accessClient as any).rpc("_intervenant_assert_chantier_access", {
        p_token: token || null,
        p_chantier_id: chantierId,
      });
      if (accessError || !normalizeString(accessData)) return json({ error: accessError?.message || "forbidden" }, 403);

      const { data: posts, error: postsError } = await admin
        .from("chantier_feed_posts")
        .select("id, chantier_id, author_id, author_name, author_role, author_intervenant_id, body, visibility, parent_post_id, created_at, updated_at")
        .eq("chantier_id", chantierId)
        .eq("visibility", "equipe")
        .order("created_at", { ascending: true })
        .limit(500);
      if (postsError) return json({ error: postsError.message }, 400);

      const postIds = (posts ?? []).map((post) => post.id);
      if (!postIds.length) return json({ posts: [] });

      const { data: links, error: linksError } = await admin
        .from("chantier_feed_attachments")
        .select("id, post_id, document_id, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      if (linksError) return json({ error: linksError.message }, 400);

      const documentIds = [...new Set((links ?? []).map((link) => link.document_id).filter(Boolean))];
      const { data: documents, error: documentsError } = documentIds.length
        ? await admin
            .from("chantier_documents")
            .select("id, chantier_id, file_name, mime_type, size_bytes, storage_path")
            .in("id", documentIds)
            .eq("chantier_id", chantierId)
        : { data: [], error: null };
      if (documentsError) return json({ error: documentsError.message }, 400);

      const documentsById = new Map((documents ?? []).map((document) => [document.id, document]));
      const signedUrlsByDocumentId = new Map<string, string | null>();
      await Promise.all((documents ?? []).map(async (document) => {
        const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);
        if (error) throw error;
        signedUrlsByDocumentId.set(document.id, data?.signedUrl ?? null);
      }));

      const attachmentsByPostId = new Map<string, unknown[]>();
      for (const link of links ?? []) {
        const document = documentsById.get(link.document_id);
        if (!document) continue;
        const attachments = attachmentsByPostId.get(link.post_id) ?? [];
        attachments.push({
          id: document.id,
          file_name: document.file_name,
          mime_type: document.mime_type,
          size_bytes: document.size_bytes,
          signed_url: signedUrlsByDocumentId.get(document.id) ?? null,
        });
        attachmentsByPostId.set(link.post_id, attachments);
      }

      return json({ posts: (posts ?? []).map((post) => ({ ...post, attachments: attachmentsByPostId.get(post.id) ?? [] })) });
    }

    const formData = await req.formData();
    const token = normalizeString(formData.get("token"));
    const chantierId = normalizeString(formData.get("chantier_id"));
    const body = normalizeString(formData.get("body")).slice(0, MAX_BODY_LENGTH);
    const legacyFile = formData.get("file");
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length && legacyFile instanceof File) files.push(legacyFile);

    if (!token && !sessionClient) return json({ error: "auth required" }, 400);
    if (!chantierId) return json({ error: "chantier_id required" }, 400);
    if (!files.length) return json({ error: "file required" }, 400);
    if (files.length > MAX_FILES) return json({ error: "too_many_files" }, 400);
    if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_UPLOAD_BYTES) return json({ error: "files_too_large" }, 400);

    for (const file of files) {
      if (!file.size || file.size <= 0) return json({ error: "empty file" }, 400);
      if (file.size > MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 400);
      const contentType = normalizeString(file.type).toLowerCase() || "application/octet-stream";
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) return json({ error: "unsupported_file_type" }, 400);
    }

    const accessClient = token ? admin : sessionClient;
    const { data: accessData, error: accessError } = await (accessClient as any).rpc("_intervenant_assert_chantier_access", {
      p_token: token || null,
      p_chantier_id: chantierId,
    });
    if (accessError) return json({ error: accessError.message || "forbidden" }, 403);

    const intervenantId = normalizeString(accessData);
    if (!intervenantId) return json({ error: "intervenant_required" }, 403);

    const { data: intervenantRow } = await admin.from("intervenants").select("nom").eq("id", intervenantId).maybeSingle();
    const intervenantName = normalizeString(intervenantRow?.nom) || "Intervenant";
    const storedPaths: string[] = [];
    const documentRows: Array<{ id: string; file_name: string; mime_type: string; size_bytes: number; storage_path: string }> = [];
    let postId: string | null = null;

    const cleanup = async () => {
      if (postId) await admin.from("chantier_feed_posts").delete().eq("id", postId);
      if (documentRows.length) await admin.from("chantier_documents").delete().in("id", documentRows.map((document) => document.id));
      if (storedPaths.length) await admin.storage.from(BUCKET).remove(storedPaths);
    };

    for (const file of files) {
      const documentId = crypto.randomUUID();
      const safeName = sanitizeFileName(file.name);
      const contentType = normalizeString(file.type).toLowerCase();
      const storagePath = `${chantierId}/${documentId}/${safeName}`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, file, { contentType, upsert: false });
      if (uploadError) {
        await cleanup();
        return json({ error: uploadError.message }, 400);
      }
      storedPaths.push(storagePath);

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
          category: contentType.startsWith("image/") ? "Photos" : "Divers",
          document_type: contentType.startsWith("image/") ? "PHOTO" : "PDF",
          visibility_mode: "GLOBAL",
          visibility: "INTERVENANT",
          allowed_intervenant_ids: null,
        })
        .select("id, file_name, mime_type, size_bytes, storage_path")
        .single();
      if (documentError) {
        await cleanup();
        return json({ error: documentError.message }, 400);
      }
      documentRows.push(documentRow);
    }

    const photosCount = documentRows.filter((document) => document.mime_type.startsWith("image/")).length;
    const documentsCount = documentRows.length - photosCount;
    const defaultBody = documentsCount === 0
      ? `📷 ${photosCount} photo${photosCount > 1 ? "s" : ""} envoyée${photosCount > 1 ? "s" : ""} depuis le chantier`
      : `📎 ${documentRows.length} pièce${documentRows.length > 1 ? "s" : ""} jointe${documentRows.length > 1 ? "s" : ""} envoyée${documentRows.length > 1 ? "s" : ""} depuis le chantier`;

    const { data: postRow, error: postError } = await admin
      .from("chantier_feed_posts")
      .insert({ chantier_id: chantierId, author_id: intervenantId, author_intervenant_id: intervenantId, author_name: intervenantName, author_role: "INTERVENANT", body: body || defaultBody, visibility: "equipe" })
      .select("id, chantier_id, author_id, author_name, author_role, author_intervenant_id, body, visibility, parent_post_id, created_at, updated_at")
      .single();
    if (postError) {
      await cleanup();
      return json({ error: postError.message }, 400);
    }
    postId = postRow.id;

    const { error: attachmentError } = await admin.from("chantier_feed_attachments").insert(documentRows.map((document) => ({ post_id: postRow.id, document_id: document.id })));
    if (attachmentError) {
      await cleanup();
      return json({ error: attachmentError.message }, 400);
    }

    const attachments = await Promise.all(documentRows.map(async (document) => {
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);
      return { id: document.id, file_name: document.file_name, mime_type: document.mime_type, size_bytes: document.size_bytes, signed_url: data?.signedUrl ?? null };
    }));

    return json({ post: { ...postRow, attachment: attachments[0] ?? null, attachments } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
