import { supabase } from "../lib/supabaseClient";

export type ChantierPreparationNoteStatus = "actif" | "traite" | "archive";

export type ChantierPreparationNoteRow = {
  id: string;
  chantier_id: string;
  title: string;
  content: string;
  status: ChantierPreparationNoteStatus;
  task_id: string | null;
  zone_id: string | null;
  change_order_id: string | null;
  document_id: string | null;
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
  task_id?: string | null;
  zone_id?: string | null;
  change_order_id?: string | null;
  document_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
};

export type ChantierPreparationNotePatch = Partial<Omit<ChantierPreparationNoteInput, "chantier_id">>;

const NOTE_SELECT_V2 = [
  "id",
  "chantier_id",
  "title",
  "content",
  "status",
  "task_id",
  "zone_id",
  "change_order_id",
  "document_id",
  "author_id",
  "author_name",
  "created_at",
  "updated_at",
].join(",");

const NOTE_SELECT_V1 = [
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

function isMissingPreparationNotesColumnError(error: unknown, columns: string[]) {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code !== "42703" && code !== "PGRST205") return false;
  return columns.some((column) => msg.includes(column.toLowerCase()));
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
    task_id: normalizeText(row?.task_id),
    zone_id: normalizeText(row?.zone_id),
    change_order_id: normalizeText(row?.change_order_id),
    document_id: normalizeText(row?.document_id),
    author_id: normalizeText(row?.author_id),
    author_name: normalizeText(row?.author_name),
    created_at: normalizeText(row?.created_at),
    updated_at: normalizeText(row?.updated_at),
  };
}

function cleanPayload(payload: ChantierPreparationNoteInput | ChantierPreparationNotePatch) {
  const title = payload.title === undefined ? undefined : String(payload.title ?? "").trim();
  const content = payload.content === undefined ? undefined : String(payload.content ?? "").trim();

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
    status: payload.status === undefined ? undefined : normalizeNoteStatus(payload.status),
    task_id: payload.task_id === undefined ? undefined : normalizeText(payload.task_id),
    zone_id: payload.zone_id === undefined ? undefined : normalizeText(payload.zone_id),
    change_order_id: payload.change_order_id === undefined ? undefined : normalizeText(payload.change_order_id),
    document_id: payload.document_id === undefined ? undefined : normalizeText(payload.document_id),
    author_id: payload.author_id === undefined ? undefined : normalizeText(payload.author_id),
    author_name: payload.author_name === undefined ? undefined : normalizeText(payload.author_name),
  };
}

export async function listChantierPreparationNotes(
  chantierId: string,
): Promise<{ notes: ChantierPreparationNoteRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await fromPreparationNotes()
    .select(NOTE_SELECT_V2)
    .eq("chantier_id", chantierId)
    .order("updated_at", { ascending: false });

  if (!first.error) {
    return {
      notes: (first.data ?? []).map(normalizeNoteRow),
      schemaReady: true,
    };
  }

  if (isMissingPreparationNotesSchemaError(first.error)) {
    return { notes: [], schemaReady: false };
  }

  if (isMissingPreparationNotesColumnError(first.error, ["task_id", "zone_id", "change_order_id", "document_id"])) {
    const legacy = await fromPreparationNotes()
      .select(NOTE_SELECT_V1)
      .eq("chantier_id", chantierId)
      .order("updated_at", { ascending: false });

    if (legacy.error) throw legacy.error;
    return {
      notes: (legacy.data ?? []).map(normalizeNoteRow),
      schemaReady: false,
    };
  }

  throw first.error;
}

export async function createChantierPreparationNote(payload: ChantierPreparationNoteInput): Promise<ChantierPreparationNoteRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const { data, error } = await fromPreparationNotes()
    .insert([cleanPayload(payload)])
    .select(NOTE_SELECT_V2)
    .maybeSingle();

  if (error) {
    if (
      isMissingPreparationNotesSchemaError(error) ||
      isMissingPreparationNotesColumnError(error, ["task_id", "zone_id", "change_order_id", "document_id"])
    ) {
      throw new Error("Migration notes chantier non appliquee sur Supabase.");
    }
    throw error;
  }

  if (!data) throw new Error("Creation note OK mais ligne non retournee.");
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
    .select(NOTE_SELECT_V2)
    .maybeSingle();

  if (error) {
    if (
      isMissingPreparationNotesSchemaError(error) ||
      isMissingPreparationNotesColumnError(error, ["task_id", "zone_id", "change_order_id", "document_id"])
    ) {
      throw new Error("Migration notes chantier non appliquee sur Supabase.");
    }
    throw error;
  }

  if (!data) throw new Error("Mise a jour note OK mais ligne non retournee.");
  return normalizeNoteRow(data);
}

export async function deleteChantierPreparationNote(id: string): Promise<void> {
  if (!id) throw new Error("id note manquant.");
  const { error } = await fromPreparationNotes().delete().eq("id", id);
  if (error) {
    if (isMissingPreparationNotesSchemaError(error)) {
      throw new Error("Migration notes chantier non appliquee sur Supabase.");
    }
    throw error;
  }
}

