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
  titre_terrain: string | null;
  libelle_devis_original: string | null;
  status: string;
  lot: string | null;
  corps_etat: string | null;
  intervenant_id: string | null;
  quantite: number | null;
  unite: string | null;
  temps_prevu_h: number | null;
  temps_reel_h: number | null;
  planned_duration_days: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanningCalendarSegment = {
  id: string;
  chantier_id: string;
  task_id: string;
  intervenant_id: string | null;
  title_override: string | null;
  progress_percent: number | null;
  status: string | null;
  comment: string | null;
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
  title_override?: string | null;
  progress_percent?: number | null;
  status?: string | null;
  comment?: string | null;
};

const TASK_BASE_COLUMNS = [
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
  "temps_reel_h",
  "duration_days",
  "created_at",
  "updated_at",
];

const TASK_OPTIONAL_COLUMNS = {
  titreTerrain: ["titre_terrain", "libelle_devis_original"],
  plannedDuration: ["planned_duration_days"],
} as const;

const SEGMENT_BASE_COLUMNS = [
  "id",
  "chantier_id",
  "task_id",
  "intervenant_id",
  "start_date",
  "duration_days",
  "order_in_day",
  "created_at",
  "updated_at",
];

const SEGMENT_OPTIONAL_COLUMNS = {
  titleOverride: "title_override",
  progressPercent: "progress_percent",
  status: "status",
  comment: "comment",
} as const;

let planningTaskSupport: { titreTerrain: boolean | null; plannedDuration: boolean | null } = {
  titreTerrain: null,
  plannedDuration: null,
};

let planningSegmentSupport: {
  titleOverride: boolean | null;
  progressPercent: boolean | null;
  status: boolean | null;
  comment: boolean | null;
} = {
  titleOverride: null,
  progressPercent: null,
  status: null,
  comment: null,
};

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

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function buildTaskSelect(): string {
  const columns = [...TASK_BASE_COLUMNS];
  if (planningTaskSupport.titreTerrain !== false) columns.splice(3, 0, ...TASK_OPTIONAL_COLUMNS.titreTerrain);
  if (planningTaskSupport.plannedDuration !== false) columns.splice(columns.indexOf("duration_days"), 0, ...TASK_OPTIONAL_COLUMNS.plannedDuration);
  return columns.join(",");
}

function markTaskSupportMissing(column: string): boolean {
  if ((column === "titre_terrain" || column === "libelle_devis_original") && planningTaskSupport.titreTerrain !== false) {
    planningTaskSupport = { ...planningTaskSupport, titreTerrain: false };
    return true;
  }
  if (column === "planned_duration_days" && planningTaskSupport.plannedDuration !== false) {
    planningTaskSupport = { ...planningTaskSupport, plannedDuration: false };
    return true;
  }
  return false;
}

function confirmTaskSupport(select: string) {
  if (planningTaskSupport.titreTerrain === null && select.includes("titre_terrain")) {
    planningTaskSupport = { ...planningTaskSupport, titreTerrain: true };
  }
  if (planningTaskSupport.plannedDuration === null && select.includes("planned_duration_days")) {
    planningTaskSupport = { ...planningTaskSupport, plannedDuration: true };
  }
}

function stripUnsupportedTaskPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  if (planningTaskSupport.plannedDuration === false) delete next.planned_duration_days;
  return next;
}

function buildSegmentSelect(): string {
  const columns = [...SEGMENT_BASE_COLUMNS];
  for (const [key, column] of Object.entries(SEGMENT_OPTIONAL_COLUMNS) as Array<[keyof typeof SEGMENT_OPTIONAL_COLUMNS, string]>) {
    if (planningSegmentSupport[key] !== false) {
      columns.splice(4, 0, column);
    }
  }
  return columns.join(",");
}

function stripUnsupportedSegmentPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  if (planningSegmentSupport.titleOverride === false) delete next.title_override;
  if (planningSegmentSupport.progressPercent === false) delete next.progress_percent;
  if (planningSegmentSupport.status === false) delete next.status;
  if (planningSegmentSupport.comment === false) delete next.comment;
  return next;
}

function markSegmentSupportMissing(column: string): boolean {
  if (column === "title_override" && planningSegmentSupport.titleOverride !== false) {
    planningSegmentSupport = { ...planningSegmentSupport, titleOverride: false };
    return true;
  }
  if (column === "progress_percent" && planningSegmentSupport.progressPercent !== false) {
    planningSegmentSupport = { ...planningSegmentSupport, progressPercent: false };
    return true;
  }
  if (column === "status" && planningSegmentSupport.status !== false) {
    planningSegmentSupport = { ...planningSegmentSupport, status: false };
    return true;
  }
  if (column === "comment" && planningSegmentSupport.comment !== false) {
    planningSegmentSupport = { ...planningSegmentSupport, comment: false };
    return true;
  }
  return false;
}

function findMissingOptionalSegmentColumn(error: any): string | null {
  for (const column of Object.values(SEGMENT_OPTIONAL_COLUMNS)) {
    if (isMissingColumn(error, column)) return column;
  }
  return null;
}

function confirmSegmentSupport(select: string) {
  if (planningSegmentSupport.titleOverride === null && select.includes("title_override")) {
    planningSegmentSupport = { ...planningSegmentSupport, titleOverride: true };
  }
  if (planningSegmentSupport.progressPercent === null && select.includes("progress_percent")) {
    planningSegmentSupport = { ...planningSegmentSupport, progressPercent: true };
  }
  if (planningSegmentSupport.status === null && select.includes("status")) {
    planningSegmentSupport = { ...planningSegmentSupport, status: true };
  }
  if (planningSegmentSupport.comment === null && select.includes("comment")) {
    planningSegmentSupport = { ...planningSegmentSupport, comment: true };
  }
}

function mapTask(row: any): PlanningCalendarTask {
  const planned = clampDurationDays(normalizeNumber(row.planned_duration_days) ?? normalizeNumber(row.duration_days) ?? 1);
  const fallbackTitle =
    normalizeText(row.titre_terrain) ??
    normalizeText(row.titre) ??
    normalizeText(row.title) ??
    normalizeText(row.nom) ??
    normalizeText(row.libelle) ??
    "Tache sans titre";
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    titre: normalizeText(row.titre) ?? fallbackTitle,
    titre_terrain: normalizeText(row.titre_terrain),
    libelle_devis_original: normalizeText(row.libelle_devis_original),
    status: String(row.status ?? "A_FAIRE"),
    lot: row.lot ?? null,
    corps_etat: row.corps_etat ?? null,
    intervenant_id: row.intervenant_id ?? null,
    quantite: normalizeNumber(row.quantite),
    unite: row.unite ?? null,
    temps_prevu_h: normalizeNumber(row.temps_prevu_h),
    temps_reel_h: normalizeNumber(row.temps_reel_h),
    planned_duration_days: planned,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function mapSegment(row: any): PlanningCalendarSegment {
  return {
    id: String(row.id),
    chantier_id: String(row.chantier_id),
    task_id: String(row.task_id),
    intervenant_id: row.intervenant_id ?? null,
    title_override: normalizeText(row.title_override),
    progress_percent: normalizeNumber(row.progress_percent),
    status: normalizeText(row.status),
    comment: normalizeText(row.comment),
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
    title_override: null,
    progress_percent: null,
    status: null,
    comment: null,
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
  if (patch.title_override !== undefined) {
    const title = String(patch.title_override ?? "").trim();
    payload.title_override = title || null;
  }
  if (patch.progress_percent !== undefined) {
    const progress = normalizeNumber(patch.progress_percent);
    payload.progress_percent = progress === null ? null : Math.max(0, Math.min(100, progress));
  }
  if (patch.status !== undefined) {
    const status = normalizeText(patch.status);
    payload.status = status || null;
  }
  if (patch.comment !== undefined) {
    payload.comment = normalizeText(patch.comment);
  }

  if (nextStart) {
    payload.start_at = dateKeyToIso(nextStart, 8);
    payload.end_at = dateKeyToIso(computeEndDate(nextStart, nextDuration, settings), 18);
  }

  return payload;
}

async function fetchTasks(chantierId: string): Promise<{ tasks: PlanningCalendarTask[]; planningColumnsMissing: boolean }> {
  while (true) {
    const select = buildTaskSelect();
    const result = await supabase
      .from("chantier_tasks")
      .select(select)
      .eq("chantier_id", chantierId)
      .order("created_at", { ascending: true });

    if (!result.error) {
      confirmTaskSupport(select);
      return {
        tasks: (result.data ?? []).map(mapTask),
        planningColumnsMissing: planningTaskSupport.plannedDuration === false,
      };
    }

    if (isMissingColumn(result.error, "titre_terrain") && markTaskSupportMissing("titre_terrain")) continue;
    if (isMissingColumn(result.error, "libelle_devis_original") && markTaskSupportMissing("libelle_devis_original")) continue;
    if (isMissingColumn(result.error, "planned_duration_days") && markTaskSupportMissing("planned_duration_days")) continue;

    throw new Error(result.error.message);
  }
}

async function fetchSegments(chantierId: string): Promise<{ segments: PlanningCalendarSegment[]; segmentColumnsMissing: boolean }> {
  while (true) {
    const select = buildSegmentSelect();
    const result = await supabase
      .from("chantier_task_segments" as any)
      .select(select)
      .eq("chantier_id", chantierId)
      .order("start_date", { ascending: true })
      .order("order_in_day", { ascending: true })
      .order("created_at", { ascending: true });

    if (!result.error) {
      confirmSegmentSupport(select);
      return {
        segments: (result.data ?? []).map(mapSegment),
        segmentColumnsMissing: false,
      };
    }

    if (isMissingTable(result.error, "chantier_task_segments")) {
      return { segments: [], segmentColumnsMissing: true };
    }

    const missingOptional = findMissingOptionalSegmentColumn(result.error);
    if (missingOptional && markSegmentSupportMissing(missingOptional)) continue;

    if (!isMissingColumn(result.error, "start_date") && !isMissingColumn(result.error, "duration_days") && !isMissingColumn(result.error, "order_in_day")) {
      throw new Error(result.error.message);
    }

    const legacy = await supabase
      .from("chantier_task_segments" as any)
      .select(SEGMENT_SELECT_LEGACY)
      .eq("chantier_id", chantierId)
      .order("start_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (legacy.error) throw new Error(legacy.error.message);

    const normalizedLegacy = (legacy.data ?? []).map(mapSegmentLegacy);
    const orderByDay = new Map<string, number>();
    const normalized = normalizedLegacy.map((segment) => {
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

  while (true) {
    const select = buildTaskSelect();
    const insertPayload = stripUnsupportedTaskPayload(payload);
    const result = await supabase.from("chantier_tasks").insert([insertPayload]).select(select).maybeSingle();
    if (!result.error) {
      if (!result.data) throw new Error("Tache creee mais non retournee.");
      confirmTaskSupport(select);
      return mapTask(result.data);
    }

    if (isMissingColumn(result.error, "titre_terrain") && markTaskSupportMissing("titre_terrain")) continue;
    if (isMissingColumn(result.error, "libelle_devis_original") && markTaskSupportMissing("libelle_devis_original")) continue;
    if (isMissingColumn(result.error, "planned_duration_days") && markTaskSupportMissing("planned_duration_days")) continue;

    throw new Error(result.error.message);
  }
}

export async function updatePlanningCalendarTask(
  taskId: string,
  patch: PlanningTaskMutation,
  settings: PlanningCalendarSettings,
  _allowMergedMeta: boolean,
): Promise<PlanningCalendarTask> {
  const payload = buildTaskPayload(patch, settings);

  while (true) {
    const select = buildTaskSelect();
    const updatePayload = stripUnsupportedTaskPayload(payload);
    const result = await supabase.from("chantier_tasks").update(updatePayload).eq("id", taskId).select(select).maybeSingle();
    if (!result.error) {
      if (!result.data) throw new Error("Tache introuvable.");
      confirmTaskSupport(select);
      return mapTask(result.data);
    }

    if (isMissingColumn(result.error, "titre_terrain") && markTaskSupportMissing("titre_terrain")) continue;
    if (isMissingColumn(result.error, "libelle_devis_original") && markTaskSupportMissing("libelle_devis_original")) continue;
    if (isMissingColumn(result.error, "planned_duration_days") && markTaskSupportMissing("planned_duration_days")) continue;

    throw new Error(result.error.message);
  }
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
      title_override: patch.title_override,
      progress_percent: patch.progress_percent,
      status: patch.status,
      comment: patch.comment,
    }, settings),
  };

  while (true) {
    const insertPayload = stripUnsupportedSegmentPayload(payload);
    const select = buildSegmentSelect();
    const result = await segmentsTable().insert([insertPayload]).select(select).maybeSingle();
    if (!result.error) {
      if (!result.data) throw new Error("Segment cree mais non retourne.");
      confirmSegmentSupport(select);
      return mapSegment(result.data);
    }

    const missingOptional = findMissingOptionalSegmentColumn(result.error);
    if (missingOptional && markSegmentSupportMissing(missingOptional)) continue;

    if (!isMissingColumn(result.error, "start_date") && !isMissingColumn(result.error, "duration_days") && !isMissingColumn(result.error, "order_in_day")) {
      throw new Error(result.error.message);
    }

    const fallbackPayload = { ...payload };
    delete (fallbackPayload as any).start_date;
    delete (fallbackPayload as any).duration_days;
    delete (fallbackPayload as any).order_in_day;
    delete (fallbackPayload as any).title_override;
    delete (fallbackPayload as any).progress_percent;
    delete (fallbackPayload as any).status;
    delete (fallbackPayload as any).comment;

    const second = await segmentsTable().insert([fallbackPayload]).select(SEGMENT_SELECT_LEGACY).maybeSingle();
    if (second.error) throw new Error(second.error.message);
    if (!second.data) throw new Error("Segment cree mais non retourne.");
    return mapSegmentLegacy(second.data);
  }
}

export async function updatePlanningCalendarSegment(
  segmentId: string,
  patch: PlanningSegmentMutation,
  settings: PlanningCalendarSettings,
  baseline?: { start_date: string; duration_days: number },
): Promise<PlanningCalendarSegment> {
  const payload = buildSegmentPayload(patch, settings, baseline);

  while (true) {
    const updatePayload = stripUnsupportedSegmentPayload(payload);
    const select = buildSegmentSelect();
    const result = await segmentsTable().update(updatePayload).eq("id", segmentId).select(select).maybeSingle();
    if (!result.error) {
      if (!result.data) throw new Error("Segment introuvable.");
      confirmSegmentSupport(select);
      return mapSegment(result.data);
    }

    const missingOptional = findMissingOptionalSegmentColumn(result.error);
    if (missingOptional && markSegmentSupportMissing(missingOptional)) continue;

    if (!isMissingColumn(result.error, "start_date") && !isMissingColumn(result.error, "duration_days") && !isMissingColumn(result.error, "order_in_day")) {
      throw new Error(result.error.message);
    }

    const fallbackPayload = { ...payload };
    delete (fallbackPayload as any).start_date;
    delete (fallbackPayload as any).duration_days;
    delete (fallbackPayload as any).order_in_day;
    delete (fallbackPayload as any).title_override;
    delete (fallbackPayload as any).progress_percent;
    delete (fallbackPayload as any).status;
    delete (fallbackPayload as any).comment;

    const second = await segmentsTable().update(fallbackPayload).eq("id", segmentId).select(SEGMENT_SELECT_LEGACY).maybeSingle();
    if (second.error) throw new Error(second.error.message);
    if (!second.data) throw new Error("Segment introuvable.");
    return mapSegmentLegacy(second.data);
  }
}

export async function deletePlanningCalendarSegments(segmentIds: string[]): Promise<void> {
  const ids = segmentIds.filter(Boolean);
  if (!ids.length) return;
  const { error } = await segmentsTable().delete().in("id", ids);
  if (error) throw new Error(error.message);
}
