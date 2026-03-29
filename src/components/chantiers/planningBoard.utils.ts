import type {
  PlanningCalendarSegment,
  PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  buildSplitDates,
  clampDurationDays,
  computePlannedHours,
  distributeDayLoads,
  type PlanningCalendarSettings,
} from "./planningCalendar.utils";

export type PlanningBlockStatus = "brouillon" | "planifie" | "en_cours" | "termine" | "annule";
export type TaskPlanningState = "a_planifier" | "partielle" | "planifiee" | "en_cours" | "terminee" | "bloquee";

export type PlanningBlockMetrics = {
  segmentId: string;
  progressPercent: number;
  status: PlanningBlockStatus;
  plannedHours: number;
  workedHours: number;
};

export type PlanningTaskSummary = {
  taskId: string;
  plannedTaskHours: number;
  scheduledBlockHours: number;
  estimatedWorkedHours: number;
  actualWorkedHours: number;
  remainingHours: number;
  progressPercent: number;
  inconsistency: boolean;
  segmentCount: number;
};

export type PlanningColor = {
  solid: string;
  soft: string;
  border: string;
  text: string;
};

const SPLIT_LABEL_SETS: Record<number, string[]> = {
  1: ["Execution"],
  2: ["Preparation", "Finitions"],
  3: ["Preparation", "Pose", "Finitions"],
  4: ["Preparation", "Pose", "Ajustements", "Finitions"],
};

function normalizeLabelBase(input: string): string {
  const text = String(input ?? "").trim();
  if (!text) return "tache";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function clampPercent(value: number | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function isDoneTaskStatus(status: string | null | undefined): boolean {
  return ["FAIT", "DONE", "TERMINE", "COMPLETED"].includes(normalizeText(status).toUpperCase());
}

function isBlockedTaskStatus(status: string | null | undefined): boolean {
  return ["BLOQUE", "BLOCKED", "EN_ATTENTE", "WAITING"].includes(normalizeText(status).toUpperCase());
}

export function getPlanningColor(seed: string | null | undefined): PlanningColor {
  const source = String(seed ?? "sans-affectation");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    solid: `hsl(${hue} 62% 48%)`,
    soft: `hsl(${hue} 78% 96%)`,
    border: `hsl(${hue} 50% 76%)`,
    text: `hsl(${hue} 62% 20%)`,
  };
}

export function getIntervenantColor(seed: string | null | undefined): PlanningColor {
  return getPlanningColor(seed ?? "sans-affectation");
}

export function getLotColor(task: Pick<PlanningCalendarTask, "lot" | "corps_etat" | "titre">): PlanningColor {
  return getPlanningColor(task.lot ?? task.corps_etat ?? task.titre);
}

export function getTaskPlanningTitle(
  task: Pick<PlanningCalendarTask, "titre" | "titre_terrain"> & {
    title?: string | null;
    nom?: string | null;
    libelle?: string | null;
  },
): string {
  return (
    normalizeText(task.titre_terrain) ||
    normalizeText(task.titre) ||
    normalizeText(task.title) ||
    normalizeText(task.nom) ||
    normalizeText(task.libelle) ||
    "Tache sans titre"
  );
}

export function getSegmentPlanningTitle(
  segment: Pick<PlanningCalendarSegment, "title_override">,
  task: Pick<PlanningCalendarTask, "titre" | "titre_terrain">,
): string {
  return normalizeText(segment.title_override) || getTaskPlanningTitle(task);
}

export function normalizeBlockStatus(
  status: string | null | undefined,
  progressPercent: number | null | undefined,
): PlanningBlockStatus {
  const normalized = normalizeText(status).toLowerCase();
  if (normalized === "brouillon" || normalized === "draft") return "brouillon";
  if (normalized === "annule" || normalized === "cancelled" || normalized === "canceled") return "annule";
  if (normalized === "termine" || normalized === "done" || normalized === "completed") return "termine";
  if (normalized === "en_cours" || normalized === "in_progress") return "en_cours";
  if (normalized === "planifie" || normalized === "planned") return "planifie";
  const progress = clampPercent(progressPercent);
  if (progress >= 100) return "termine";
  if (progress > 0) return "en_cours";
  return "planifie";
}

export function getTaskPlanningState(
  task: Pick<PlanningCalendarTask, "status">,
  summary: PlanningTaskSummary,
): TaskPlanningState {
  if (isBlockedTaskStatus(task.status)) return "bloquee";
  if (isDoneTaskStatus(task.status) || summary.progressPercent >= 100) return "terminee";
  if (summary.progressPercent > 0) return "en_cours";
  if (summary.segmentCount === 0) return "a_planifier";
  if (summary.plannedTaskHours > 0 && summary.scheduledBlockHours + 0.25 < summary.plannedTaskHours) return "partielle";
  return "planifiee";
}

export function buildSuggestedBlockTitles(taskTitle: string, parts: number): string[] {
  const count = Math.max(1, Math.trunc(parts || 1));
  const labels = SPLIT_LABEL_SETS[count] ?? [
    "Preparation",
    ...Array.from({ length: Math.max(0, count - 2) }, (_, index) => `Execution ${index + 1}`),
    "Finitions",
  ];
  const base = normalizeLabelBase(taskTitle);
  return labels.slice(0, count).map((label) => `${label} ${base}`.trim());
}

export function buildSuggestedBlocks(
  task: Pick<PlanningCalendarTask, "titre" | "titre_terrain" | "planned_duration_days">,
  startDate: string,
  settings: PlanningCalendarSettings,
): Array<{ title_override: string; start_date: string; duration_days: number }> {
  const totalDays = clampDurationDays(task.planned_duration_days ?? 1);
  const suggestedCount = Math.max(1, Math.ceil(totalDays));
  const parts = buildSplitDates(startDate, totalDays, suggestedCount, "sequential", settings);
  const titles = buildSuggestedBlockTitles(getTaskPlanningTitle(task), parts.length);
  return parts.map((part, index) => ({
    title_override: titles[index] ?? getTaskPlanningTitle(task),
    start_date: part.startDate,
    duration_days: part.durationDays,
  }));
}

export function computePlanningProgress(
  tasks: PlanningCalendarTask[],
  segments: PlanningCalendarSegment[],
  settings: PlanningCalendarSettings,
): {
  blockMetrics: Map<string, PlanningBlockMetrics>;
  taskSummaries: Map<string, PlanningTaskSummary>;
} {
  const segmentsByTask = new Map<string, PlanningCalendarSegment[]>();
  for (const segment of segments) {
    const list = segmentsByTask.get(segment.task_id) ?? [];
    list.push(segment);
    segmentsByTask.set(segment.task_id, list);
  }

  for (const list of segmentsByTask.values()) {
    list.sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      if (a.order_in_day !== b.order_in_day) return a.order_in_day - b.order_in_day;
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    });
  }

  const blockMetrics = new Map<string, PlanningBlockMetrics>();
  const taskSummaries = new Map<string, PlanningTaskSummary>();

  for (const task of tasks) {
    const taskSegments = segmentsByTask.get(task.id) ?? [];
    const scheduledBlockHours = Math.round(
      taskSegments.reduce((sum, segment) => sum + computePlannedHours(segment.duration_days, settings), 0) * 100,
    ) / 100;
    const plannedTaskHours = Math.max(
      0,
      Math.round((task.temps_prevu_h ?? scheduledBlockHours ?? computePlannedHours(task.planned_duration_days ?? 1, settings)) * 100) / 100,
    );
    const actualWorkedHours = Math.max(0, Number(task.temps_reel_h ?? 0) || 0);

    let remainingActualHours = actualWorkedHours;
    let estimatedWorkedHours = 0;

    for (const segment of taskSegments) {
      const plannedHours = Math.max(0.25, computePlannedHours(segment.duration_days, settings));
      const explicitProgress = segment.progress_percent;
      const derivedWorkedHours = Math.max(0, Math.min(plannedHours, remainingActualHours));
      const progressPercent =
        explicitProgress === null || explicitProgress === undefined
          ? clampPercent((derivedWorkedHours / plannedHours) * 100)
          : clampPercent(explicitProgress);
      const workedHours = Math.round((plannedHours * progressPercent) / 100 * 100) / 100;
      const status = normalizeBlockStatus(segment.status, progressPercent);

      blockMetrics.set(segment.id, {
        segmentId: segment.id,
        progressPercent,
        status,
        plannedHours,
        workedHours,
      });

      estimatedWorkedHours += workedHours;
      remainingActualHours = Math.max(0, remainingActualHours - plannedHours);
    }

    const effectiveReference = plannedTaskHours > 0 ? plannedTaskHours : Math.max(0.25, scheduledBlockHours || actualWorkedHours || 0);
    const progressPercent = clampPercent((Math.max(estimatedWorkedHours, actualWorkedHours) / effectiveReference) * 100);
    const remainingHours = Math.max(0, Math.round((plannedTaskHours - estimatedWorkedHours) * 100) / 100);

    taskSummaries.set(task.id, {
      taskId: task.id,
      plannedTaskHours,
      scheduledBlockHours,
      estimatedWorkedHours: Math.round(estimatedWorkedHours * 100) / 100,
      actualWorkedHours: Math.round(actualWorkedHours * 100) / 100,
      remainingHours,
      progressPercent,
      inconsistency: plannedTaskHours > 0 && Math.abs(scheduledBlockHours - plannedTaskHours) > 0.25,
      segmentCount: taskSegments.length,
    });
  }

  return { blockMetrics, taskSummaries };
}

export function computeDayLoadHours(
  segment: Pick<PlanningCalendarSegment, "duration_days" | "start_date">,
  settings: PlanningCalendarSettings,
): Array<{ date: string; hours: number }> {
  return distributeDayLoads(segment.duration_days, segment.start_date, settings).map((item) => ({
    date: item.date,
    hours: Math.round(item.load * settings.hoursPerDay * 100) / 100,
  }));
}

export function computeSegmentSpan(
  segment: Pick<PlanningCalendarSegment, "duration_days" | "start_date">,
  settings: PlanningCalendarSettings,
  visibleDays: string[],
): { startIndex: number; endIndex: number } | null {
  const covered = distributeDayLoads(segment.duration_days, segment.start_date, settings).map((item) => item.date);
  const indexes = covered
    .map((date) => visibleDays.indexOf(date))
    .filter((index) => index >= 0);
  if (!indexes.length) return null;
  return {
    startIndex: Math.min(...indexes),
    endIndex: Math.max(...indexes),
  };
}

export function computeRowLanes<T extends { id: string; startIndex: number; endIndex: number }>(items: T[]): Map<string, number> {
  const lanes: Array<{ endIndex: number }> = [];
  const result = new Map<string, number>();

  const sorted = [...items].sort((a, b) => {
    if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
    if (a.endIndex !== b.endIndex) return a.endIndex - b.endIndex;
    return a.id.localeCompare(b.id);
  });

  for (const item of sorted) {
    let laneIndex = lanes.findIndex((lane) => item.startIndex > lane.endIndex);
    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push({ endIndex: item.endIndex });
    } else {
      lanes[laneIndex].endIndex = item.endIndex;
    }
    result.set(item.id, laneIndex);
  }

  return result;
}
