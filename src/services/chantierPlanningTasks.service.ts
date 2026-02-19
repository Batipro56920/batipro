import { supabase } from "../lib/supabaseClient";

export type PlanningTaskRow = {
  id: string;
  chantier_id: string;
  titre: string;
  status: string;
  corps_etat: string | null;
  lot: string | null;
  intervenant_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
  duration_days: number;
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanningTaskUpdateInput = Partial<
  Pick<PlanningTaskRow, "duration_days" | "order_index" | "corps_etat" | "lot" | "intervenant_id">
>;

export type PlanningTasksFetchResult = {
  tasks: PlanningTaskRow[];
  planningColumnsMissing: boolean;
  expectedPlanningColumns: ["duration_days", "order_index"];
};

const TASK_SELECT_V2 =
  "id, chantier_id, titre, status, corps_etat, lot, intervenant_id, date_debut, date_fin, duration_days, order_index, created_at, updated_at";
const TASK_SELECT_LEGACY =
  "id, chantier_id, titre, status, corps_etat, lot, intervenant_id, date_debut, date_fin, created_at, updated_at";

function safeInt(value: number | null | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function mapTask(row: any): PlanningTaskRow {
  const lotRaw = String(row.lot ?? "").trim();
  const corpsEtatRaw = String(row.corps_etat ?? "").trim();
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    titre: String(row.titre ?? ""),
    status: String(row.status ?? "A_FAIRE"),
    corps_etat: corpsEtatRaw || null,
    lot: lotRaw || null,
    intervenant_id: row.intervenant_id ?? null,
    date_debut: row.date_debut ?? null,
    date_fin: row.date_fin ?? null,
    duration_days: Math.max(1, safeInt(row.duration_days, 1)),
    order_index: Math.max(0, safeInt(row.order_index, 0)),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function cleanLot(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function getTaskLotName(task: Pick<PlanningTaskRow, "lot" | "corps_etat">): string {
  const lot = String(task.lot ?? "").trim();
  if (lot) return lot;
  const corpsEtat = String(task.corps_etat ?? "").trim();
  if (corpsEtat) return corpsEtat;
  return "A classer";
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

export async function listPlanningTasksByChantierDetailed(chantierId: string): Promise<PlanningTasksFetchResult> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_V2)
    .eq("chantier_id", chantierId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!first.error) {
    return {
      tasks: (first.data ?? []).map(mapTask),
      planningColumnsMissing: false,
      expectedPlanningColumns: ["duration_days", "order_index"],
    };
  }
  if (!isMissingTaskPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const fallback = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_LEGACY)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: true });

  if (fallback.error) throw new Error(fallback.error.message);
  return {
    tasks: (fallback.data ?? []).map(mapTask),
    planningColumnsMissing: true,
    expectedPlanningColumns: ["duration_days", "order_index"],
  };
}

export async function listPlanningTasksByChantier(chantierId: string): Promise<PlanningTaskRow[]> {
  const result = await listPlanningTasksByChantierDetailed(chantierId);
  return result.tasks;
}

export async function updatePlanningTask(id: string, patch: PlanningTaskUpdateInput): Promise<PlanningTaskRow> {
  if (!id) throw new Error("ID tache manquant.");

  const payload: Record<string, unknown> = {};
  if (patch.duration_days !== undefined) {
    payload.duration_days = Math.max(1, safeInt(patch.duration_days, 1));
  }
  if (patch.order_index !== undefined) {
    payload.order_index = Math.max(0, safeInt(patch.order_index, 0));
  }
  if (patch.corps_etat !== undefined) {
    payload.corps_etat = cleanLot(patch.corps_etat);
  }
  if (patch.lot !== undefined) {
    payload.lot = cleanLot(patch.lot);
  }
  if (patch.intervenant_id !== undefined) {
    payload.intervenant_id = patch.intervenant_id || null;
  }

  const first = await supabase
    .from("chantier_tasks")
    .update(payload as any)
    .eq("id", id)
    .select(TASK_SELECT_V2)
    .maybeSingle();

  if (!first.error) {
    if (!first.data) throw new Error("Tache introuvable.");
    return mapTask(first.data);
  }
  if (!isMissingTaskPlanningColumnsError(first.error)) throw new Error(first.error.message);

  throw new Error(
    "Migration planning manquante sur Supabase. Colonnes attendues sur public.chantier_tasks: duration_days, order_index.",
  );
}

export async function bulkUpdatePlanningTasks(
  patches: Array<{ id: string; duration_days?: number; order_index?: number }>,
): Promise<void> {
  for (const patch of patches) {
    await updatePlanningTask(patch.id, {
      duration_days: patch.duration_days,
      order_index: patch.order_index,
    });
  }
}

