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

export type PlanningBlockStatus = "prevu" | "en_cours" | "termine";

export type PlanningBlockMetrics = {
  segmentId: string;
  progressPercent: number;
  status: PlanningBlockStatus;
  plannedHours: number;
};

export type PlanningTaskSummary = {
  taskId: string;
  plannedTaskHours: number;
  scheduledBlockHours: number;
  workedHours: number;
  progressPercent: number;
  inconsistency: boolean;
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

export function getTaskPlanningTitle(task: Pick<PlanningCalendarTask, "titre" | "titre_terrain">): string {
  return String(task.titre_terrain ?? "").trim() || String(task.titre ?? "").trim() || "Tache";
}

export function getSegmentPlanningTitle(
  segment: Pick<PlanningCalendarSegment, "title_override">,
  task: Pick<PlanningCalendarTask, "titre" | "titre_terrain">,
): string {
  return String(segment.title_override ?? "").trim() || getTaskPlanningTitle(task);
}

export function getIntervenantColor(seed: string | null | undefined): PlanningColor {
  const source = String(seed ?? "sans-affectation");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    solid: `hsl(${hue} 62% 48%)`,
    soft: `hsl(${hue} 75% 96%)`,
    border: `hsl(${hue} 52% 76%)`,
    text: `hsl(${hue} 70% 18%)`,
  };
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
    const workedHours = Math.max(0, Number(task.temps_reel_h ?? 0) || 0);
    const scheduledBlockHours = Math.round(
      taskSegments.reduce((sum, segment) => sum + computePlannedHours(segment.duration_days, settings), 0) * 100,
    ) / 100;
    const plannedTaskHours = Math.max(
      0,
      Math.round(
        (
          task.temps_prevu_h ??
          scheduledBlockHours ??
          computePlannedHours(task.planned_duration_days ?? 1, settings)
        ) * 100,
      ) / 100,
    );

    let remainingWorked = workedHours;
    for (const segment of taskSegments) {
      const plannedHours = Math.max(0.25, computePlannedHours(segment.duration_days, settings));
      const consumed = Math.max(0, Math.min(plannedHours, remainingWorked));
      const progressPercent = Math.max(0, Math.min(100, Math.round((consumed / plannedHours) * 100)));
      const status: PlanningBlockStatus =
        progressPercent >= 100 ? "termine" : progressPercent > 0 ? "en_cours" : "prevu";

      blockMetrics.set(segment.id, {
        segmentId: segment.id,
        progressPercent,
        status,
        plannedHours,
      });
      remainingWorked = Math.max(0, remainingWorked - plannedHours);
    }

    const effectivePlannedHours = Math.max(plannedTaskHours, scheduledBlockHours || 0.25);
    taskSummaries.set(task.id, {
      taskId: task.id,
      plannedTaskHours,
      scheduledBlockHours,
      workedHours,
      progressPercent: Math.max(0, Math.min(100, Math.round((workedHours / effectivePlannedHours) * 100))),
      inconsistency: plannedTaskHours > 0 && Math.abs(scheduledBlockHours - plannedTaskHours) > 0.25,
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
