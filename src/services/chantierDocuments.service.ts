import { supabase } from "../lib/supabaseClient";

export type ChantierDocumentVisibility = "ADMIN" | "INTERVENANTS" | "CUSTOM" | string;

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
  visibility: ChantierDocumentVisibility;
  allowed_intervenant_ids: string[] | null;
  uploaded_by_email: string | null;
  created_at: string;
};

const DEFAULT_BUCKET = "chantier-documents";

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

export async function createDocumentMeta(input: {
  id?: string;
  chantier_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  category: string;
  document_type: string;
  visibility?: ChantierDocumentVisibility;
  allowed_intervenant_ids?: string[] | null;
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

  const payload = {
    id: input.id,
    chantier_id: input.chantier_id,
    title: input.title.trim(),
    file_name: input.file_name.trim(),
    storage_path: input.storage_path.trim(),
    category: input.category.trim(),
    document_type: input.document_type.trim(),
    visibility: input.visibility ?? "ADMIN",
    allowed_intervenant_ids: input.allowed_intervenant_ids ?? null,
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
        "visibility",
        "allowed_intervenant_ids",
        "uploaded_by_email",
        "created_at",
      ].join(","),
    )
    .single();

  if (error) throw new Error(error.message);
  if ((import.meta as any)?.env?.DEV) {
    console.log("[chantier-documents] create response", data);
  }
  return data as ChantierDocumentRow;
}

export async function uploadDocument(input: {
  chantierId: string;
  file: File;
  category?: string;
  documentType?: string;
  visibility?: ChantierDocumentVisibility;
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

  const insertPayload = {
    id: documentId,
    chantier_id: chantierId,
    title: file.name.replace(/\.[^/.]+$/, ""),
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    category: input.category ?? "Divers",
    document_type: input.documentType ?? "AUTRE",
    visibility: input.visibility ?? "ADMIN",
  };

  try {
    const { data, error: insertError } = await supabase
      .from("chantier_documents")
      .insert(insertPayload)
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
          "visibility",
          "allowed_intervenant_ids",
          "uploaded_by_email",
          "created_at",
        ].join(","),
      )
      .single();

    if (insertError) {
      console.error("[chantier-documents] insert error", insertError.message);
      throw new Error(insertError.message);
    }
    return data as ChantierDocumentRow;
  } catch (err) {
    const { error: removeError } = await supabase.storage.from(bucket).remove([storagePath]);
    if (removeError) {
      console.warn("[chantier-documents] cleanup failed", removeError.message);
    }
    throw err;
  }
}
