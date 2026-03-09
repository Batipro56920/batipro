import { supabase } from "../lib/supabaseClient";
import { getChantierById, updateChantier, type ChantierRow } from "./chantiers.service";
import {
  clampDurationDays,
  computeEndDate,
  computePlannedHours,
  encodeWorkingDays,
  formatDateKey,
  parseWorkingDays,
  type PlanningCalendarSettings,
} from "../components/chantiers/planningCalendar.utils";

function segmentsTable() {
  return (supabase as any).from("chantier_task_segments");
}

export type PlanningCalendarTask = {
  id: string;
  chantier_id: string;
  titre: string;
  status: string;
  lot: string | null;
  corps_etat: string | null;
  intervenant_id: string | null;
  quantite: number | null;
  unite: string | null;
  temps_prevu_h: number | null;
  planned_duration_days: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanningCalendarSegment = {
  id: string;
  chantier_id: string;
  task_id: string;
  intervenant_id: string | null;
  start_date: string;
  duration_days: number;
  order_in_day: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanningCalendarState = {
  chantier: ChantierRow;
  settings: PlanningCalendarSettings;
  tasks: PlanningCalendarTask[];
  segments: PlanningCalendarSegment[];
  mergedMetaSupported: boolean;
  planningColumnsMissing: boolean;
  segmentColumnsMissing: boolean;
};

export type PlanningTaskMutation = {
  titre?: string;
  status?: string;
  lot?: string | null;
  corps_etat?: string | null;
  intervenant_id?: string | null;
  quantite?: number | null;
  unite?: string | null;
  planned_duration_days?: number;
};

export type PlanningSegmentMutation = {
  start_date?: string;
  duration_days?: number;
  order_in_day?: number;
  intervenant_id?: string | null;
};

const TASK_SELECT_WITH_PLANNED_DURATION = [
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
  "planned_duration_days",
  "duration_days",
  "created_at",
  "updated_at",
].join(",");

const TASK_SELECT_BASE = [
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
  "duration_days",
  "created_at",
  "updated_at",
].join(",");

const SEGMENT_SELECT_V2 = [
  "id",
  "chantier_id",
  "task_id",
  "intervenant_id",
  "start_date",
  "duration_days",
  "order_in_day",
  "created_at",
  "updated_at",
].join(",");

const SEGMENT_SELECT_LEGACY = [
  "id",
  "chantier_id",
  "task_id",
  "intervenant_id",
  "start_at",
  "end_at",
  "created_at",
  "updated_at",
].join(",");

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingColumn(error: any, column: string): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "42703" || msg.includes(column.toLowerCase());
}

function isMissingTable(error: any, tableName: string): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return code === "42p01" || msg.includes(tableName.toLowerCase());
}

function toDateKeyFromIso(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10) return null;
  const raw = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return formatDateKey(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKeyToIso(dateKey: string, hourUtc: number): string {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, Math.max(0, (month || 1) - 1), day || 1, hourUtc, 0, 0)).toISOString();
}

function mapTask(row: any): PlanningCalendarTask {
  const planned = clampDurationDays(normalizeNumber(row.planned_duration_days) ?? normalizeNumber(row.duration_days) ?? 1);
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    titre: String(row.titre ?? ""),
    status: String(row.status ?? "A_FAIRE"),
    lot: row.lot ?? null,
    corps_etat: row.corps_etat ?? null,
    intervenant_id: row.intervenant_id ?? null,
    quantite: normalizeNumber(row.quantite),
    unite: row.unite ?? null,
    temps_prevu_h: normalizeNumber(row.temps_prevu_h),
    planned_duration_days: planned,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapSegmentV2(row: any): PlanningCalendarSegment {
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    task_id: String(row.task_id),
    intervenant_id: row.intervenant_id ?? null,
    start_date: String(row.start_date),
    duration_days: clampDurationDays(normalizeNumber(row.duration_days) ?? 1),
    order_in_day: Math.max(0, Math.trunc(normalizeNumber(row.order_in_day) ?? 0)),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapSegmentLegacy(row: any): PlanningCalendarSegment {
  const startDate = toDateKeyFromIso(row.start_at) ?? formatDateKey(new Date());
  const startAt = Date.parse(String(row.start_at ?? ""));
  const endAt = Date.parse(String(row.end_at ?? ""));
  const diffDays = Number.isFinite(startAt) && Number.isFinite(endAt) && endAt > startAt ? (endAt - startAt) / 86400000 : 1;

  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    task_id: String(row.task_id),
    intervenant_id: row.intervenant_id ?? null,
    start_date: startDate,
    duration_days: clampDurationDays(diffDays),
    order_in_day: 0,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
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

function buildTaskPayload(patch: PlanningTaskMutation, settings: PlanningCalendarSettings): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.titre !== undefined) payload.titre = patch.titre.trim();
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.lot !== undefined) payload.lot = patch.lot;
  if (patch.corps_etat !== undefined) payload.corps_etat = patch.corps_etat;
  if (patch.intervenant_id !== undefined) payload.intervenant_id = patch.intervenant_id;
  if (patch.quantite !== undefined) payload.quantite = patch.quantite;
  if (patch.unite !== undefined) payload.unite = patch.unite;

  if (patch.planned_duration_days !== undefined) {
    const nextDuration = clampDurationDays(patch.planned_duration_days);
    payload.planned_duration_days = nextDuration;
    payload.duration_days = nextDuration;
    payload.temps_prevu_h = computePlannedHours(nextDuration, settings);
  }

  return payload;
}

function buildSegmentPayload(
  patch: PlanningSegmentMutation,
  settings: PlanningCalendarSettings,
  baseline?: { start_date: string; duration_days: number },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const nextStart = patch.start_date ?? baseline?.start_date;
  const nextDuration = clampDurationDays(patch.duration_days ?? baseline?.duration_days ?? 1);

  if (patch.start_date !== undefined) payload.start_date = patch.start_date;
  if (patch.duration_days !== undefined) payload.duration_days = nextDuration;
  if (patch.order_in_day !== undefined) payload.order_in_day = Math.max(0, Math.trunc(patch.order_in_day));
  if (patch.intervenant_id !== undefined) payload.intervenant_id = patch.intervenant_id;

  if (nextStart) {
    payload.start_at = dateKeyToIso(nextStart, 8);
    payload.end_at = dateKeyToIso(computeEndDate(nextStart, nextDuration, settings), 18);
  }

  return payload;
}

async function fetchTasks(chantierId: string): Promise<{ tasks: PlanningCalendarTask[]; planningColumnsMissing: boolean }> {
  const first = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_WITH_PLANNED_DURATION)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: true });

  if (!first.error) {
    return {
      tasks: (first.data ?? []).map(mapTask),
      planningColumnsMissing: false,
    };
  }
  if (!isMissingColumn(first.error, "planned_duration_days")) {
    throw new Error(first.error.message);
  }

  const second = await supabase
    .from("chantier_tasks")
    .select(TASK_SELECT_BASE)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: true });

  if (second.error) throw new Error(second.error.message);

  return {
    tasks: (second.data ?? []).map(mapTask),
    planningColumnsMissing: true,
  };
}

async function fetchSegments(chantierId: string): Promise<{ segments: PlanningCalendarSegment[]; segmentColumnsMissing: boolean }> {
  const first = await supabase
    .from("chantier_task_segments" as any)
    .select(SEGMENT_SELECT_V2)
    .eq("chantier_id", chantierId)
    .order("start_date", { ascending: true })
    .order("order_in_day", { ascending: true })
    .order("created_at", { ascending: true });

  if (!first.error) {
    return {
      segments: (first.data ?? []).map(mapSegmentV2),
      segmentColumnsMissing: false,
    };
  }

  if (isMissingTable(first.error, "chantier_task_segments")) {
    return { segments: [], segmentColumnsMissing: true };
  }

  if (!isMissingColumn(first.error, "start_date") && !isMissingColumn(first.error, "duration_days") && !isMissingColumn(first.error, "order_in_day")) {
    throw new Error(first.error.message);
  }

  const second = await supabase
    .from("chantier_task_segments" as any)
    .select(SEGMENT_SELECT_LEGACY)
    .eq("chantier_id", chantierId)
    .order("start_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (second.error) throw new Error(second.error.message);

  const legacy = (second.data ?? []).map(mapSegmentLegacy);
  const orderByDay = new Map<string, number>();
  const normalized = legacy.map((segment) => {
    const key = segment.start_date;
    const next = orderByDay.get(key) ?? 0;
    orderByDay.set(key, next + 1);
    return { ...segment, order_in_day: next };
  });

  return {
    segments: normalized,
    segmentColumnsMissing: true,
  };
}

export async function getPlanningCalendarState(chantierId: string): Promise<PlanningCalendarState> {
  const chantier = await getChantierById(chantierId);
  const [tasksResult, segmentsResult] = await Promise.all([fetchTasks(chantierId), fetchSegments(chantierId)]);

  return {
    chantier,
    settings: toSettings(chantier),
    tasks: tasksResult.tasks,
    segments: segmentsResult.segments,
    mergedMetaSupported: false,
    planningColumnsMissing: tasksResult.planningColumnsMissing,
    segmentColumnsMissing: segmentsResult.segmentColumnsMissing,
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
): Promise<PlanningCalendarTask> {
  const payload = {
    chantier_id: chantierId,
    status: patch.status ?? "A_FAIRE",
    ...buildTaskPayload(patch, settings),
  };

  const first = await supabase.from("chantier_tasks").insert([payload]).select(TASK_SELECT_WITH_PLANNED_DURATION).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Tache creee mais non retournee.");
    return mapTask(first.data);
  }

  if (!isMissingColumn(first.error, "planned_duration_days")) {
    throw new Error(first.error.message);
  }

  const fallbackPayload = { ...payload };
  delete (fallbackPayload as any).planned_duration_days;

  const second = await supabase.from("chantier_tasks").insert([fallbackPayload]).select(TASK_SELECT_BASE).maybeSingle();
  if (second.error) throw new Error(second.error.message);
  if (!second.data) throw new Error("Tache creee mais non retournee.");
  return mapTask(second.data);
}

export async function updatePlanningCalendarTask(
  taskId: string,
  patch: PlanningTaskMutation,
  settings: PlanningCalendarSettings,
  _allowMergedMeta: boolean,
): Promise<PlanningCalendarTask> {
  const payload = buildTaskPayload(patch, settings);

  const first = await supabase.from("chantier_tasks").update(payload).eq("id", taskId).select(TASK_SELECT_WITH_PLANNED_DURATION).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Tache introuvable.");
    return mapTask(first.data);
  }

  if (!isMissingColumn(first.error, "planned_duration_days")) {
    throw new Error(first.error.message);
  }

  const fallbackPayload = { ...payload };
  delete (fallbackPayload as any).planned_duration_days;

  const second = await supabase.from("chantier_tasks").update(fallbackPayload).eq("id", taskId).select(TASK_SELECT_BASE).maybeSingle();
  if (second.error) throw new Error(second.error.message);
  if (!second.data) throw new Error("Tache introuvable.");
  return mapTask(second.data);
}

export async function deletePlanningCalendarTasks(taskIds: string[]): Promise<void> {
  const ids = taskIds.filter(Boolean);
  if (!ids.length) return;
  const { error } = await supabase.from("chantier_tasks").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function createPlanningCalendarSegment(
  chantierId: string,
  taskId: string,
  patch: PlanningSegmentMutation,
  settings: PlanningCalendarSettings,
): Promise<PlanningCalendarSegment> {
  const startDate = patch.start_date;
  if (!startDate) throw new Error("date_debut_segment_requise");

  const payload = {
    chantier_id: chantierId,
    task_id: taskId,
    ...buildSegmentPayload({
      start_date: startDate,
      duration_days: patch.duration_days ?? 1,
      order_in_day: patch.order_in_day ?? 0,
      intervenant_id: patch.intervenant_id,
    }, settings),
  };

  const first = await segmentsTable().insert([payload]).select(SEGMENT_SELECT_V2).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Segment cree mais non retourne.");
    return mapSegmentV2(first.data);
  }

  if (!isMissingColumn(first.error, "start_date") && !isMissingColumn(first.error, "duration_days") && !isMissingColumn(first.error, "order_in_day")) {
    throw new Error(first.error.message);
  }

  const fallbackPayload = { ...payload };
  delete (fallbackPayload as any).start_date;
  delete (fallbackPayload as any).duration_days;
  delete (fallbackPayload as any).order_in_day;

  const second = await segmentsTable().insert([fallbackPayload]).select(SEGMENT_SELECT_LEGACY).maybeSingle();
  if (second.error) throw new Error(second.error.message);
  if (!second.data) throw new Error("Segment cree mais non retourne.");
  return mapSegmentLegacy(second.data);
}

export async function updatePlanningCalendarSegment(
  segmentId: string,
  patch: PlanningSegmentMutation,
  settings: PlanningCalendarSettings,
  baseline?: { start_date: string; duration_days: number },
): Promise<PlanningCalendarSegment> {
  const payload = buildSegmentPayload(patch, settings, baseline);

  const first = await segmentsTable().update(payload).eq("id", segmentId).select(SEGMENT_SELECT_V2).maybeSingle();
  if (!first.error) {
    if (!first.data) throw new Error("Segment introuvable.");
    return mapSegmentV2(first.data);
  }

  if (!isMissingColumn(first.error, "start_date") && !isMissingColumn(first.error, "duration_days") && !isMissingColumn(first.error, "order_in_day")) {
    throw new Error(first.error.message);
  }

  const fallbackPayload = { ...payload };
  delete (fallbackPayload as any).start_date;
  delete (fallbackPayload as any).duration_days;
  delete (fallbackPayload as any).order_in_day;

  const second = await segmentsTable().update(fallbackPayload).eq("id", segmentId).select(SEGMENT_SELECT_LEGACY).maybeSingle();
  if (second.error) throw new Error(second.error.message);
  if (!second.data) throw new Error("Segment introuvable.");
  return mapSegmentLegacy(second.data);
}

export async function deletePlanningCalendarSegments(segmentIds: string[]): Promise<void> {
  const ids = segmentIds.filter(Boolean);
  if (!ids.length) return;
  const { error } = await segmentsTable().delete().in("id", ids);
  if (error) throw new Error(error.message);
}
