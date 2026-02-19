import { useEffect, useMemo, useState } from "react";
import type { PlanningTaskRow } from "../../services/chantierPlanningTasks.service";
import type { IntervenantRow } from "../../services/intervenants.service";
import type { PlanningAnnotationRow, PlanningAnnotationType } from "../../services/planningAnnotations.service";
import {
  addDays,
  computeLotTaskTimeline,
  diffDays,
  formatDateOnly,
  isWeekend,
  parseDateOnly,
  recomputeLotEndDate,
  type PlanningTaskLike,
} from "../../utils/planningDates";

export type PlanningLotView = {
  key: string;
  name: string;
  planning_start_date: string | null;
  planning_end_date: string | null;
  end_date_locked: boolean;
  order_index: number;
};

type Props = {
  open: boolean;
  lot: PlanningLotView | null;
  tasks: PlanningTaskRow[];
  annotations: PlanningAnnotationRow[];
  intervenants: IntervenantRow[];
  skipWeekends: boolean;
  onClose: () => void;
  onSaveLot: (patch: {
    planning_start_date: string | null;
    planning_end_date: string | null;
    end_date_locked: boolean;
    order_index: number;
  }) => Promise<void>;
  onSaveTask: (taskId: string, patch: { duration_days?: number }) => Promise<void>;
  onReorderTasks: (orderedTaskIds: string[]) => Promise<void>;
  onRenameLot: (nextLotName: string) => Promise<void>;
  onCreateAnnotation: (input: {
    lot_name?: string | null;
    task_id?: string | null;
    intervenant_id?: string | null;
    date_start: string;
    date_end?: string | null;
    type: PlanningAnnotationType;
    message: string;
    is_resolved: boolean;
  }) => Promise<void>;
  onUpdateAnnotation: (
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
  ) => Promise<void>;
  onDeleteAnnotation: (annotationId: string) => Promise<void>;
  onToggleAnnotationResolved: (annotation: PlanningAnnotationRow) => Promise<void>;
};

type AnnotationFormState = {
  id: string | null;
  type: PlanningAnnotationType;
  message: string;
  date_start: string;
  date_end: string;
  task_id: string;
  intervenant_id: string;
  is_resolved: boolean;
};

function safeInt(value: number | null | undefined, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function safeDuration(value: string | number | null | undefined): number {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
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

function toTaskLike(task: PlanningTaskRow, orderIndex: number, durationDays: number): PlanningTaskLike {
  return {
    id: task.id,
    titre: task.titre,
    status: task.status,
    duration_days: durationDays,
    order_index: orderIndex,
  };
}

function moveId(list: string[], fromId: string, toId: string): string[] {
  const fromIndex = list.indexOf(fromId);
  const toIndex = list.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function emptyAnnotationForm(lotStartDate: string): AnnotationFormState {
  return {
    id: null,
    type: "flag",
    message: "",
    date_start: lotStartDate || formatDateOnly(new Date()),
    date_end: "",
    task_id: "",
    intervenant_id: "",
    is_resolved: false,
  };
}

export default function LotPlanningDrawer({
  open,
  lot,
  tasks,
  annotations,
  intervenants,
  skipWeekends,
  onClose,
  onSaveLot,
  onSaveTask,
  onReorderTasks,
  onRenameLot,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onToggleAnnotationResolved,
}: Props) {
  const [lotNameDraft, setLotNameDraft] = useState("");
  const [lotStartDate, setLotStartDate] = useState("");
  const [lotEndDateManual, setLotEndDateManual] = useState("");
  const [manualEndLocked, setManualEndLocked] = useState(false);
  const [lotOrderIndex, setLotOrderIndex] = useState("0");

  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>({});
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>([]);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [annotationForm, setAnnotationForm] = useState<AnnotationFormState>(emptyAnnotationForm(""));
  const [annotationFormOpen, setAnnotationFormOpen] = useState(false);

  const [savingLot, setSavingLot] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);
  const [annotationPopoverId, setAnnotationPopoverId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !lot) return;

    setLotNameDraft(lot.name);
    setLotStartDate(lot.planning_start_date ?? "");
    setLotEndDateManual(lot.planning_end_date ?? "");
    setManualEndLocked(Boolean(lot.end_date_locked));
    setLotOrderIndex(String(lot.order_index ?? 0));

    const sorted = [...tasks].sort((a, b) => {
      const orderDiff = safeInt(a.order_index, 0) - safeInt(b.order_index, 0);
      if (orderDiff !== 0) return orderDiff;
      return a.titre.localeCompare(b.titre, "fr");
    });

    const nextDrafts: Record<string, string> = {};
    const ids: string[] = [];
    for (const task of sorted) {
      ids.push(task.id);
      nextDrafts[task.id] = String(safeDuration(task.duration_days));
    }
    setOrderedTaskIds(ids);
    setDurationDrafts(nextDrafts);
    setAnnotationForm(emptyAnnotationForm(lot.planning_start_date ?? ""));
    setAnnotationFormOpen(false);
    setDrawerError(null);
    setDrawerNotice(null);
    setAnnotationPopoverId(null);
  }, [open, lot, tasks]);

  const taskById = useMemo(() => {
    const map = new Map<string, PlanningTaskRow>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const intervenantById = useMemo(() => {
    const map = new Map<string, IntervenantRow>();
    for (const intervenant of intervenants) map.set(intervenant.id, intervenant);
    return map;
  }, [intervenants]);

  const orderedTasks = useMemo(() => {
    const ordered = orderedTaskIds
      .map((taskId) => taskById.get(taskId))
      .filter((task): task is PlanningTaskRow => Boolean(task));

    const inOrder = new Set(ordered.map((task) => task.id));
    const missing = tasks
      .filter((task) => !inOrder.has(task.id))
      .sort((a, b) => safeInt(a.order_index, 0) - safeInt(b.order_index, 0));

    return [...ordered, ...missing];
  }, [orderedTaskIds, taskById, tasks]);

  const timelineTasks = useMemo(() => {
    return orderedTasks.map((task, index) => {
      const durationDays = safeDuration(durationDrafts[task.id] ?? task.duration_days);
      return {
        task,
        durationDays,
        taskLike: toTaskLike(task, index, durationDays),
      };
    });
  }, [orderedTasks, durationDrafts]);

  const computedEndDate = useMemo(() => {
    return recomputeLotEndDate(
      lotStartDate || null,
      timelineTasks.map((item) => item.taskLike),
      { skipWeekends },
    );
  }, [lotStartDate, timelineTasks, skipWeekends]);

  const maxTaskDateEnd = useMemo(() => {
    let maxEnd: string | null = null;
    for (const item of timelineTasks) {
      const endDate = item.task.date_fin ?? item.task.date_debut;
      if (!endDate) continue;
      if (!maxEnd || endDate > maxEnd) maxEnd = endDate;
    }
    return maxEnd;
  }, [timelineTasks]);

  const autoEndDate = useMemo(() => {
    if (!lotStartDate) return "";
    let nextEnd = computedEndDate || lotStartDate;
    if (maxTaskDateEnd && maxTaskDateEnd > nextEnd) {
      nextEnd = maxTaskDateEnd;
    }
    return nextEnd;
  }, [lotStartDate, computedEndDate, maxTaskDateEnd]);

  const effectiveEndDate = useMemo(() => {
    if (!lotStartDate) return "";
    if (manualEndLocked) return lotEndDateManual || autoEndDate || lotStartDate;
    return autoEndDate || lotStartDate;
  }, [lotStartDate, lotEndDateManual, manualEndLocked, autoEndDate]);

  const timeline = useMemo(() => {
    if (!lotStartDate) return null;

    const windows = computeLotTaskTimeline(
      lotStartDate,
      timelineTasks.map((item) => item.taskLike),
      { skipWeekends },
    );

    const totalDays = Math.max(1, diffDays(lotStartDate, effectiveEndDate || lotStartDate));
    const startDate = parseDateOnly(lotStartDate);
    const dayCells = Array.from({ length: totalDays }, (_, dayOffset) => {
      const date = addDays(startDate, dayOffset);
      const dateStr = formatDateOnly(date);
      return {
        date: dateStr,
        isWeekend: isWeekend(date),
        isWeekStart: date.getUTCDay() === 1,
      };
    });

    const today = formatDateOnly(new Date());
    const todayOffset = diffDays(lotStartDate, today);
    const todayVisible = todayOffset >= 0 && todayOffset <= totalDays;

    return {
      start: lotStartDate,
      end: effectiveEndDate || lotStartDate,
      totalDays,
      windows,
      dayCells,
      todayVisible,
      todayLeftPercent: (todayOffset / totalDays) * 100,
    };
  }, [lotStartDate, effectiveEndDate, timelineTasks, skipWeekends]);

  const taskIdsSet = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);

  const lotAnnotations = useMemo(() => {
    if (!lot) return [];
    return annotations.filter((annotation) => {
      if ((annotation.lot_name ?? "") === lot.name) return true;
      return annotation.task_id ? taskIdsSet.has(annotation.task_id) : false;
    });
  }, [annotations, lot, taskIdsSet]);

  const durationTotal = useMemo(() => {
    return timelineTasks.reduce((sum, item) => sum + item.durationDays, 0);
  }, [timelineTasks]);

  if (!open || !lot) return null;
  const currentLot = lot;

  async function saveLot() {
    if (!lot) return;

    const nextLotName = lotNameDraft.trim();
    if (!nextLotName) {
      setDrawerError("Le nom du lot est obligatoire.");
      return;
    }

    setSavingLot(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      if (nextLotName !== currentLot.name) {
        await onRenameLot(nextLotName);
      }

      const orderIndex = Number(lotOrderIndex);
      await onSaveLot({
        planning_start_date: lotStartDate || null,
        planning_end_date: (manualEndLocked ? lotEndDateManual || autoEndDate : autoEndDate) || null,
        end_date_locked: manualEndLocked,
        order_index: Number.isFinite(orderIndex) ? Math.max(0, Math.trunc(orderIndex)) : 0,
      });
      setDrawerNotice("Planning du lot enregistre.");
    } catch (err: any) {
      setDrawerError(err?.message ?? "Impossible d'enregistrer ce lot.");
    } finally {
      setSavingLot(false);
    }
  }

  async function persistTaskDuration(task: PlanningTaskRow) {
    const nextDuration = safeDuration(durationDrafts[task.id] ?? task.duration_days);
    const prevDuration = safeDuration(task.duration_days);
    if (nextDuration === prevDuration) return;

    setSavingTasks(true);
    setDrawerError(null);
    try {
      await onSaveTask(task.id, { duration_days: nextDuration });
      setDrawerNotice(`Duree mise a jour: ${task.titre}`);
    } catch (err: any) {
      setDrawerError(err?.message ?? "Impossible de mettre a jour la duree.");
    } finally {
      setSavingTasks(false);
    }
  }

  async function handleDropOnTask(targetTaskId: string) {
    if (!draggingTaskId) return;
    const currentIds = orderedTasks.map((task) => task.id);
    const nextIds = moveId(currentIds, draggingTaskId, targetTaskId);
    if (nextIds.join("|") === currentIds.join("|")) {
      setDraggingTaskId(null);
      return;
    }

    setOrderedTaskIds(nextIds);
    setSavingTasks(true);
    setDrawerError(null);
    try {
      await onReorderTasks(nextIds);
      setDrawerNotice("Ordre des taches mis a jour.");
    } catch (err: any) {
      setDrawerError(err?.message ?? "Impossible de reordonner les taches.");
      setOrderedTaskIds(currentIds);
    } finally {
      setSavingTasks(false);
      setDraggingTaskId(null);
    }
  }

  function openCreateAnnotationForm() {
    setAnnotationForm(emptyAnnotationForm(lotStartDate || currentLot.planning_start_date || ""));
    setAnnotationFormOpen(true);
    setDrawerError(null);
  }

  function openEditAnnotationForm(annotation: PlanningAnnotationRow) {
    setAnnotationForm({
      id: annotation.id,
      type: annotation.type,
      message: annotation.message,
      date_start: annotation.date_start,
      date_end: annotation.date_end ?? "",
      task_id: annotation.task_id ?? "",
      intervenant_id: annotation.intervenant_id ?? "",
      is_resolved: annotation.is_resolved,
    });
    setAnnotationFormOpen(true);
    setDrawerError(null);
  }

  async function saveAnnotation() {
    const message = annotationForm.message.trim();
    if (!annotationForm.date_start || !message) {
      setDrawerError("Date debut et message annotation sont obligatoires.");
      return;
    }

    setSavingAnnotation(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      if (annotationForm.id) {
        await onUpdateAnnotation(annotationForm.id, {
          task_id: annotationForm.task_id || null,
          intervenant_id: annotationForm.intervenant_id || null,
          date_start: annotationForm.date_start,
          date_end: annotationForm.date_end || null,
          type: annotationForm.type,
          message,
          is_resolved: annotationForm.is_resolved,
        });
        setDrawerNotice("Annotation mise a jour.");
      } else {
        await onCreateAnnotation({
          lot_name: currentLot.name,
          task_id: annotationForm.task_id || null,
          intervenant_id: annotationForm.intervenant_id || null,
          date_start: annotationForm.date_start,
          date_end: annotationForm.date_end || null,
          type: annotationForm.type,
          message,
          is_resolved: annotationForm.is_resolved,
        });
        setDrawerNotice("Annotation creee.");
      }

      setAnnotationForm(emptyAnnotationForm(lotStartDate || currentLot.planning_start_date || ""));
      setAnnotationFormOpen(false);
    } catch (err: any) {
      setDrawerError(err?.message ?? "Impossible d'enregistrer l'annotation.");
    } finally {
      setSavingAnnotation(false);
    }
  }

  async function removeAnnotation(annotationId: string) {
    if (!window.confirm("Supprimer cette annotation ?")) return;
    setSavingAnnotation(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      await onDeleteAnnotation(annotationId);
      setDrawerNotice("Annotation supprimee.");
      if (annotationForm.id === annotationId) {
        setAnnotationForm(emptyAnnotationForm(lotStartDate || currentLot.planning_start_date || ""));
        setAnnotationFormOpen(false);
      }
    } catch (err: any) {
      setDrawerError(err?.message ?? "Impossible de supprimer l'annotation.");
    } finally {
      setSavingAnnotation(false);
    }
  }

  async function toggleResolved(annotation: PlanningAnnotationRow) {
    setSavingAnnotation(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      await onToggleAnnotationResolved(annotation);
      setDrawerNotice(annotation.is_resolved ? "Annotation reouverte." : "Annotation resolue.");
    } catch (err: any) {
      setDrawerError(err?.message ?? "Impossible de mettre a jour l'annotation.");
    } finally {
      setSavingAnnotation(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute right-0 top-0 h-screen w-full sm:w-[92vw] lg:w-[78vw] bg-white border-l shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-20 border-b bg-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Planning - {currentLot.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              {timelineTasks.length} tache(s) - {durationTotal} jour(s) estimes
              {lotStartDate ? ` - ${lotStartDate} -> ${effectiveEndDate || "-"}` : " - Non planifie"}
            </div>
          </div>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          {drawerError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{drawerError}</div>
          )}
          {drawerNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {drawerNotice}
            </div>
          )}

          <section className="rounded-2xl border bg-gradient-to-br from-slate-50 to-blue-50 p-4 space-y-4">
            <div className="font-semibold text-slate-800">Planning du lot</div>

            <div className="grid gap-3 md:grid-cols-12">
              <label className="space-y-1 text-sm md:col-span-4">
                <div className="text-xs text-slate-600">Nom lot</div>
                <input
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  value={lotNameDraft}
                  onChange={(e) => setLotNameDraft(e.target.value)}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-3">
                <div className="text-xs text-slate-600">Debut lot</div>
                <input
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  type="date"
                  value={lotStartDate}
                  onChange={(e) => setLotStartDate(e.target.value)}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-3">
                <div className="text-xs text-slate-600">Fin lot</div>
                <input
                  className="w-full rounded-xl border bg-slate-100 px-3 py-2 text-sm"
                  type="date"
                  value={manualEndLocked ? lotEndDateManual : effectiveEndDate}
                  onChange={(e) => setLotEndDateManual(e.target.value)}
                  readOnly={!manualEndLocked}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <div className="text-xs text-slate-600">Ordre lot</div>
                <input
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  value={lotOrderIndex}
                  onChange={(e) => setLotOrderIndex(e.target.value)}
                />
              </label>

              <label className="flex items-center gap-2 text-sm md:col-span-12">
                <input
                  type="checkbox"
                  checked={manualEndLocked}
                  onChange={(e) => setManualEndLocked(e.target.checked)}
                />
                Fin manuelle
              </label>
            </div>

            {!lotStartDate ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Non planifie. Choisissez une date de debut pour ce lot.
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-3 overflow-x-auto">
                <div className="grid grid-cols-[260px_minmax(700px,1fr)] gap-2 items-center border-b pb-2 mb-2">
                  <div className="text-xs font-medium text-slate-500">Tache</div>
                  <div className="relative h-6">
                    {timeline?.dayCells.map((cell, index) => {
                      const left = (index / timeline.totalDays) * 100;
                      if (!cell.isWeekStart && index !== 0) return null;
                      return (
                        <div
                          key={cell.date}
                          className="absolute top-0 -translate-x-1/2 text-[11px] text-slate-500"
                          style={{ left: `${left}%` }}
                        >
                          {cell.date.slice(8, 10)}/{cell.date.slice(5, 7)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-[260px_minmax(700px,1fr)] gap-2 items-center mb-2">
                  <div className="text-xs text-slate-500">Annotations</div>
                  <div className="relative h-7 rounded-lg border bg-slate-50 overflow-hidden">
                    {timeline?.dayCells.map((cell, index) => (
                      <div
                        key={`wk:${cell.date}`}
                        className={cell.isWeekend ? "absolute top-0 h-full bg-slate-200/45" : "hidden"}
                        style={{ left: `${(index / timeline.totalDays) * 100}%`, width: `${100 / timeline.totalDays}%` }}
                      />
                    ))}

                    {timeline?.todayVisible && (
                      <div
                        className="absolute top-0 h-full w-[2px] bg-red-500"
                        style={{ left: `${timeline.todayLeftPercent}%` }}
                        title="Aujourd'hui"
                      />
                    )}

                    {lotAnnotations.map((annotation) => {
                      if (!timeline) return null;
                      const left = (diffDays(timeline.start, annotation.date_start) / timeline.totalDays) * 100;
                      const linkedTask = annotation.task_id ? taskById.get(annotation.task_id) : null;
                      const linkedIntervenant = annotation.intervenant_id
                        ? intervenantById.get(annotation.intervenant_id)
                        : null;
                      return (
                        <button
                          key={annotation.id}
                          type="button"
                          className={[
                            "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border text-[10px] font-semibold",
                            annotationBadgeClass(annotation.type),
                          ].join(" ")}
                          style={{ left: `calc(${left}% - 10px)` }}
                          onClick={() => setAnnotationPopoverId((prev) => (prev === annotation.id ? null : annotation.id))}
                          title={annotation.message}
                        >
                          {annotationIcon(annotation.type)}
                          {annotationPopoverId === annotation.id && (
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-72 rounded-lg border bg-white p-2 text-left text-xs text-slate-700 shadow-lg">
                              <span className="font-medium block">{annotation.message}</span>
                              <span className="text-slate-500 block mt-1">
                                {annotation.date_start}
                                {annotation.date_end ? ` -> ${annotation.date_end}` : ""}
                              </span>
                              <span className="text-slate-500 block mt-1">Tache: {linkedTask?.titre ?? "-"}</span>
                              <span className="text-slate-500 block">Intervenant: {linkedIntervenant?.nom ?? "-"}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 min-w-[960px]">
                  {timeline?.windows.map((window) => {
                    const left = (diffDays(timeline.start, window.start) / timeline.totalDays) * 100;
                    const width = Math.max(2, (window.durationDays / timeline.totalDays) * 100);
                    return (
                      <div key={window.task.id} className="grid grid-cols-[260px_minmax(700px,1fr)] gap-2 items-center">
                        <div className="text-xs text-slate-700 pr-2 truncate">
                          <span className="font-medium">{window.task.titre}</span>
                          <span className="text-slate-500"> - {window.durationDays}j</span>
                        </div>
                        <div className="relative h-8 rounded-lg border bg-slate-50 overflow-hidden">
                          {timeline.dayCells.map((cell, dayIndex) => (
                            <div
                              key={`row:${window.task.id}:${cell.date}`}
                              className={cell.isWeekend ? "absolute top-0 h-full bg-slate-200/45" : "hidden"}
                              style={{ left: `${(dayIndex / timeline.totalDays) * 100}%`, width: `${100 / timeline.totalDays}%` }}
                            />
                          ))}
                          <div
                            className="absolute top-1 h-6 rounded-md bg-blue-600"
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${window.task.titre} (${window.durationDays}j)`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="px-3 py-2 border-b text-sm font-medium text-slate-700">Taches du lot</div>
              {orderedTasks.length === 0 ? (
                <div className="p-3 text-sm text-slate-500">Aucune tache dans ce lot.</div>
              ) : (
                <div className="divide-y">
                  {orderedTasks.map((task) => {
                    const durationDraft = durationDrafts[task.id] ?? String(safeDuration(task.duration_days));
                    return (
                      <div
                        key={task.id}
                        className="grid grid-cols-[32px_minmax(280px,1fr)_150px_90px] items-center gap-2 px-3 py-2"
                        draggable
                        onDragStart={() => setDraggingTaskId(task.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => void handleDropOnTask(task.id)}
                      >
                        <button
                          type="button"
                          className="cursor-grab rounded border bg-slate-50 text-slate-500 text-xs"
                          title="Glisser pour reordonner"
                        >
                          ::
                        </button>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{task.titre}</div>
                          <div className="text-xs text-slate-500">{task.status}</div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          Duree
                          <input
                            className="w-20 rounded-lg border px-2 py-1 text-sm"
                            type="number"
                            min={1}
                            step={1}
                            value={durationDraft}
                            onChange={(e) =>
                              setDurationDrafts((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                            onBlur={() => void persistTaskDuration(task)}
                          />
                        </label>
                        <span className="text-xs text-slate-500 text-right">{safeDuration(durationDraft)}j</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">Annotations du lot</div>
                  <div className="text-xs text-slate-500">Creation et edition des drapeaux lies a ce lot.</div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"
                  onClick={openCreateAnnotationForm}
                >
                  Nouvelle annotation
                </button>
              </div>

              {lotAnnotations.length === 0 ? (
                <div className="rounded-lg border p-3 text-sm text-slate-500">Aucune annotation pour ce lot.</div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {lotAnnotations.map((annotation) => {
                    const linkedTask = annotation.task_id ? taskById.get(annotation.task_id) ?? null : null;
                    const linkedIntervenant = annotation.intervenant_id
                      ? intervenantById.get(annotation.intervenant_id) ?? null
                      : null;

                    return (
                      <div key={annotation.id} className="p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={["rounded-full border px-2 py-1 text-[11px]", annotationBadgeClass(annotation.type)].join(" ")}>
                              {annotation.type}
                            </span>
                            <span
                              className={[
                                "rounded-full border px-2 py-1 text-[11px]",
                                annotation.is_resolved
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700",
                              ].join(" ")}
                            >
                              {annotation.is_resolved ? "Traitee" : "Ouverte"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {annotation.date_start}
                            {annotation.date_end ? ` -> ${annotation.date_end}` : ""}
                          </div>
                        </div>
                        <div className="mt-1 font-medium">{annotation.message}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Tache: {linkedTask?.titre ?? "-"} | Intervenant: {linkedIntervenant?.nom ?? "-"}
                        </div>
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            onClick={() => openEditAnnotationForm(annotation)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            onClick={() => void toggleResolved(annotation)}
                            disabled={savingAnnotation}
                          >
                            {annotation.is_resolved ? "Reouvrir" : "Resoudre"}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => void removeAnnotation(annotation.id)}
                            disabled={savingAnnotation}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {annotationFormOpen && (
                <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {annotationForm.id ? "Modifier annotation" : "Nouvelle annotation"}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
                      onClick={() => {
                        setAnnotationForm(emptyAnnotationForm(lotStartDate || currentLot.planning_start_date || ""));
                        setAnnotationFormOpen(false);
                      }}
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <div className="text-xs text-slate-600">Type</div>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={annotationForm.type}
                        onChange={(e) =>
                          setAnnotationForm((prev) => ({
                            ...prev,
                            type: e.target.value as PlanningAnnotationType,
                          }))
                        }
                      >
                        <option value="flag">Flag</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <div className="text-xs text-slate-600">Tache liee (optionnel)</div>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={annotationForm.task_id}
                        onChange={(e) => setAnnotationForm((prev) => ({ ...prev, task_id: e.target.value }))}
                      >
                        <option value="">Aucune</option>
                        {orderedTasks.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.titre}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <div className="text-xs text-slate-600">Date debut</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        type="date"
                        value={annotationForm.date_start}
                        onChange={(e) => setAnnotationForm((prev) => ({ ...prev, date_start: e.target.value }))}
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <div className="text-xs text-slate-600">Date fin</div>
                      <input
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        type="date"
                        value={annotationForm.date_end}
                        onChange={(e) => setAnnotationForm((prev) => ({ ...prev, date_end: e.target.value }))}
                      />
                    </label>

                    <label className="space-y-1 text-sm md:col-span-2">
                      <div className="text-xs text-slate-600">Intervenant lie (optionnel)</div>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={annotationForm.intervenant_id}
                        onChange={(e) =>
                          setAnnotationForm((prev) => ({
                            ...prev,
                            intervenant_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Aucun</option>
                        {intervenants.map((intervenant) => (
                          <option key={intervenant.id} value={intervenant.id}>
                            {intervenant.nom}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm md:col-span-2">
                      <div className="text-xs text-slate-600">Motif / message</div>
                      <textarea
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm min-h-24"
                        value={annotationForm.message}
                        onChange={(e) => setAnnotationForm((prev) => ({ ...prev, message: e.target.value }))}
                      />
                    </label>

                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                      <input
                        type="checkbox"
                        checked={annotationForm.is_resolved}
                        onChange={(e) =>
                          setAnnotationForm((prev) => ({
                            ...prev,
                            is_resolved: e.target.checked,
                          }))
                        }
                      />
                      Marquer comme traitee
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-xl border px-3 py-2 text-sm hover:bg-white"
                      onClick={() => setAnnotationForm(emptyAnnotationForm(lotStartDate || currentLot.planning_start_date || ""))}
                    >
                      Reinitialiser
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                      onClick={() => void saveAnnotation()}
                      disabled={savingAnnotation}
                    >
                      {savingAnnotation ? "Enregistrement..." : annotationForm.id ? "Mettre a jour" : "Ajouter"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                onClick={() => void saveLot()}
                disabled={savingLot || savingTasks || savingAnnotation}
              >
                {savingLot ? "Enregistrement..." : "Enregistrer lot"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
