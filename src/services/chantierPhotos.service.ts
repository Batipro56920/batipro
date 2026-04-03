import { supabase } from "../lib/supabaseClient";

const PHOTO_BUCKET = "chantier-documents";
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export type ChantierPhotoType = "avant" | "pendant" | "apres";

export type ChantierPhotoRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  zone_id: string | null;
  photo_type: ChantierPhotoType;
  titre: string | null;
  description: string | null;
  storage_bucket: string;
  storage_path: string;
  taken_on: string;
  uploaded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierPhotoUploadInput = {
  chantierId: string;
  file: File;
  photoType: ChantierPhotoType;
  taskId?: string | null;
  zoneId?: string | null;
  titre?: string | null;
  description?: string | null;
  takenOn?: string | null;
};

const PHOTO_SELECT = [
  "id",
  "chantier_id",
  "task_id",
  "zone_id",
  "photo_type",
  "titre",
  "description",
  "storage_bucket",
  "storage_path",
  "taken_on",
  "uploaded_by",
  "created_at",
  "updated_at",
].join(",");

function fromPhotos() {
  return (supabase as any).from("chantier_photos");
}

function isMissingPhotoSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    msg.includes("chantier_photos") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function sanitizeFileName(name: string): string {
  const base = String(name ?? "").trim();
  if (!base) return "photo.jpg";
  const noAccents = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = noAccents.toLowerCase();
  const noQuotes = lower.replace(/['\u2019]/g, "");
  const underscored = noQuotes.replace(/\s+/g, "_");
  const safe = underscored.replace(/[^a-z0-9._-]/g, "");
  return safe.replace(/^_+|_+$/g, "") || "photo.jpg";
}

function resolveContentType(file: File): string {
  const type = String(file.type ?? "").trim().toLowerCase();
  if (type) return type;
  const name = String(file.name ?? "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function validatePhotoFile(file: File) {
  if (!file) throw new Error("Photo manquante.");
  if (!file.name?.trim()) throw new Error("Nom de photo invalide.");
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("Photo vide ou invalide.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo trop volumineuse (max 25 Mo).");

  const contentType = resolveContentType(file);
  if (!contentType.startsWith("image/")) {
    throw new Error(`Type de fichier non supporté (${contentType}).`);
  }

  return {
    contentType,
    safeName: sanitizeFileName(file.name),
  };
}

function normalizePhotoRow(row: any): ChantierPhotoRow {
  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    task_id: row?.task_id ?? null,
    zone_id: row?.zone_id ?? null,
    photo_type: (row?.photo_type ?? "pendant") as ChantierPhotoType,
    titre: row?.titre ?? null,
    description: row?.description ?? null,
    storage_bucket: String(row?.storage_bucket ?? PHOTO_BUCKET),
    storage_path: String(row?.storage_path ?? ""),
    taken_on: String(row?.taken_on ?? new Date().toISOString().slice(0, 10)),
    uploaded_by: row?.uploaded_by ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function listChantierPhotos(
  chantierId: string,
): Promise<{ photos: ChantierPhotoRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromPhotos()
    .select(PHOTO_SELECT)
    .eq("chantier_id", chantierId)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (!error) {
    return {
      photos: (data ?? []).map(normalizePhotoRow),
      schemaReady: true,
    };
  }

  if (isMissingPhotoSchemaError(error)) {
    return {
      photos: [],
      schemaReady: false,
    };
  }

  throw error;
}

export async function uploadChantierPhoto(input: ChantierPhotoUploadInput): Promise<ChantierPhotoRow> {
  const chantierId = String(input.chantierId ?? "").trim();
  if (!chantierId) throw new Error("chantierId manquant.");

  const { contentType, safeName } = validatePhotoFile(input.file);
  const photoId = crypto.randomUUID();
  const storagePath = `${chantierId}/photos/${photoId}/${safeName}`;

  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, input.file, {
    upsert: false,
    contentType,
  });
  if (uploadError) throw uploadError;

  const payload = {
    id: photoId,
    chantier_id: chantierId,
    task_id: input.taskId || null,
    zone_id: input.zoneId || null,
    photo_type: input.photoType || "pendant",
    titre: input.titre?.trim() || null,
    description: input.description?.trim() || null,
    storage_bucket: PHOTO_BUCKET,
    storage_path: storagePath,
    taken_on: input.takenOn || new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await fromPhotos().insert([payload]).select(PHOTO_SELECT).maybeSingle();
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
    if (isMissingPhotoSchemaError(error)) {
      throw new Error("Migration photos chantier non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Upload photo OK mais métadonnées non retournées.");
  return normalizePhotoRow(data);
}

export async function getChantierPhotoSignedUrl(
  storagePath: string,
  bucket = PHOTO_BUCKET,
  expiresInSeconds = 120,
): Promise<string> {
  if (!storagePath) throw new Error("storage_path manquant.");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Impossible de générer l'URL signée.");
  }
  return data.signedUrl;
}

export async function deleteChantierPhoto(row: ChantierPhotoRow): Promise<void> {
  if (!row?.id) throw new Error("id photo manquant.");
  const { error } = await fromPhotos().delete().eq("id", row.id);
  if (error) {
    if (isMissingPhotoSchemaError(error)) {
      throw new Error("Migration photos chantier non appliquée sur Supabase.");
    }
    throw error;
  }

  if (row.storage_path) {
    const { error: removeError } = await supabase.storage
      .from(row.storage_bucket || PHOTO_BUCKET)
      .remove([row.storage_path]);
    if (removeError) {
      console.warn("[chantier-photos] storage cleanup failed", removeError.message);
    }
  }
}
