import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export type DocumentVisibilityMode = "GLOBAL" | "RESTRICTED" | string;
export type DocumentVisibilityOption = "GLOBAL" | "RESTRICTED" | "ADMIN_ONLY";

export type ChantierDocumentRow = {
  id: string;
  chantier_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string;
  document_type: string;
  visibility_mode: DocumentVisibilityMode | null;
  visibility?: string | null;
  allowed_intervenant_ids: string[] | null;
  uploaded_by_email: string | null;
  created_at: string;
};

const DEFAULT_BUCKET = "chantier-documents";

function deriveLegacyVisibility(mode: DocumentVisibilityMode, accessIds?: string[] | null): string {
  const normalized = String(mode ?? "GLOBAL").toUpperCase();
  if (normalized === "GLOBAL") return "INTERVENANT";
  const hasAccess = Array.isArray(accessIds) && accessIds.length > 0;
  return hasAccess ? "CUSTOM" : "ADMIN";
}

function sanitizeFileName(name: string): string {
  const base = (name ?? "").trim();
  if (!base) return "fichier";
  const noAccents = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = noAccents.toLowerCase();
  const noApostrophes = lower.replace(/['\u2019]/g, "");
  const underscored = noApostrophes.replace(/\s+/g, "_");
  const safe = underscored.replace(/[^a-z0-9._-]/g, "");
  const trimmed = safe.replace(/^_+|_+$/g, "") || "fichier";
  const maxLen = 120;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function isMissingTableError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("chantier_documents")) ||
    (msg.includes("schema cache") && msg.includes("chantier_documents")) ||
    msg.includes("does not exist")
  );
}

export async function listByChantier(chantierId: string): Promise<ChantierDocumentRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("chantier_documents")
    .select(
      [
        "id",
        "chantier_id",
        "title",
        "file_name",
        "storage_path",
        "mime_type",
        "size_bytes",
        "category",
        "document_type",
        "visibility_mode",
        "visibility",
        "allowed_intervenant_ids",
        "uploaded_by_email",
        "created_at",
      ].join(","),
    )
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      console.warn("Table chantier_documents introuvable, retour liste vide.");
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as ChantierDocumentRow[];
}

// Manual test:
// - Create a RESTRICTED doc for intervenant A.
// - A sees it, B does not.
// - Admin can update visibility and access list.
export async function listForIntervenant(input: {
  chantierId: string;
  intervenantId: string;
  client?: SupabaseClient;
}): Promise<ChantierDocumentRow[]> {
  const chantierId = input.chantierId;
  const intervenantId = input.intervenantId;
  const client = input.client ?? supabase;

  if (!chantierId) throw new Error("chantierId manquant.");
  if (!intervenantId) throw new Error("intervenantId manquant.");

  const selectFields = [
    "id",
    "chantier_id",
    "title",
    "file_name",
    "storage_path",
    "mime_type",
    "size_bytes",
    "category",
    "document_type",
    "visibility_mode",
    "visibility",
    "allowed_intervenant_ids",
    "uploaded_by_email",
    "created_at",
  ].join(",");

  // Côté intervenant: on s'appuie sur la RLS pour filtrer GLOBAL/RESTRICTED.
  const { data, error } = await client
    .from("chantier_documents")
    .select(selectFields)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []) as ChantierDocumentRow[];
}

export async function listDocumentsForIntervenant(input: {
  chantierId: string;
  intervenantId: string;
  client?: SupabaseClient;
}): Promise<ChantierDocumentRow[]> {
  return listForIntervenant(input);
}

export async function getSignedUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  if (!storagePath) throw new Error("storage_path manquant.");
  const { data, error } = await supabase
    .storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Impossible de générer l'URL signée.");
  }

  return data.signedUrl;
}

export async function createDocumentMeta(input: {
  id?: string;
  chantier_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  category: string;
  document_type: string;
  visibility_mode?: DocumentVisibilityMode;
  access_intervenant_ids?: string[] | null;
  legacy_visibility?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  uploaded_by_email?: string | null;
}): Promise<ChantierDocumentRow> {
  if (!input.chantier_id) throw new Error("chantier_id manquant.");
  if (!input.title) throw new Error("title manquant.");
  if (!input.file_name) throw new Error("file_name manquant.");
  if (!input.storage_path) throw new Error("storage_path manquant.");
  if (!input.category) throw new Error("category manquant.");
  if (!input.document_type) throw new Error("document_type manquant.");

  const visibilityMode = input.visibility_mode ?? "GLOBAL";
  const legacyVisibility = input.legacy_visibility ?? deriveLegacyVisibility(visibilityMode, input.access_intervenant_ids);

  const payload = {
    id: input.id,
    chantier_id: input.chantier_id,
    title: input.title.trim(),
    file_name: input.file_name.trim(),
    storage_path: input.storage_path.trim(),
    category: input.category.trim(),
    document_type: input.document_type.trim(),
    visibility_mode: visibilityMode,
    visibility: legacyVisibility,
    allowed_intervenant_ids: null,
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
    uploaded_by_email: input.uploaded_by_email ?? null,
  };

  if ((import.meta as any)?.env?.DEV) {
    console.log("[chantier-documents] create payload", payload);
  }

  const { data, error } = await supabase
    .from("chantier_documents")
    .insert(payload)
    .select(
      [
        "id",
        "chantier_id",
        "title",
        "file_name",
        "storage_path",
        "mime_type",
        "size_bytes",
        "category",
        "document_type",
        "visibility_mode",
        "visibility",
        "allowed_intervenant_ids",
        "uploaded_by_email",
        "created_at",
      ].join(","),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Document introuvable ou non accessible.");
  if ((import.meta as any)?.env?.DEV) {
    console.log("[chantier-documents] create response", data);
  }
  return data as ChantierDocumentRow;
}

export async function uploadDocument(input: {
  chantierId: string;
  file: File;
  title: string;
  category: string;
  documentType: string;
  visibility_mode: DocumentVisibilityMode;
  accessIntervenantIds?: string[] | null;
  bucket?: string;
}): Promise<ChantierDocumentRow> {
  const chantierId = input.chantierId;
  const file = input.file;
  if (!chantierId) throw new Error("chantierId manquant.");
  if (!file) throw new Error("fichier manquant.");

  const documentId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${chantierId}/${documentId}/${safeFileName}`;
  const bucket = input.bucket ?? DEFAULT_BUCKET;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    console.error("[chantier-documents] upload error", uploadError.message);
    throw new Error(uploadError.message);
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.log("=== AUTH DEBUG ===");
      console.log("Session exists:", false);
      console.log("User:", undefined);
      console.log("Role:", undefined);
      console.log("==================");
    } else {
      console.log("=== AUTH DEBUG ===");
      console.log("Session exists:", !!sessionData.session);
      console.log("User:", sessionData.session?.user?.email);
      console.log("Role:", sessionData.session?.user?.role);
      console.log("==================");
    }

    if (!sessionData.session) {
      throw new Error("Utilisateur non authentifié");
    }

    const created = await createChantierDocument({
      id: documentId,
      chantier_id: chantierId,
      title: input.title,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      category: input.category,
      document_type: input.documentType,
      visibility_mode: input.visibility_mode,
      legacy_visibility: deriveLegacyVisibility(input.visibility_mode, input.accessIntervenantIds),
    });
    if (String(input.visibility_mode).toUpperCase() === "RESTRICTED") {
      await updateDocumentAccess(created.id, input.accessIntervenantIds ?? []);
    }
    return created;
  } catch (err) {
    const { error: removeError } = await supabase.storage.from(bucket).remove([storagePath]);
    if (removeError) {
      console.warn("[chantier-documents] cleanup failed", removeError.message);
    }
    throw err;
  }
}

export async function createChantierDocument(input: {
  id?: string;
  chantier_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string;
  document_type: string;
  visibility_mode: DocumentVisibilityMode;
  legacy_visibility?: string | null;
}): Promise<ChantierDocumentRow> {
  const visibilityMode = input.visibility_mode ?? "GLOBAL";
  const legacyVisibility = input.legacy_visibility ?? deriveLegacyVisibility(visibilityMode, null);

  const payload = {
    id: input.id,
    chantier_id: input.chantier_id,
    title: input.title.trim(),
    file_name: input.file_name.trim(),
    storage_path: input.storage_path.trim(),
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
    category: input.category.trim(),
    document_type: input.document_type.trim(),
    visibility_mode: visibilityMode,
    visibility: legacyVisibility,
    allowed_intervenant_ids: null,
  };

  const { data, error } = await supabase
    .from("chantier_documents")
    .insert(payload)
    .select(
      [
        "id",
        "chantier_id",
        "title",
        "file_name",
        "storage_path",
        "mime_type",
        "size_bytes",
        "category",
        "document_type",
        "visibility_mode",
        "visibility",
        "allowed_intervenant_ids",
        "uploaded_by_email",
        "created_at",
      ].join(","),
    )
    .maybeSingle();

  if (error) {
    console.error("[chantier-documents] insert error", error.message);
    throw new Error(error.message);
  }
  if (!data) throw new Error("Document introuvable ou non accessible.");
  return data as ChantierDocumentRow;
}

export async function listDocumentAccess(documentId: string): Promise<string[]> {
  if (!documentId) throw new Error("documentId manquant.");
  const { data, error } = await supabase
    .from("document_access")
    .select("intervenant_id")
    .eq("document_id", documentId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.intervenant_id as string);
}

export async function updateDocumentAccess(documentId: string, intervenantIds: string[]): Promise<void> {
  if (!documentId) throw new Error("documentId manquant.");
  const uniqueIds = Array.from(new Set((intervenantIds ?? []).filter(Boolean)));

  const { data: existing, error: existingError } = await supabase
    .from("document_access")
    .select("intervenant_id")
    .eq("document_id", documentId);

  if (existingError) throw new Error(existingError.message);

  const existingIds = new Set((existing ?? []).map((row) => row.intervenant_id as string));
  const toAdd = uniqueIds.filter((id) => !existingIds.has(id));
  const toRemove = Array.from(existingIds).filter((id) => !uniqueIds.includes(id));

  if (toAdd.length) {
    const { error } = await supabase.from("document_access").insert(
      toAdd.map((intervenant_id) => ({
        document_id: documentId,
        intervenant_id,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("document_access")
      .delete()
      .eq("document_id", documentId)
      .in("intervenant_id", toRemove);
    if (error) throw new Error(error.message);
  }
}

export async function updateDocument(
  documentId: string,
  input: {
    title?: string;
    category?: string;
    document_type?: string;
    visibility_mode?: DocumentVisibilityMode;
    legacy_visibility?: string | null;
  },
): Promise<ChantierDocumentRow> {
  if (!documentId) throw new Error("documentId manquant.");

  const payload: Record<string, any> = {};
  if (typeof input.title === "string") payload.title = input.title.trim();
  if (typeof input.category === "string") payload.category = input.category.trim();
  if (typeof input.document_type === "string") payload.document_type = input.document_type.trim();
  if (input.visibility_mode) payload.visibility_mode = input.visibility_mode;
  if (input.legacy_visibility !== undefined) payload.visibility = input.legacy_visibility;

  if (!Object.keys(payload).length) {
    throw new Error("Aucune donnée à mettre à jour.");
  }

  const { data, error } = await supabase
    .from("chantier_documents")
    .update(payload)
    .eq("id", documentId)
    .select(
      [
        "id",
        "chantier_id",
        "title",
        "file_name",
        "storage_path",
        "mime_type",
        "size_bytes",
        "category",
        "document_type",
        "visibility_mode",
        "visibility",
        "allowed_intervenant_ids",
        "uploaded_by_email",
        "created_at",
      ].join(","),
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Document introuvable ou non accessible.");
  return data as ChantierDocumentRow;
}

export async function deleteDocument(documentId: string, storagePath?: string | null): Promise<void> {
  if (!documentId) throw new Error("documentId manquant.");

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(DEFAULT_BUCKET).remove([storagePath]);
    if (storageError) throw new Error(storageError.message);
  }

  const { error } = await supabase.from("chantier_documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
}

export async function linkDocumentToTask(taskId: string, documentId: string) {
  if (!taskId) throw new Error("taskId manquant.");
  if (!documentId) throw new Error("documentId manquant.");

  const { error } = await supabase.from("task_documents").insert({
    task_id: taskId,
    document_id: documentId,
  });

  if (error) throw new Error(error.message);
}

