// src/services/chantierTasks.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type TaskStatus = "A_FAIRE" | "EN_COURS" | "FAIT";

export type ChantierTaskRow = {
  id: string;
  chantier_id: string;

  titre: string;
  corps_etat: string | null;
  lot: string | null;
  date: string | null; // date prévue (ancienne logique)
  status: TaskStatus;

  intervenant_id: string | null;

  quantite: number | null;
  unite: string | null;
  temps_prevu_h: number | null;

  // ? TEMPS V1 (optionnel)
  date_debut: string | null; // YYYY-MM-DD
  date_fin: string | null; // YYYY-MM-DD
  temps_reel_h: number | null;
  duration_days: number;
  order_index: number;

  created_at?: string | null;
  updated_at?: string | null;
};

type CreateTaskPayload = {
  chantier_id: string;
  titre: string;
  corps_etat?: string | null;
  lot?: string | null;
  date?: string | null;
  status?: TaskStatus;
  intervenant_id?: string | null;

  quantite?: number | string | null;
  unite?: string | null;
  temps_prevu_h?: number | string | null;

  // ? TEMPS V1 (optionnel)
  date_debut?: string | null;
  date_fin?: string | null;
  temps_reel_h?: number | null;
  duration_days?: number | null;
  order_index?: number | null;
};

export type TaskPlanningColumnsStatus = {
  planningColumnsMissing: boolean;
  expectedPlanningColumns: ["duration_days", "order_index"];
};

export type ChantierTasksFetchResult = TaskPlanningColumnsStatus & {
  tasks: ChantierTaskRow[];
};

type UpdateTaskPatch = Partial<
  Pick<
    ChantierTaskRow,
    | "titre"
    | "corps_etat"
    | "lot"
    | "date"
    | "status"
    | "intervenant_id"
    | "quantite"
    | "unite"
    | "temps_prevu_h"
    | "date_debut"
    | "date_fin"
    | "temps_reel_h"
    | "duration_days"
    | "order_index"
  >
>;

const TASK_SELECT = [
  "id",
  "chantier_id",
  "titre",
  "corps_etat",
  "lot",
  "date",
  "status",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "temps_reel_h",
  "duration_days",
  "order_index",
  "created_at",
  "updated_at",
].join(",");

const TASK_SELECT_LEGACY = [
  "id",
  "chantier_id",
  "titre",
  "corps_etat",
  "lot",
  "date",
  "status",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "temps_reel_h",
  "created_at",
  "updated_at",
].join(",");

/* =========================================================
   HELPERS
   ========================================================= */

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const raw = value.trim().replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return null;
}

function cleanPatch(patch: UpdateTaskPatch) {
  const cleaned: any = { ...patch };

  // chaînes
  if (typeof cleaned.titre === "string") cleaned.titre = cleaned.titre.trim();
  if (typeof cleaned.corps_etat === "string") cleaned.corps_etat = cleaned.corps_etat.trim();
  if (typeof cleaned.lot === "string") cleaned.lot = cleaned.lot.trim();
  if (typeof cleaned.unite === "string") cleaned.unite = cleaned.unite.trim();

  // vides -> null
  if (cleaned.corps_etat === "") cleaned.corps_etat = null;
  if (cleaned.lot === "") cleaned.lot = null;
  if (cleaned.date === "") cleaned.date = null;
  if (cleaned.date_debut === "") cleaned.date_debut = null;
  if (cleaned.date_fin === "") cleaned.date_fin = null;
  if (cleaned.intervenant_id === "") cleaned.intervenant_id = null;
  if (cleaned.unite === "") cleaned.unite = null;
  if (cleaned.lot !== undefined && cleaned.corps_etat === undefined) cleaned.corps_etat = cleaned.lot;
  if (cleaned.corps_etat !== undefined && cleaned.lot === undefined) cleaned.lot = cleaned.corps_etat;

  // temps réel
  if (cleaned.temps_reel_h !== undefined) {
    cleaned.temps_reel_h = normalizeNumber(cleaned.temps_reel_h);
  }

  if (cleaned.quantite !== undefined) {
    cleaned.quantite = normalizeNumber(cleaned.quantite);
  }
  if (cleaned.temps_prevu_h !== undefined) {
    cleaned.temps_prevu_h = normalizeNumber(cleaned.temps_prevu_h);
  }
  if (cleaned.duration_days !== undefined) {
    const duration = normalizeNumber(cleaned.duration_days);
    cleaned.duration_days = duration === null ? 1 : Math.max(1, Math.trunc(duration));
  }
  if (cleaned.order_index !== undefined) {
    const orderIndex = normalizeNumber(cleaned.order_index);
    cleaned.order_index = orderIndex === null ? 0 : Math.max(0, Math.trunc(orderIndex));
  }

  // aucune obligation demandée par toi,
  // mais on garde une petite sécurité: si titre fourni, il ne doit pas être vide
  if (cleaned.titre !== undefined && !cleaned.titre) {
    throw new Error("Le titre ne peut pas être vide.");
  }

  return cleaned as UpdateTaskPatch;
}

function normalizeTaskRow(row: any): ChantierTaskRow {
  return {
    ...row,
    duration_days: Math.max(1, Number(row?.duration_days ?? 1)),
    order_index: Math.max(0, Math.trunc(Number(row?.order_index ?? 0))),
  } as ChantierTaskRow;
}

function isMissingTaskPlanningColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  if (!msg) return false;
  return (
    msg.includes("column") &&
    msg.includes("chantier_tasks") &&
    (msg.includes("duration_days") || msg.includes("order_index"))
  );
}

/* =========================================================
   QUERIES
   ========================================================= */

export async function getTasksByChantierIdDetailed(chantierId: string): Promise<ChantierTasksFetchResult> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (!first.error) {
    return {
      tasks: (first.data ?? []).map(normalizeTaskRow),
      planningColumnsMissing: false,
      expectedPlanningColumns: ["duration_days", "order_index"],
    };
  }
  if (!isMissingTaskPlanningColumnsError(first.error)) throw first.error;

  const fallback = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_LEGACY)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });
  if (fallback.error) throw fallback.error;
  return {
    tasks: (fallback.data ?? []).map(normalizeTaskRow),
    planningColumnsMissing: true,
    expectedPlanningColumns: ["duration_days", "order_index"],
  };
}

export async function getTasksByChantierId(chantierId: string): Promise<ChantierTaskRow[]> {
  const result = await getTasksByChantierIdDetailed(chantierId);
  return result.tasks;
}

export async function createTask(payload: CreateTaskPayload) {
  const chantier_id = payload?.chantier_id;
  const titre = (payload?.titre ?? "").trim();

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!titre) throw new Error("titre manquant.");

  const quantiteValue = normalizeNumber(payload.quantite);
  const tempsPrevuValue = normalizeNumber(payload.temps_prevu_h);

  const insertRow: any = {
    chantier_id,
    titre,
    corps_etat: payload.corps_etat ?? payload.lot ?? null,
    lot: payload.lot ?? payload.corps_etat ?? null,
    date: payload.date ?? null,
    status: payload.status ?? "A_FAIRE",
    intervenant_id: payload.intervenant_id ?? null,
    quantite: quantiteValue === null ? 1 : quantiteValue,
    unite: (payload.unite ?? "").trim() || null,
    temps_prevu_h: tempsPrevuValue ?? null,

    // ? temps (optionnel)
    date_debut: payload.date_debut ?? null,
    date_fin: payload.date_fin ?? null,
    temps_reel_h: payload.temps_reel_h ?? null,
    duration_days: Math.max(1, Math.trunc(normalizeNumber(payload.duration_days) ?? 1)),
    order_index: Math.max(0, Math.trunc(normalizeNumber(payload.order_index) ?? 0)),
  };

  const first = await supabase
    .from("chantier_tasks")
    .insert([insertRow])
    .select(TASK_SELECT)
    .single();

  if (!first.error) return normalizeTaskRow(first.data);
  if (!isMissingTaskPlanningColumnsError(first.error)) throw first.error;

  const legacyInsert = { ...insertRow };
  delete legacyInsert.duration_days;
  delete legacyInsert.order_index;

  const fallback = await supabase
    .from("chantier_tasks")
    .insert([legacyInsert])
    .select(TASK_SELECT_LEGACY)
    .single();

  if (fallback.error) throw fallback.error;
  return normalizeTaskRow(fallback.data);
}

export async function updateTask(id: string, patch: UpdateTaskPatch) {
  if (!id) throw new Error("id tâche manquant.");

  const cleaned = cleanPatch(patch);

  const first = await supabase
    .from("chantier_tasks")
    .update(cleaned as any)
    .eq("id", id)
    .select(TASK_SELECT)
    .single();

  if (!first.error) return normalizeTaskRow(first.data);
  if (!isMissingTaskPlanningColumnsError(first.error)) throw first.error;

  const legacyPatch: Record<string, unknown> = { ...cleaned };
  delete legacyPatch.duration_days;
  delete legacyPatch.order_index;

  const fallback = await supabase
    .from("chantier_tasks")
    .update(legacyPatch as any)
    .eq("id", id)
    .select(TASK_SELECT_LEGACY)
    .single();

  if (fallback.error) throw fallback.error;
  return normalizeTaskRow(fallback.data);
}

export async function deleteTasksByIds(taskIds: string[]): Promise<void> {
  const ids = (taskIds ?? []).filter(Boolean);
  if (!ids.length) return;

  const { error } = await supabase.from("chantier_tasks").delete().in("id", ids);
  if (error) throw error;
}



