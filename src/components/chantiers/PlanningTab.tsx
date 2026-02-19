import { useEffect, useMemo, useState } from "react";
import LotPlanningDrawer, { type PlanningLotView } from "./LotPlanningDrawer";
import {
  bulkUpdatePlanningTasks,
  getTaskLotName,
  listPlanningTasksByChantierDetailed,
  updatePlanningTask,
  type PlanningTaskRow,
} from "../../services/chantierPlanningTasks.service";
import type { IntervenantRow } from "../../services/intervenants.service";
import { getChantierById, updateChantier } from "../../services/chantiers.service";
import {
  listChantierLotPlanningDetailed,
  upsertChantierLotPlanning,
  type ChantierLotPlanningRow,
} from "../../services/chantierLotPlanning.service";
import {
  createPlanningAnnotation,
  deletePlanningAnnotation,
  listPlanningAnnotations,
  updatePlanningAnnotation,
  type PlanningAnnotationRow,
  type PlanningAnnotationType,
} from "../../services/planningAnnotations.service";
import {
  addDays,
  addDaysToDateString,
  clampRange,
  diffDays,
  formatDateOnly,
  isWeekend,
  parseDateOnly,
  pickTimelineScale,
  recomputeLotEndDate,
  startOfMonth,
  startOfWeek,
  toLotProgress,
} from "../../utils/planningDates";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

type ChantierPlanningDates = {
  id: string;
  planning_start_date: string | null;
  planning_end_date: string | null;
  planning_skip_weekends: boolean;
};

type TimelineRange = {
  start: string;
  end: string;
  totalDays: number;
};

type LotSummary = PlanningLotView & {
  tasks: PlanningTaskRow[];
  tasksCount: number;
  durationDays: number;
  progress: number;
  displayEndDate: string | null;
  annotations: PlanningAnnotationRow[];
};

function safeInt(value: number | null | undefined, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function annotationBadgeClass(type: PlanningAnnotationType): string {
  if (type === "warning") return "bg-amber-100 text-amber-800 border-amber-200";
  if (type === "flag") return "bg-red-100 text-red-800 border-red-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function annotationIcon(type: PlanningAnnotationType): string {
  if (type === "warning") return "!";
  if (type === "flag") return "F";
  return "i";
}

function normalizeLotName(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text || "A classer";
}

function computeVisibleBar(range: TimelineRange, start: string, endExclusive: string): { left: number; width: number } | null {
  const startOffset = diffDays(range.start, start);
  const endOffset = diffDays(range.start, endExclusive);

  if (endOffset <= 0 || startOffset >= range.totalDays) return null;

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(range.totalDays, Math.max(startOffset + 1, endOffset));
  const visibleDuration = Math.max(1, visibleEnd - visibleStart);

  return {
    left: (visibleStart / range.totalDays) * 100,
    width: Math.max(1.25, (visibleDuration / range.totalDays) * 100),
  };
}

export default function PlanningTab({ chantierId, chantierName, intervenants }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [chantierDates, setChantierDates] = useState<ChantierPlanningDates | null>(null);
  const [tasks, setTasks] = useState<PlanningTaskRow[]>([]);
  const [lotPlanning, setLotPlanning] = useState<ChantierLotPlanningRow[]>([]);
  const [annotations, setAnnotations] = useState<PlanningAnnotationRow[]>([]);

  const [selectedLotKey, setSelectedLotKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [annotationsFilterLot, setAnnotationsFilterLot] = useState("__all__");

  const skipWeekends = Boolean(chantierDates?.planning_skip_weekends ?? false);

  async function loadAll(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    setWarning(null);

    try {
      const [chantier, planningTasks, lotPlanningData, planningAnnotations] = await Promise.all([
        getChantierById(chantierId),
        listPlanningTasksByChantierDetailed(chantierId),
        listChantierLotPlanningDetailed(chantierId),
        listPlanningAnnotations(chantierId),
      ]);

      setChantierDates({
        id: chantier.id,
        planning_start_date: chantier.planning_start_date ?? null,
        planning_end_date: chantier.planning_end_date ?? null,
        planning_skip_weekends: Boolean(chantier.planning_skip_weekends ?? false),
      });
      setTasks(planningTasks.tasks);
      setLotPlanning(lotPlanningData.rows);
      setAnnotations(planningAnnotations);

      const warnings: string[] = [];
      if (planningTasks.planningColumnsMissing) {
        warnings.push(
          `Migration planning manquante sur Supabase. Colonnes attendues sur public.chantier_tasks: ${planningTasks.expectedPlanningColumns.join(", ")}.`,
        );
      }
      if (lotPlanningData.tableMissing) {
        warnings.push("Migration planning manquante sur Supabase. Table attendue: public.chantier_lot_planning.");
      }
      setWarning(warnings.length ? warnings.join(" ") : null);
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement planning.");
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadAll(false);
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  const taskById = useMemo(() => {
    const map = new Map<string, PlanningTaskRow>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const tasksByLotName = useMemo(() => {
    const map = new Map<string, PlanningTaskRow[]>();
    for (const task of tasks) {
      const lotName = getTaskLotName(task);
      const list = map.get(lotName) ?? [];
      list.push(task);
      map.set(lotName, list);
    }
    return map;
  }, [tasks]);

  const lotPlanningByName = useMemo(() => {
    const map = new Map<string, ChantierLotPlanningRow>();
    for (const row of lotPlanning) {
      map.set(normalizeLotName(row.lot_name), row);
    }
    return map;
  }, [lotPlanning]);

  const lotSummaries = useMemo((): LotSummary[] => {
    const rows: LotSummary[] = [];

    for (const [lotName, lotTasks] of tasksByLotName.entries()) {
      const planning = lotPlanningByName.get(lotName);
      const taskIds = new Set(lotTasks.map((task) => task.id));

      const defaultOrder = lotTasks.reduce((minValue, task) => {
        const value = Math.max(0, safeInt(task.order_index, 0));
        return Math.min(minValue, value);
      }, Number.POSITIVE_INFINITY);

      const computedEnd = planning?.start_date
        ? recomputeLotEndDate(planning.start_date, lotTasks, { skipWeekends })
        : null;

      const displayEndDate = planning?.end_date_locked
        ? planning?.end_date ?? computedEnd
        : computedEnd ?? planning?.end_date ?? null;

      const rowAnnotations = annotations.filter((annotation) => {
        if (normalizeLotName(annotation.lot_name) === lotName) return true;
        return annotation.task_id ? taskIds.has(annotation.task_id) : false;
      });

      rows.push({
        key: lotName,
        name: lotName,
        planning_start_date: planning?.start_date ?? null,
        planning_end_date: planning?.end_date ?? null,
        end_date_locked: Boolean(planning?.end_date_locked ?? false),
        order_index: planning?.order_index ?? (Number.isFinite(defaultOrder) ? defaultOrder : 0),
        tasks: lotTasks,
        tasksCount: lotTasks.length,
        durationDays: lotTasks.reduce((sum, task) => sum + Math.max(1, safeInt(task.duration_days, 1)), 0),
        progress: toLotProgress(lotTasks),
        displayEndDate,
        annotations: rowAnnotations,
      });
    }

    rows.sort((a, b) => {
      const orderDiff = safeInt(a.order_index, 0) - safeInt(b.order_index, 0);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, "fr");
    });

    return rows;
  }, [annotations, lotPlanningByName, skipWeekends, tasksByLotName]);

  const selectedLot = useMemo(() => {
    if (!selectedLotKey) return null;
    return lotSummaries.find((row) => row.key === selectedLotKey) ?? null;
  }, [selectedLotKey, lotSummaries]);

  const plannedLotRange = useMemo((): TimelineRange | null => {
    const starts: string[] = [];
    const ends: string[] = [];

    for (const row of lotPlanning) {
      if (!row.start_date || !row.end_date) continue;
      starts.push(row.start_date);
      ends.push(row.end_date);
    }

    if (!starts.length || !ends.length) return null;

    const start = [...starts].sort()[0];
    const end = [...ends].sort()[ends.length - 1];
    const clamped = clampRange(start, end);
    return {
      start: clamped.start,
      end: clamped.end,
      totalDays: Math.max(1, diffDays(clamped.start, clamped.end)),
    };
  }, [lotPlanning]);

  const taskDatesRange = useMemo((): TimelineRange | null => {
    const starts: string[] = [];
    const ends: string[] = [];

    for (const task of tasks) {
      const start = task.date_debut ?? task.date_fin;
      const end = task.date_fin ?? task.date_debut;
      if (!start || !end) continue;
      starts.push(start);
      ends.push(end);
    }

    if (!starts.length || !ends.length) return null;

    const start = [...starts].sort()[0];
    const end = [...ends].sort()[ends.length - 1];
    const clamped = clampRange(start, end);
    return {
      start: clamped.start,
      end: clamped.end,
      totalDays: Math.max(1, diffDays(clamped.start, clamped.end)),
    };
  }, [tasks]);

  const timelineRange = useMemo((): TimelineRange => {
    if (plannedLotRange) return plannedLotRange;
    if (taskDatesRange) return taskDatesRange;

    const start = formatDateOnly(new Date());
    const end = addDaysToDateString(start, 14);
    return {
      start,
      end,
      totalDays: Math.max(1, diffDays(start, end)),
    };
  }, [plannedLotRange, taskDatesRange]);

  const timelineTicks = useMemo(() => {
    const scale = pickTimelineScale(timelineRange.totalDays);
    const ticks: Array<{ date: string; leftPercent: number; label: string }> = [];

    if (scale === "week") {
      const startWeek = startOfWeek(timelineRange.start);
      const weekCount = Math.max(1, Math.ceil((timelineRange.totalDays + 7) / 7));
      const stepWeeks = Math.max(1, Math.ceil(weekCount / 10));
      for (let i = 0; i < timelineRange.totalDays + 14; i += 7 * stepWeeks) {
        const date = addDaysToDateString(startWeek, i);
        const offset = diffDays(timelineRange.start, date);
        const leftPercent = (offset / timelineRange.totalDays) * 100;
        if (leftPercent < -5 || leftPercent > 105) continue;
        ticks.push({ label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, date, leftPercent });
      }
      return ticks;
    }

    const startMonth = startOfMonth(timelineRange.start);
    const monthCount = Math.max(1, Math.ceil((timelineRange.totalDays + 30) / 30));
    const stepMonths = Math.max(1, Math.ceil(monthCount / 8));
    for (let i = 0; i < timelineRange.totalDays + 70; i += 30 * stepMonths) {
      const date = addDaysToDateString(startMonth, i);
      const [year, month] = date.split("-");
      const offset = diffDays(timelineRange.start, date);
      const leftPercent = (offset / timelineRange.totalDays) * 100;
      if (leftPercent < -5 || leftPercent > 105) continue;
      ticks.push({ label: `${month}/${year.slice(2, 4)}`, date, leftPercent });
    }
    return ticks;
  }, [timelineRange]);

  const timelineDays = useMemo(() => {
    const days: Array<{ date: string; leftPercent: number; widthPercent: number; weekend: boolean }> = [];
    const dayWidth = 100 / timelineRange.totalDays;
    const startDate = parseDateOnly(timelineRange.start);

    for (let dayIndex = 0; dayIndex < timelineRange.totalDays; dayIndex += 1) {
      const dateObj = addDays(startDate, dayIndex);
      days.push({
        date: formatDateOnly(dateObj),
        leftPercent: (dayIndex / timelineRange.totalDays) * 100,
        widthPercent: dayWidth,
        weekend: isWeekend(dateObj),
      });
    }

    return days;
  }, [timelineRange]);

  const todayMarker = useMemo(() => {
    const today = formatDateOnly(new Date());
    const offset = diffDays(timelineRange.start, today);
    if (offset < 0 || offset > timelineRange.totalDays) return null;
    return {
      leftPercent: (offset / timelineRange.totalDays) * 100,
      date: today,
    };
  }, [timelineRange]);

  const globalAnnotationsList = useMemo(() => {
    const entries = annotations.map((annotation) => {
      const linkedTask = annotation.task_id ? taskById.get(annotation.task_id) ?? null : null;
      const resolvedLot = normalizeLotName(annotation.lot_name ?? linkedTask?.lot ?? linkedTask?.corps_etat ?? null);
      return {
        annotation,
        resolvedLot,
        linkedTask,
      };
    });

    if (annotationsFilterLot === "__all__") return entries;
    return entries.filter((entry) => entry.resolvedLot === annotationsFilterLot);
  }, [annotations, annotationsFilterLot, taskById]);

  function openLotDrawer(lotKey: string) {
    setSelectedLotKey(lotKey);
    setDrawerOpen(true);
  }

  async function saveChantierDates() {
    if (!chantierDates) return;
    setError(null);
    setNotice(null);

    try {
      const updated = await updateChantier(chantierId, {
        planning_start_date: chantierDates.planning_start_date,
        planning_end_date: chantierDates.planning_end_date,
        planning_skip_weekends: chantierDates.planning_skip_weekends,
      });

      setChantierDates({
        id: updated.id,
        planning_start_date: updated.planning_start_date ?? null,
        planning_end_date: updated.planning_end_date ?? null,
        planning_skip_weekends: Boolean(updated.planning_skip_weekends ?? false),
      });
      setNotice("Perimetre chantier mis a jour.");
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre a jour les dates chantier.");
    }
  }

  async function handleSaveLotFromDrawer(patch: {
    planning_start_date: string | null;
    planning_end_date: string | null;
    end_date_locked: boolean;
    order_index: number;
  }) {
    if (!selectedLot) return;

    await upsertChantierLotPlanning({
      chantier_id: chantierId,
      lot_name: selectedLot.name,
      start_date: patch.planning_start_date,
      end_date: patch.planning_end_date,
      end_date_locked: patch.end_date_locked,
      order_index: patch.order_index,
    });

    await loadAll(true);
  }

  async function handleSaveTaskFromDrawer(taskId: string, patch: { duration_days?: number }) {
    await updatePlanningTask(taskId, patch);
    await loadAll(true);
  }

  async function handleReorderTasksFromDrawer(orderedTaskIds: string[]) {
    const patches = orderedTaskIds.map((taskId, index) => ({ id: taskId, order_index: index }));
    await bulkUpdatePlanningTasks(patches);
    await loadAll(true);
  }

  async function handleRenameLotFromDrawer(nextLotName: string) {
    if (!selectedLot) return;

    const trimmed = nextLotName.trim();
    if (!trimmed || trimmed === selectedLot.name) return;

    const lotTasks = selectedLot.tasks;
    for (const task of lotTasks) {
      await updatePlanningTask(task.id, {
        lot: trimmed,
        corps_etat: trimmed,
      });
    }

    await loadAll(true);
    setSelectedLotKey(trimmed);
  }

  async function handleCreateAnnotationFromDrawer(input: {
    lot_name?: string | null;
    task_id?: string | null;
    intervenant_id?: string | null;
    date_start: string;
    date_end?: string | null;
    type: PlanningAnnotationType;
    message: string;
    is_resolved: boolean;
  }) {
    await createPlanningAnnotation({
      chantier_id: chantierId,
      lot_name: input.lot_name ?? selectedLot?.name ?? null,
      task_id: input.task_id ?? null,
      intervenant_id: input.intervenant_id ?? null,
      date_start: input.date_start,
      date_end: input.date_end ?? null,
      type: input.type,
      message: input.message,
      is_resolved: input.is_resolved,
    });
    await loadAll(true);
  }

  async function handleUpdateAnnotationFromDrawer(
    annotationId: string,
    patch: {
      task_id?: string | null;
      intervenant_id?: string | null;
      date_start?: string;
      date_end?: string | null;
      type?: PlanningAnnotationType;
      message?: string;
      is_resolved?: boolean;
    },
  ) {
    await updatePlanningAnnotation(annotationId, patch);
    await loadAll(true);
  }

  async function handleDeleteAnnotationFromDrawer(annotationId: string) {
    await deletePlanningAnnotation(annotationId);
    await loadAll(true);
  }

  async function handleToggleAnnotationResolvedFromDrawer(annotation: PlanningAnnotationRow) {
    await updatePlanningAnnotation(annotation.id, { is_resolved: !annotation.is_resolved });
    await loadAll(true);
  }

  if (loading) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement planning...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Planning global chantier</h2>
          <p className="text-sm text-slate-500">
            {chantierName ? `${chantierName} - ` : ""}
            Lignes par lot deduit de chantier_tasks.lot puis corps_etat.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
          onClick={() => void loadAll(true)}
          disabled={refreshing}
        >
          {refreshing ? "Actualisation..." : "Rafraichir"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {warning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <section className="rounded-2xl border bg-white p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-end">
          <label className="space-y-1 text-sm">
            <div className="text-xs text-slate-600">Perimetre chantier - debut</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              type="date"
              value={chantierDates?.planning_start_date ?? ""}
              onChange={(e) =>
                setChantierDates((prev) =>
                  prev
                    ? {
                        ...prev,
                        planning_start_date: e.target.value || null,
                      }
                    : prev,
                )
              }
            />
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs text-slate-600">Perimetre chantier - fin</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              type="date"
              value={chantierDates?.planning_end_date ?? ""}
              onChange={(e) =>
                setChantierDates((prev) =>
                  prev
                    ? {
                        ...prev,
                        planning_end_date: e.target.value || null,
                      }
                    : prev,
                )
              }
            />
          </label>

          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={skipWeekends}
              onChange={(e) =>
                setChantierDates((prev) =>
                  prev
                    ? {
                        ...prev,
                        planning_skip_weekends: e.target.checked,
                      }
                    : prev,
                )
              }
            />
            Ignorer week-ends
          </label>

          <div className="text-xs text-slate-500 pb-2">
            Fenetre auto: {timelineRange.start} - {timelineRange.end}
          </div>

          <button
            type="button"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            onClick={() => void saveChantierDates()}
          >
            Enregistrer
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[300px_minmax(760px,1fr)] gap-3 items-end border-b pb-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Lot</div>
              <div className="relative h-8 border rounded-lg bg-slate-50">
                {timelineTicks.map((tick) => (
                  <div key={tick.date} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${tick.leftPercent}%` }}>
                    <div className="-translate-x-1/2 text-[11px] text-slate-500">{tick.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {lotSummaries.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-slate-500">
                  Aucune tache detectee pour ce chantier. Les lignes de lot seront construites depuis chantier_tasks.lot.
                </div>
              ) : (
                lotSummaries.map((row) => {
                  const bar =
                    row.planning_start_date && row.displayEndDate
                      ? computeVisibleBar(timelineRange, row.planning_start_date, row.displayEndDate)
                      : null;

                  return (
                    <div key={row.key} className="grid grid-cols-[300px_minmax(760px,1fr)] gap-3 items-center">
                      <button
                        type="button"
                        className="h-14 rounded-xl border px-3 text-left hover:bg-slate-50"
                        onClick={() => openLotDrawer(row.key)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-medium text-slate-800">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.progress}%</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.tasksCount} tache(s) - {row.durationDays}j estimes
                        </div>
                      </button>

                      <div
                        className="relative h-14 rounded-xl border bg-white cursor-pointer overflow-hidden hover:bg-slate-50"
                        onClick={() => openLotDrawer(row.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openLotDrawer(row.key);
                          }
                        }}
                      >
                        {timelineDays.map((day) => (
                          <div
                            key={`${row.key}:${day.date}`}
                            className={day.weekend ? "absolute top-0 h-full bg-slate-100" : "hidden"}
                            style={{ left: `${day.leftPercent}%`, width: `${day.widthPercent}%` }}
                          />
                        ))}

                        {todayMarker && (
                          <div
                            className="absolute top-0 h-full w-[2px] bg-red-500/80"
                            style={{ left: `${todayMarker.leftPercent}%` }}
                            title={`Aujourd'hui: ${todayMarker.date}`}
                          />
                        )}

                        {bar ? (
                          <>
                            <div
                              className="absolute top-3 h-8 rounded-full bg-blue-600"
                              style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 px-3 text-xs font-medium text-white pointer-events-none"
                              style={{ left: `${bar.left}%`, maxWidth: "70%" }}
                            >
                              {row.name}
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center px-3 text-xs text-amber-700">
                            Non planifie - cliquer pour planifier ce lot
                          </div>
                        )}

                        {row.annotations.map((annotation) => {
                          const offset = diffDays(timelineRange.start, annotation.date_start);
                          if (offset < 0 || offset > timelineRange.totalDays) return null;
                          const leftPercent = (offset / timelineRange.totalDays) * 100;
                          return (
                            <div
                              key={annotation.id}
                              className={[
                                "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border text-[10px] font-semibold flex items-center justify-center",
                                annotationBadgeClass(annotation.type),
                              ].join(" ")}
                              style={{ left: `calc(${leftPercent}% - 10px)` }}
                              title={`${annotation.message} (${annotation.date_start})`}
                            >
                              {annotationIcon(annotation.type)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Annotations planning</div>
            <div className="text-xs text-slate-500">Creation et edition disponibles dans le drawer d un lot.</div>
          </div>
          <label className="text-sm">
            <span className="mr-2 text-xs text-slate-600">Filtrer lot</span>
            <select
              className="rounded-xl border px-3 py-2 text-sm"
              value={annotationsFilterLot}
              onChange={(e) => setAnnotationsFilterLot(e.target.value)}
            >
              <option value="__all__">Tous les lots</option>
              {lotSummaries.map((lot) => (
                <option key={lot.key} value={lot.name}>
                  {lot.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {globalAnnotationsList.length === 0 ? (
          <div className="mt-3 rounded-xl border p-3 text-sm text-slate-500">Aucune annotation.</div>
        ) : (
          <div className="mt-3 divide-y rounded-xl border">
            {globalAnnotationsList.map((entry) => {
              const linkedIntervenant = entry.annotation.intervenant_id
                ? intervenants.find((it) => it.id === entry.annotation.intervenant_id) ?? null
                : null;
              return (
                <div key={entry.annotation.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={["rounded-full border px-2 py-1 text-[11px]", annotationBadgeClass(entry.annotation.type)].join(" ")}>
                        {entry.annotation.type}
                      </span>
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[11px]",
                          entry.annotation.is_resolved
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        {entry.annotation.is_resolved ? "Traitee" : "Ouverte"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {entry.annotation.date_start}
                      {entry.annotation.date_end ? ` -> ${entry.annotation.date_end}` : ""}
                    </div>
                  </div>
                  <div className="mt-1 font-medium text-slate-800">{entry.annotation.message}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Lot: {entry.resolvedLot} | Tache: {entry.linkedTask?.titre ?? "-"} | Intervenant: {linkedIntervenant?.nom ?? "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <LotPlanningDrawer
        open={drawerOpen && !!selectedLot}
        lot={selectedLot}
        tasks={selectedLot?.tasks ?? []}
        annotations={selectedLot?.annotations ?? []}
        intervenants={intervenants}
        skipWeekends={skipWeekends}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLotKey(null);
        }}
        onSaveLot={handleSaveLotFromDrawer}
        onSaveTask={handleSaveTaskFromDrawer}
        onReorderTasks={handleReorderTasksFromDrawer}
        onRenameLot={handleRenameLotFromDrawer}
        onCreateAnnotation={handleCreateAnnotationFromDrawer}
        onUpdateAnnotation={handleUpdateAnnotationFromDrawer}
        onDeleteAnnotation={handleDeleteAnnotationFromDrawer}
        onToggleAnnotationResolved={handleToggleAnnotationResolvedFromDrawer}
      />
    </div>
  );
}
