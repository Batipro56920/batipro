import { supabase } from "../lib/supabaseClient";
import { getChantierById, updateChantier, type ChantierRow } from "./chantiers.service";
import {
  clampDurationDays,
  computeEndDate,
  computePlannedHours,
  encodeWorkingDays,
  parseWorkingDays,
  type PlanningCalendarSettings,
} from "../components/chantiers/planningCalendar.utils";

export type PlanningCalendarTask = {
  id: string;
  chantier_id: string;
  titre: string;
  description: string | null;
  status: string;
  lot: string | null;
  corps_etat: string | null;
  intervenant_id: string | null;
  quantite: number | null;
  unite: string | null;
  temps_prevu_h: number | null;
  date_debut: string | null;
  date_fin: string | null;
  duration_days: number;
  order_index: number;
  merged_from_task_ids: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanningCalendarState = {
  chantier: ChantierRow;
  settings: PlanningCalendarSettings;
  tasks: PlanningCalendarTask[];
  mergedMetaSupported: boolean;
  planningColumnsMissing: boolean;
};

export type PlanningTaskMutation = {
  titre?: string;
  description?: string | null;
  status?: string;
  lot?: string | null;
  corps_etat?: string | null;
  intervenant_id?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  duration_days?: number;
  order_index?: number;
  quantite?: number | null;
  unite?: string | null;
  merged_from_task_ids?: string[] | null;
};

const TASK_SELECT_V3 = [
  "id",
  "chantier_id",
  "titre",
  "description",
  "status",
  "lot",
  "corps_etat",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "duration_days",
  "order_index",
  "merged_from_task_ids",
  "created_at",
  "updated_at",
].join(",");

const TASK_SELECT_V2 = [
  "id",
  "chantier_id",
  "titre",
  "description",
  "status",
  "lot",
  "corps_etat",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "duration_days",
  "order_index",
  "created_at",
  "updated_at",
].join(",");

const TASK_SELECT_LEGACY = [
  "id",
  "chantier_id",
  "titre",
  "status",
  "lot",
  "corps_etat",
  "intervenant_id",
  "quantite",
  "unite",
  "temps_prevu_h",
  "date_debut",
  "date_fin",
  "created_at",
  "updated_at",
].join(",");

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapTask(row: any): PlanningCalendarTask {
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    titre: String(row.titre ?? ""),
    description: row.description ?? null,
    status: String(row.status ?? "A_FAIRE"),
    lot: row.lot ?? null,
    corps_etat: row.corps_etat ?? null,
    intervenant_id: row.intervenant_id ?? null,
    quantite: normalizeNumber(row.quantite),
    unite: row.unite ?? null,
    temps_prevu_h: normalizeNumber(row.temps_prevu_h),
    date_debut: row.date_debut ?? null,
    date_fin: row.date_fin ?? null,
    duration_days: clampDurationDays(normalizeNumber(row.duration_days) ?? 1),
    order_index: Math.max(0, Math.trunc(normalizeNumber(row.order_index) ?? 0)),
    merged_from_task_ids: Array.isArray(row.merged_from_task_ids)
      ? row.merged_from_task_ids.filter((value: unknown): value is string => typeof value === "string")
      : null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function isMissingTaskPlanningColumnsError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (code === "42703") return true;
  if (!msg) return false;
  return (
    msg.includes("column") &&
    msg.includes("chantier_tasks") &&
    (msg.includes("duration_days") || msg.includes("order_index") || msg.includes("merged_from_task_ids"))
  );
}

function isMissingMergedMetaError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  return code === "42703" || msg.includes("merged_from_task_ids");
}

function toSettings(chantier: ChantierRow): PlanningCalendarSettings {
  const skipWeekends = Boolean(chantier.planning_skip_weekends ?? true);
  return {
    hoursPerDay: Math.max(1, Number(chantier.planning_hours_per_day ?? 7)),
    dayCapacity: Math.max(1, Number(chantier.planning_day_capacity ?? 3)),
    workingDays: parseWorkingDays(chantier.planning_working_days ?? null, skipWeekends),
    skipWeekends,
  };
}

function buildTaskPayload(
  patch: PlanningTaskMutation,
  settings: PlanningCalendarSettings,
  allowMergedMeta: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (patch.titre !== undefined) payload.titre = patch.titre.trim();
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.lot !== undefined) payload.lot = patch.lot;
  if (patch.corps_etat !== undefined) payload.corps_etat = patch.corps_etat;
  if (patch.intervenant_id !== undefined) payload.intervenant_id = patch.intervenant_id;
  if (patch.quantite !== undefined) payload.quantite = patch.quantite;
  if (patch.unite !== undefined) payload.unite = patch.unite;
  if (patch.order_index !== undefined) payload.order_index = Math.max(0, Math.trunc(patch.order_index));

  const duration = patch.duration_days !== undefined ? clampDurationDays(patch.duration_days) : undefined;
  const startDate = patch.date_debut !== undefined ? patch.date_debut : undefined;

  if (duration !== undefined) {
    payload.duration_days = duration;
    payload.temps_prevu_h = computePlannedHours(duration, settings);
  }
  if (startDate !== undefined) payload.date_debut = startDate;

  if (startDate && duration !== undefined) {
    payload.date_fin = computeEndDate(startDate, duration, settings);
  } else if (patch.date_fin !== undefined) {
    payload.date_fin = patch.date_fin;
  }

  if (allowMergedMeta && patch.merged_from_task_ids !== undefined) {
    payload.merged_from_task_ids = patch.merged_from_task_ids;
  }

  return payload;
}

export async function getPlanningCalendarState(chantierId: string): Promise<PlanningCalendarState> {
  const chantier = await getChantierById(chantierId);

  const first = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_V3)
    .eq("chantier_id", chantierId)
    .order("date_debut", { ascending: true, nullsFirst: true })
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!first.error) {
    return {
      chantier,
      settings: toSettings(chantier),
      tasks: (first.data ?? []).map(mapTask),
      mergedMetaSupported: true,
      planningColumnsMissing: false,
    };
  }
  if (!isMissingTaskPlanningColumnsError(first.error)) throw new Error(first.error.message);

  const second = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_V2)
    .eq("chantier_id", chantierId)
    .order("date_debut", { ascending: true, nullsFirst: true })
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (!second.error) {
    return {
      chantier,
      settings: toSettings(chantier),
      tasks: (second.data ?? []).map(mapTask),
      mergedMetaSupported: false,
      planningColumnsMissing: false,
    };
  }
  if (!isMissingTaskPlanningColumnsError(second.error)) throw new Error(second.error.message);

  const third = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_LEGACY)
    .eq("chantier_id", chantierId)
    .order("date_debut", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (third.error) throw new Error(third.error.message);
  return {
    chantier,
    settings: toSettings(chantier),
    tasks: (third.data ?? []).map(mapTask),
    mergedMetaSupported: false,
    planningColumnsMissing: true,
  };
}

export async function updatePlanningCalendarSettings(
  chantierId: string,
  patch: Partial<PlanningCalendarSettings>,
): Promise<ChantierRow> {
  const nextPatch: Partial<ChantierRow> = {};
  if (patch.hoursPerDay !== undefined) nextPatch.planning_hours_per_day = Math.max(1, Number(patch.hoursPerDay));
  if (patch.dayCapacity !== undefined) nextPatch.planning_day_capacity = Math.max(1, Number(patch.dayCapacity));
  if (patch.skipWeekends !== undefined) nextPatch.planning_skip_weekends = Boolean(patch.skipWeekends);
  if (patch.workingDays !== undefined) nextPatch.planning_working_days = encodeWorkingDays(patch.workingDays);
  return updateChantier(chantierId, nextPatch);
}

export async function createPlanningCalendarTask(
  chantierId: string,
  patch: PlanningTaskMutation,
  settings: PlanningCalendarSettings,
  allowMergedMeta: boolean,
): Promise<PlanningCalendarTask> {
  const payload = {
    chantier_id: chantierId,
    status: patch.status ?? "A_FAIRE",
    ...buildTaskPayload(patch, settings, allowMergedMeta),
  };

  const first = await supabase.from("chantier_tasks").insert([payload]).select(TASK_SELECT_V3).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Tache creee mais non retournee.");
    return mapTask(first.data);
  }
  if (!isMissingTaskPlanningColumnsError(first.error) && !(allowMergedMeta && isMissingMergedMetaError(first.error))) {
    throw new Error(first.error.message);
  }

  const fallbackPayload = { ...payload };
  delete (fallbackPayload as any).merged_from_task_ids;

  const second = await supabase.from("chantier_tasks").insert([fallbackPayload]).select(TASK_SELECT_V2).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Tache creee mais non retournee.");
    return mapTask(second.data);
  }
  if (!isMissingTaskPlanningColumnsError(second.error)) throw new Error(second.error.message);

  delete (fallbackPayload as any).duration_days;
  delete (fallbackPayload as any).order_index;

  const third = await supabase.from("chantier_tasks").insert([fallbackPayload]).select(TASK_SELECT_LEGACY).maybeSingle();
  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Tache creee mais non retournee.");
  return mapTask(third.data);
}

export async function updatePlanningCalendarTask(
  taskId: string,
  patch: PlanningTaskMutation,
  settings: PlanningCalendarSettings,
  allowMergedMeta: boolean,
): Promise<PlanningCalendarTask> {
  const payload = buildTaskPayload(patch, settings, allowMergedMeta);

  const first = await supabase.from("chantier_tasks").update(payload).eq("id", taskId).select(TASK_SELECT_V3).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Tache introuvable.");
    return mapTask(first.data);
  }
  if (!isMissingTaskPlanningColumnsError(first.error) && !(allowMergedMeta && isMissingMergedMetaError(first.error))) {
    throw new Error(first.error.message);
  }

  const fallbackPayload = { ...payload };
  delete (fallbackPayload as any).merged_from_task_ids;

  const second = await supabase.from("chantier_tasks").update(fallbackPayload).eq("id", taskId).select(TASK_SELECT_V2).maybeSingle();
  if (!second.error) {
    if (!second.data) throw new Error("Tache introuvable.");
    return mapTask(second.data);
  }
  if (!isMissingTaskPlanningColumnsError(second.error)) throw new Error(second.error.message);

  delete (fallbackPayload as any).duration_days;
  delete (fallbackPayload as any).order_index;

  const third = await supabase
    .from("chantier_tasks")
    .update(fallbackPayload)
    .eq("id", taskId)
    .select(TASK_SELECT_LEGACY)
    .maybeSingle();
  if (third.error) throw new Error(third.error.message);
  if (!third.data) throw new Error("Tache introuvable.");
  return mapTask(third.data);
}

export async function deletePlanningCalendarTasks(taskIds: string[]): Promise<void> {
  const ids = taskIds.filter(Boolean);
  if (!ids.length) return;
  const { error } = await supabase.from("chantier_tasks").delete().in("id", ids);
  if (error) throw new Error(error.message);
}
