import { supabase } from "../lib/supabaseClient";

export type ChantierPreparationNoteStatus = "actif" | "traite" | "archive";

export type ChantierPreparationNoteRow = {
  id: string;
  chantier_id: string;
  title: string;
  content: string;
  status: ChantierPreparationNoteStatus;
  author_id: string | null;
  author_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierPreparationNoteInput = {
  chantier_id: string;
  title: string;
  content: string;
  status?: ChantierPreparationNoteStatus;
  author_id?: string | null;
  author_name?: string | null;
};

export type ChantierPreparationNotePatch = Partial<
  Omit<ChantierPreparationNoteInput, "chantier_id">
>;

const NOTE_SELECT = [
  "id",
  "chantier_id",
  "title",
  "content",
  "status",
  "author_id",
  "author_name",
  "created_at",
  "updated_at",
].join(",");

function fromPreparationNotes() {
  return (supabase as any).from("chantier_preparation_notes");
}

function isMissingPreparationNotesSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    msg.includes("chantier_preparation_notes") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNoteStatus(value: unknown): ChantierPreparationNoteStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "traite") return "traite";
  if (raw === "archive") return "archive";
  return "actif";
}

function normalizeNoteRow(row: any): ChantierPreparationNoteRow {
  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    title: String(row?.title ?? "Note chantier").trim() || "Note chantier",
    content: String(row?.content ?? "").trim(),
    status: normalizeNoteStatus(row?.status),
    author_id: normalizeText(row?.author_id),
    author_name: normalizeText(row?.author_name),
    created_at: normalizeText(row?.created_at),
    updated_at: normalizeText(row?.updated_at),
  };
}

function cleanPayload(
  payload: ChantierPreparationNoteInput | ChantierPreparationNotePatch,
) {
  const title =
    payload.title === undefined ? undefined : String(payload.title ?? "").trim();
  const content =
    payload.content === undefined ? undefined : String(payload.content ?? "").trim();

  if (Object.prototype.hasOwnProperty.call(payload, "title") && !title) {
    throw new Error("Titre de note obligatoire.");
  }
  if (Object.prototype.hasOwnProperty.call(payload, "content") && !content) {
    throw new Error("Contenu de note obligatoire.");
  }

  return {
    ...payload,
    title,
    content,
    author_id:
      payload.author_id === undefined ? undefined : normalizeText(payload.author_id),
    author_name:
      payload.author_name === undefined ? undefined : normalizeText(payload.author_name),
    status:
      payload.status === undefined ? undefined : normalizeNoteStatus(payload.status),
  };
}

export async function listChantierPreparationNotes(
  chantierId: string,
): Promise<{ notes: ChantierPreparationNoteRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromPreparationNotes()
    .select(NOTE_SELECT)
    .eq("chantier_id", chantierId)
    .order("updated_at", { ascending: false });

  if (!error) {
    return {
      notes: (data ?? []).map(normalizeNoteRow),
      schemaReady: true,
    };
  }

  if (isMissingPreparationNotesSchemaError(error)) {
    return { notes: [], schemaReady: false };
  }

  throw error;
}

export async function createChantierPreparationNote(
  payload: ChantierPreparationNoteInput,
): Promise<ChantierPreparationNoteRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const { data, error } = await fromPreparationNotes()
    .insert([cleanPayload(payload)])
    .select(NOTE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingPreparationNotesSchemaError(error)) {
      throw new Error("Migration notes préparation non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Création note OK mais ligne non retournée.");
  return normalizeNoteRow(data);
}

export async function updateChantierPreparationNote(
  id: string,
  patch: ChantierPreparationNotePatch,
): Promise<ChantierPreparationNoteRow> {
  if (!id) throw new Error("id note manquant.");

  const { data, error } = await fromPreparationNotes()
    .update(cleanPayload(patch))
    .eq("id", id)
    .select(NOTE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingPreparationNotesSchemaError(error)) {
      throw new Error("Migration notes préparation non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Mise à jour note OK mais ligne non retournée.");
  return normalizeNoteRow(data);
}

export async function deleteChantierPreparationNote(id: string): Promise<void> {
  if (!id) throw new Error("id note manquant.");
  const { error } = await fromPreparationNotes().delete().eq("id", id);
  if (error) {
    if (isMissingPreparationNotesSchemaError(error)) {
      throw new Error("Migration notes préparation non appliquée sur Supabase.");
    }
    throw error;
  }
}
