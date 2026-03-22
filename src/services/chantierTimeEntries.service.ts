import { supabase } from "../lib/supabaseClient";

export type ChantierTimeEntryRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  intervenant_id: string;
  work_date: string;
  duration_hours: number | null;
  quantite_realisee: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CreateChantierTimeEntryPayload = {
  chantier_id: string;
  task_id: string;
  intervenant_id: string;
  work_date: string;
  duration_hours: number;
  quantite_realisee?: number | null;
  note?: string | null;
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMissingColumnError(error: { message?: string; code?: string } | null, columns: string[]): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code !== "42703" && !message.includes("column")) return false;
  return columns.some((column) => message.includes(column.toLowerCase()));
}

function mapRow(row: any): ChantierTimeEntryRow {
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    task_id: normalizeText(row.task_id),
    intervenant_id: String(row.intervenant_id ?? ""),
    work_date: String(row.work_date ?? ""),
    duration_hours: normalizeNumber(row.duration_hours),
    quantite_realisee: normalizeNumber(row.quantite_realisee),
    note: normalizeText(row.note),
    created_at: normalizeText(row.created_at),
    updated_at: normalizeText(row.updated_at),
  };
}

export async function listChantierTimeEntriesByChantierId(chantierId: string): Promise<ChantierTimeEntryRow[]> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const selectV2 =
    "id, chantier_id, task_id, intervenant_id, work_date, duration_hours, quantite_realisee, note, created_at, updated_at";
  const selectV1 = "id, chantier_id, task_id, intervenant_id, work_date, duration_hours, note, created_at, updated_at";

  const first = await supabase
    .from("chantier_time_entries" as any)
    .select(selectV2)
    .eq("chantier_id", chantierId)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (first.error) {
    if (!isMissingColumnError(first.error, ["quantite_realisee", "updated_at"])) throw first.error;

    const fallback = await supabase
      .from("chantier_time_entries" as any)
      .select(selectV1)
      .eq("chantier_id", chantierId)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => mapRow(row));
  }

  return (first.data ?? []).map((row) => mapRow(row));
}

export async function createChantierTimeEntry(payload: CreateChantierTimeEntryPayload): Promise<ChantierTimeEntryRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");
  if (!payload.task_id) throw new Error("task_id manquant.");
  if (!payload.intervenant_id) throw new Error("intervenant_id manquant.");

  const hours = normalizeNumber(payload.duration_hours);
  if (hours === null || hours <= 0) throw new Error("Durée invalide.");

  const quantity = normalizeNumber(payload.quantite_realisee);
  const insertRow = {
    chantier_id: payload.chantier_id,
    task_id: payload.task_id,
    intervenant_id: payload.intervenant_id,
    work_date: payload.work_date,
    duration_hours: hours,
    quantite_realisee: quantity,
    note: normalizeText(payload.note),
  };

  const selectV2 =
    "id, chantier_id, task_id, intervenant_id, work_date, duration_hours, quantite_realisee, note, created_at, updated_at";
  const selectV1 = "id, chantier_id, task_id, intervenant_id, work_date, duration_hours, note, created_at, updated_at";

  const first = await (supabase as any).from("chantier_time_entries").insert([insertRow]).select(selectV2).single();
  if (first.error) {
    if (!isMissingColumnError(first.error, ["quantite_realisee", "updated_at"])) throw first.error;

    const legacyInsert = { ...insertRow };
    delete (legacyInsert as Record<string, unknown>).quantite_realisee;

    const fallback = await supabase
      .from("chantier_time_entries" as any)
      .insert([legacyInsert])
      .select(selectV1)
      .single();

    if (fallback.error) throw fallback.error;
    return mapRow(fallback.data);
  }

  return mapRow(first.data);
}

export async function deleteChantierTimeEntry(id: string): Promise<void> {
  if (!id) throw new Error("id saisie temps manquant.");
  const { error } = await (supabase as any).from("chantier_time_entries").delete().eq("id", id);
  if (error) throw error;
}
