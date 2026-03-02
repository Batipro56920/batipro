import { useEffect, useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, GripVertical, Plus, Scissors, Trash2, X } from "lucide-react";
import type { IntervenantRow } from "../../services/intervenants.service";
import {
  createPlanningCalendarTask,
  deletePlanningCalendarTasks,
  getPlanningCalendarState,
  updatePlanningCalendarSettings,
  updatePlanningCalendarTask,
  type PlanningCalendarState,
  type PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  addDaysToKey,
  buildSplitDates,
  clampDurationDays,
  compareDateKeys,
  computePlannedHours,
  DEFAULT_PLANNING_SETTINGS,
  distributeDayLoads,
  formatDateKey,
  getCoveredDates,
  parseDateKey,
  startOfMonthGrid,
  startOfWeek,
  statusPriority,
  type PlanningCalendarSettings,
  type SplitMode,
} from "./planningCalendar.utils";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

type PlanningView = "day" | "week" | "month";
type DrawerState =
  | { mode: "task"; taskId: string }
  | { mode: "create"; startDate: string | null }
  | { mode: "day"; day: string }
  | null;

type TaskDraft = {
  titre: string;
  description: string;
  status: string;
  lot: string;
  intervenant_id: string;
  date_debut: string;
  duration_days: number;
};

type TaskSegment = {
  task: PlanningCalendarTask;
  isStart: boolean;
  isEnd: boolean;
};

const VIEW_OPTIONS: Array<{ value: PlanningView; label: string }> = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

const DURATION_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7];
const STATUS_OPTIONS = [
  { value: "A_FAIRE", label: "A faire" },
  { value: "EN_COURS", label: "En cours" },
  { value: "FAIT", label: "Terminee" },
  { value: "BLOQUE", label: "Bloquee" },
];

function formatDisplayDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatShortDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function addMonthsToKey(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  return formatDateKey(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}

function statusAccent(status: string): string {
  const key = status.toUpperCase();
  if (key === "EN_COURS") return "border-l-amber-500 bg-amber-50/60";
  if (key === "FAIT") return "border-l-emerald-500 bg-emerald-50/60";
  if (key === "BLOQUE") return "border-l-rose-500 bg-rose-50/60";
  return "border-l-blue-500 bg-white";
}

function segmentedButton(active: boolean): string {
  return active
    ? "rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
    : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100";
}

function buttonClass(kind: "primary" | "secondary" | "danger" = "secondary"): string {
  if (kind === "primary") return "rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700";
  if (kind === "danger") return "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100";
  return "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
}

function inputClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100";
}

function getDefaultDraft(task?: PlanningCalendarTask | null, startDate?: string | null): TaskDraft {
  return {
    titre: task?.titre ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "A_FAIRE",
    lot: task?.lot ?? task?.corps_etat ?? "",
    intervenant_id: task?.intervenant_id ?? "",
    date_debut: task?.date_debut ?? startDate ?? "",
    duration_days: clampDurationDays(task?.duration_days ?? 1),
  };
}

function DayDropZone({
  dateKey,
  title,
  onAdd,
  children,
}: {
  dateKey: string;
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey}` });
  return (
    <div
      ref={setNodeRef}
      className={[
        "flex min-w-0 min-h-[14rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 lg:p-3",
        isOver ? "border-blue-400 bg-blue-50/60" : "",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-900 lg:text-sm">{title}</div>
          <div className="text-[11px] text-slate-500">Depot ou clic</div>
        </div>
        <button type="button" className={buttonClass()} onClick={onAdd} aria-label={`Ajouter sur ${title}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function TaskCard({
  cardId,
  segment,
  assigneeName,
  isSelected,
  draggable,
  onToggleSelect,
  onOpen,
  onShiftOrder,
  onResize,
  onDelete,
}: {
  cardId: string;
  segment: TaskSegment;
  assigneeName: string;
  isSelected: boolean;
  draggable: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onShiftOrder?: (delta: number) => void;
  onResize: (delta: number) => void;
  onDelete: () => void;
}) {
  const draggableApi = useDraggable({ id: draggable ? `task:${segment.task.id}` : `segment:${cardId}` });
  const style =
    draggable && draggableApi.transform
      ? { transform: `translate3d(${draggableApi.transform.x}px, ${draggableApi.transform.y}px, 0)` }
      : undefined;
  const listeners = draggable ? draggableApi.listeners : undefined;
  const attributes = draggable ? draggableApi.attributes : undefined;
  const setNodeRef = draggable ? draggableApi.setNodeRef : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-2xl border border-slate-200 border-l-4 p-2 shadow-sm transition",
        statusAccent(segment.task.status),
        isSelected ? "ring-2 ring-blue-200" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        {segment.isStart ? (
          <>
            <label className="mt-1 flex shrink-0 items-center">
              <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="h-4 w-4 rounded border-slate-300" />
            </label>
            {draggable ? (
              <button
                type="button"
                className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100"
                {...listeners}
                {...attributes}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : null}
          </>
        ) : (
          <div className="mt-2 h-2 w-2 rounded-full bg-slate-300" />
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="truncate text-sm font-semibold text-slate-900">{segment.isStart ? segment.task.titre : `Suite - ${segment.task.titre}`}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span>{segment.task.duration_days}j</span>
            {assigneeName ? <span>{assigneeName}</span> : null}
            {(segment.task.lot || segment.task.corps_etat) ? <span>{segment.task.lot ?? segment.task.corps_etat}</span> : null}
          </div>
        </button>
        {segment.isStart ? (
          <div className="flex shrink-0 items-center gap-1">
            {onShiftOrder ? (
              <>
                <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onShiftOrder(-1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onShiftOrder(1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
            <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onResize(-0.25)}>
              -
            </button>
            <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onResize(0.25)}>
              +
            </button>
            <button type="button" className="rounded-lg border border-rose-200 px-1.5 py-1 text-xs text-rose-700" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
export default function PlanningTab({ chantierId, chantierName, intervenants }: Props) {
  const [state, setState] = useState<PlanningCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<PlanningView>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "month";
    return "week";
  });
  const [anchorDate, setAnchorDate] = useState(() => formatDateKey(new Date()));
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [draft, setDraft] = useState<TaskDraft>(() => getDefaultDraft(null, null));
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [backlogQuery, setBacklogQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("__all__");
  const [mergeAssigneeChoice, setMergeAssigneeChoice] = useState("__none__");
  const [splitParts, setSplitParts] = useState(2);
  const [splitMode, setSplitMode] = useState<SplitMode>("sequential");
  const [showSettings, setShowSettings] = useState(false);
  const [taskPanelTab, setTaskPanelTab] = useState<"backlog" | "planned">("backlog");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [lotFilter, setLotFilter] = useState("__all__");

  const settings = state?.settings ?? DEFAULT_PLANNING_SETTINGS;
  const tasks = state?.tasks ?? [];
  const chantier = state?.chantier ?? null;
  const mergedMetaSupported = Boolean(state?.mergedMetaSupported);

  async function loadAll(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const nextState = await getPlanningCalendarState(chantierId);
      setState(nextState);
      setSelectedTaskIds((current) => current.filter((id) => nextState.tasks.some((task) => task.id === id)));
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement planning.");
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(false);
  }, [chantierId]);

  const intervenantsById = useMemo(() => {
    const map = new Map<string, IntervenantRow>();
    for (const intervenant of intervenants) map.set(intervenant.id, intervenant);
    return map;
  }, [intervenants]);

  const uniqueLots = useMemo(
    () =>
      [...new Set(tasks.map((task) => task.lot ?? task.corps_etat ?? "").filter((value) => String(value).trim()))].sort((a, b) =>
        String(a).localeCompare(String(b), "fr"),
      ),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const query = backlogQuery.trim().toLowerCase();
    return tasks
      .filter((task) => (assigneeFilter === "__all__" ? true : task.intervenant_id === assigneeFilter))
      .filter((task) => (statusFilter === "__all__" ? true : task.status === statusFilter))
      .filter((task) => (lotFilter === "__all__" ? true : (task.lot ?? task.corps_etat ?? "") === lotFilter))
      .filter((task) => {
        if (!query) return true;
        return [task.titre, task.description ?? "", task.lot ?? "", task.corps_etat ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const statusDiff = statusPriority(a.status) - statusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;
        return a.titre.localeCompare(b.titre, "fr");
      });
  }, [assigneeFilter, backlogQuery, lotFilter, statusFilter, tasks]);

  const backlogTasks = useMemo(() => filteredTasks.filter((task) => !task.date_debut), [filteredTasks]);
  const plannedTasks = useMemo(() => filteredTasks.filter((task) => task.date_debut), [filteredTasks]);

  const visibleDays = useMemo(() => {
    if (view === "day") return [anchorDate];
    if (view === "week") {
      const start = startOfWeek(anchorDate);
      return Array.from({ length: 7 }, (_, index) => addDaysToKey(start, index));
    }
    const start = startOfMonthGrid(anchorDate);
    return Array.from({ length: 42 }, (_, index) => addDaysToKey(start, index));
  }, [anchorDate, view]);

  const visibleDaySet = useMemo(() => new Set(visibleDays), [visibleDays]);

  const daySegments = useMemo(() => {
    const map = new Map<string, TaskSegment[]>();
    for (const day of visibleDays) map.set(day, []);

    for (const task of plannedTasks) {
      if (!task.date_debut) continue;
      const covered = getCoveredDates(task.date_debut, task.duration_days, settings);
      for (let index = 0; index < covered.length; index += 1) {
        const date = covered[index];
        if (!visibleDaySet.has(date)) continue;
        const list = map.get(date) ?? [];
        list.push({
          task,
          isStart: index === 0,
          isEnd: index === covered.length - 1,
        });
        map.set(date, list);
      }
    }

    for (const [date, list] of map.entries()) {
      list.sort((a, b) => {
        const startDiff = compareDateKeys(a.task.date_debut ?? date, b.task.date_debut ?? date);
        if (startDiff !== 0) return startDiff;
        const orderDiff = a.task.order_index - b.task.order_index;
        if (orderDiff !== 0) return orderDiff;
        const statusDiff = statusPriority(a.task.status) - statusPriority(b.task.status);
        if (statusDiff !== 0) return statusDiff;
        return a.task.titre.localeCompare(b.task.titre, "fr");
      });
    }

    return map;
  }, [plannedTasks, settings, visibleDaySet, visibleDays]);

  const selectedTasks = useMemo(() => tasks.filter((task) => selectedTaskIds.includes(task.id)), [selectedTaskIds, tasks]);

  const rangeSummary = useMemo(() => {
    const totalsByIntervenant = new Map<string, number>();
    const warnings: string[] = [];
    const totalByDay = new Map<string, number>();
    const totalByIntervenantDay = new Map<string, number>();
    let totalHours = 0;

    for (const task of plannedTasks) {
      if (!task.date_debut) continue;
      const loads = distributeDayLoads(task.duration_days, task.date_debut, settings).filter((entry) => visibleDaySet.has(entry.date));
      for (const load of loads) {
        const dayHours = load.load * settings.hoursPerDay;
        totalHours += dayHours;
        totalByDay.set(load.date, (totalByDay.get(load.date) ?? 0) + load.load);
        if (task.intervenant_id) {
          const key = `${task.intervenant_id}:${load.date}`;
          totalByIntervenantDay.set(key, (totalByIntervenantDay.get(key) ?? 0) + load.load);
          totalsByIntervenant.set(task.intervenant_id, (totalsByIntervenant.get(task.intervenant_id) ?? 0) + dayHours);
        }
      }
    }

    for (const [key, value] of totalByIntervenantDay.entries()) {
      if (value <= 1) continue;
      const [intervenantId, date] = key.split(":");
      warnings.push(`Surcharge ${intervenantsById.get(intervenantId)?.nom ?? "intervenant"} le ${formatShortDate(date)} (${value.toFixed(2)}j)`);
    }

    for (const [date, value] of totalByDay.entries()) {
      if (value <= settings.dayCapacity) continue;
      warnings.push(`Charge globale forte le ${formatShortDate(date)} (${value.toFixed(2)}j / cap ${settings.dayCapacity}j)`);
    }

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalsByIntervenant: [...totalsByIntervenant.entries()].sort((a, b) => b[1] - a[1]),
      warnings,
    };
  }, [intervenantsById, plannedTasks, settings, visibleDaySet]);

  const currentTask = useMemo(() => {
    if (!drawer || drawer.mode !== "task") return null;
    return tasks.find((task) => task.id === drawer.taskId) ?? null;
  }, [drawer, tasks]);

  const drawerDayTasks = useMemo(() => {
    if (!drawer || drawer.mode !== "day") return [];
    return daySegments.get(drawer.day)?.map((segment) => segment.task).filter((task, index, arr) => arr.findIndex((entry) => entry.id === task.id) === index) ?? [];
  }, [daySegments, drawer]);
  const backlogDrop = useDroppable({ id: "backlog" });

  useEffect(() => {
    if (drawer?.mode === "task" && currentTask) {
      setDraft(getDefaultDraft(currentTask, currentTask.date_debut));
    }
    if (drawer?.mode === "create") {
      setDraft(getDefaultDraft(null, drawer.startDate));
    }
  }, [currentTask, drawer]);
  async function persistTask(taskId: string, patch: Parameters<typeof updatePlanningCalendarTask>[1]) {
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarTask(taskId, patch, settings, mergedMetaSupported);
      await loadAll(true);
      setNotice("Planning mis a jour.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise a jour tache.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    try {
      if (drawer?.mode === "task" && currentTask) {
        await updatePlanningCalendarTask(
          currentTask.id,
          {
            titre: draft.titre,
            description: draft.description || null,
            status: draft.status,
            lot: draft.lot || null,
            corps_etat: draft.lot || null,
            intervenant_id: draft.intervenant_id || null,
            date_debut: draft.date_debut || null,
            date_fin: draft.date_debut ? undefined : null,
            duration_days: draft.duration_days,
          },
          settings,
          mergedMetaSupported,
        );
      } else {
        await createPlanningCalendarTask(
          chantierId,
          {
            titre: draft.titre,
            description: draft.description || null,
            status: draft.status,
            lot: draft.lot || null,
            corps_etat: draft.lot || null,
            intervenant_id: draft.intervenant_id || null,
            date_debut: draft.date_debut || null,
            duration_days: draft.duration_days,
          },
          settings,
          mergedMetaSupported,
        );
      }
      setDrawer(null);
      await loadAll(true);
      setNotice("Tache enregistree.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(taskId: string) {
    const confirmed = typeof window === "undefined" ? true : window.confirm("Supprimer cette tache ?");
    if (!confirmed) return;
    setSaving(true);
    try {
      await deletePlanningCalendarTasks([taskId]);
      setDrawer((current) => (current && current.mode === "task" && current.taskId === taskId ? null : current));
      await loadAll(true);
      setNotice("Tache supprimee.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur suppression.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!currentTask) return;
    setSaving(true);
    try {
      const nextStart = currentTask.date_debut ? addDaysToKey(currentTask.date_fin ?? currentTask.date_debut, 1) : null;
      await createPlanningCalendarTask(
        chantierId,
        {
          titre: `${currentTask.titre} (copie)`,
          description: currentTask.description,
          status: currentTask.status,
          lot: currentTask.lot,
          corps_etat: currentTask.corps_etat,
          intervenant_id: currentTask.intervenant_id,
          date_debut: nextStart,
          duration_days: currentTask.duration_days,
          merged_from_task_ids: currentTask.merged_from_task_ids,
        },
        settings,
        mergedMetaSupported,
      );
      await loadAll(true);
      setNotice("Tache dupliquee.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur duplication.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMerge() {
    if (selectedTasks.length < 2) return;
    const distinctAssignees = [...new Set(selectedTasks.map((task) => task.intervenant_id).filter(Boolean))];
    const assigneeToKeep = distinctAssignees.length > 1 ? (mergeAssigneeChoice === "__none__" ? null : mergeAssigneeChoice) : distinctAssignees[0] ?? null;
    const sorted = [...selectedTasks].sort((a, b) => compareDateKeys(a.date_debut ?? "9999-12-31", b.date_debut ?? "9999-12-31"));
    const first = sorted[0];
    const totalDuration = selectedTasks.reduce((sum, task) => sum + clampDurationDays(task.duration_days), 0);

    setSaving(true);
    try {
      await createPlanningCalendarTask(
        chantierId,
        {
          titre: `${first.titre} + ${selectedTasks.length - 1}`,
          description: first.description,
          status: selectedTasks.some((task) => task.status === "EN_COURS") ? "EN_COURS" : "A_FAIRE",
          lot: first.lot ?? first.corps_etat,
          corps_etat: first.corps_etat ?? first.lot,
          intervenant_id: assigneeToKeep,
          date_debut: first.date_debut,
          duration_days: totalDuration,
          merged_from_task_ids: selectedTasks.map((task) => task.id),
        },
        settings,
        mergedMetaSupported,
      );
      await deletePlanningCalendarTasks(selectedTasks.map((task) => task.id));
      setSelectedTaskIds([]);
      await loadAll(true);
      setNotice("Taches fusionnees.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur fusion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSplit() {
    if (selectedTasks.length !== 1) return;
    const task = selectedTasks[0];
    const splits = buildSplitDates(task.date_debut ?? anchorDate, task.duration_days, splitParts, splitMode, settings);
    setSaving(true);
    try {
      for (let index = 0; index < splits.length; index += 1) {
        const split = splits[index];
        await createPlanningCalendarTask(
          chantierId,
          {
            titre: `${task.titre} (${index + 1}/${splits.length})`,
            description: task.description,
            status: task.status,
            lot: task.lot,
            corps_etat: task.corps_etat,
            intervenant_id: task.intervenant_id,
            date_debut: task.date_debut ? split.startDate : null,
            duration_days: split.durationDays,
          },
          settings,
          mergedMetaSupported,
        );
      }
      await deletePlanningCalendarTasks([task.id]);
      setSelectedTaskIds([]);
      await loadAll(true);
      setNotice("Tache decoupee.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur decoupe.");
    } finally {
      setSaving(false);
    }
  }

  async function reorderWithinDay(date: string, taskId: string, delta: number) {
    const startSegments = (daySegments.get(date) ?? []).filter((segment) => segment.isStart);
    const currentIndex = startSegments.findIndex((segment) => segment.task.id === taskId);
    const nextIndex = currentIndex + delta;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= startSegments.length) return;

    const currentTask = startSegments[currentIndex].task;
    const targetTask = startSegments[nextIndex].task;

    setSaving(true);
    try {
      await updatePlanningCalendarTask(currentTask.id, { order_index: targetTask.order_index }, settings, mergedMetaSupported);
      await updatePlanningCalendarTask(targetTask.id, { order_index: currentTask.order_index }, settings, mergedMetaSupported);
      await loadAll(true);
    } catch (err: any) {
      setError(err?.message ?? "Erreur reorganisation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id ?? "").replace(/^task:/, "");
    const overId = String(event.over?.id ?? "");
    if (!taskId || !overId) return;
    if (overId === "backlog") {
      await persistTask(taskId, { date_debut: null, date_fin: null });
      return;
    }
    if (overId.startsWith("day:")) {
      const date = overId.replace(/^day:/, "");
      const dayTasks = (daySegments.get(date) ?? [])
        .map((segment) => segment.task)
        .filter((task, index, arr) => arr.findIndex((entry) => entry.id === task.id) === index);
      await persistTask(taskId, { date_debut: date, order_index: dayTasks.length });
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
  }

  function navigate(offset: number) {
    if (view === "month") setAnchorDate((current) => addMonthsToKey(current, offset));
    else if (view === "week") setAnchorDate((current) => addDaysToKey(current, offset * 7));
    else setAnchorDate((current) => addDaysToKey(current, offset));
  }

  async function saveSettings(patch: Partial<PlanningCalendarSettings>) {
    setSaving(true);
    try {
      await updatePlanningCalendarSettings(chantierId, patch);
      await loadAll(true);
      setNotice("Parametres planning mis a jour.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur parametres planning.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement planning...</div>;
  }

  return (
    <DndContext onDragEnd={(event) => void handleDragEnd(event)}>
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">Planning chantier</h2>
                {chantierName ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{chantierName}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                  {VIEW_OPTIONS.map((option) => (
                    <button key={option.value} type="button" className={segmentedButton(view === option.value)} onClick={() => setView(option.value)}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-full border border-slate-200 p-1">
                  <button type="button" className={buttonClass()} onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" className={buttonClass()} onClick={() => setAnchorDate(formatDateKey(new Date()))}>Aujourd'hui</button>
                  <button type="button" className={buttonClass()} onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[48rem]">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_12rem_12rem_10rem_auto] xl:items-center">
                <input className={inputClass()} placeholder="Recherche" value={backlogQuery} onChange={(e) => setBacklogQuery(e.target.value)} />
                <select className={inputClass()} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                  <option value="__all__">Tous les intervenants</option>
                  {intervenants.map((it) => (
                    <option key={it.id} value={it.id}>{it.nom}</option>
                  ))}
                </select>
                <select className={inputClass()} value={lotFilter} onChange={(e) => setLotFilter(e.target.value)}>
                  <option value="__all__">Tous les lots</option>
                  {uniqueLots.map((lot) => (
                    <option key={lot} value={lot}>{lot}</option>
                  ))}
                </select>
                <select className={inputClass()} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="__all__">Tous les statuts</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button type="button" className={buttonClass()} onClick={() => setShowSettings((current) => !current)}>
                  {showSettings ? "Masquer reglages" : "Reglages"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{`${visibleDays[0]} -> ${visibleDays[visibleDays.length - 1]}`}</span>
                <span>{rangeSummary.totalHours}h prevues</span>
                <span>{rangeSummary.warnings.length} alerte(s)</span>
                {state?.planningColumnsMissing ? <span className="text-amber-700">Migration planning a pousser</span> : null}
              </div>
            </div>
          </div>

          {selectedTasks.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm font-medium text-blue-900">{selectedTasks.length} tache(s) selectionnee(s)</div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedTasks.length >= 2 ? (
                    <>
                      {[...new Set(selectedTasks.map((task) => task.intervenant_id).filter(Boolean))].length > 1 ? (
                        <select className={inputClass()} value={mergeAssigneeChoice} onChange={(e) => setMergeAssigneeChoice(e.target.value)}>
                          <option value="__none__">Aucun intervenant</option>
                          {intervenants.map((it) => (
                            <option key={it.id} value={it.id}>{it.nom}</option>
                          ))}
                        </select>
                      ) : null}
                      <button type="button" className={buttonClass("primary")} onClick={() => void handleMerge()}>Fusionner</button>
                    </>
                  ) : null}
                  {selectedTasks.length === 1 ? (
                    <>
                      <input type="number" min="2" max="6" className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={splitParts} onChange={(e) => setSplitParts(Math.max(2, Math.min(6, Number(e.target.value) || 2)))} />
                      <select className={inputClass()} value={splitMode} onChange={(e) => setSplitMode(e.target.value as SplitMode)}>
                        <option value="sequential">A la suite</option>
                        <option value="same_day">Meme jour</option>
                      </select>
                      <button type="button" className={buttonClass()} onClick={() => void handleSplit()}><Scissors className="mr-1 inline h-4 w-4" />Decouper</button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={buttonClass("danger")}
                    onClick={() => void (async () => {
                      try {
                        await deletePlanningCalendarTasks(selectedTaskIds);
                        setSelectedTaskIds([]);
                        await loadAll(true);
                      } catch (err: any) {
                        setError(err?.message ?? "Erreur suppression.");
                      }
                    })()}
                  >
                    <Trash2 className="mr-1 inline h-4 w-4" />Supprimer
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}
          {rangeSummary.warnings.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {rangeSummary.warnings.slice(0, 4).map((warning) => (
                <span key={warning} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{warning}</span>
              ))}
            </div>
          ) : null}
          {showSettings ? (
            <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Heures / jour</span>
                <input type="number" min="1" step="0.5" className={inputClass()} defaultValue={settings.hoursPerDay} onBlur={(e) => void saveSettings({ hoursPerDay: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Capacite jour (j)</span>
                <input type="number" min="1" step="0.25" className={inputClass()} defaultValue={settings.dayCapacity} onBlur={(e) => void saveSettings({ dayCapacity: Number(e.target.value) })} />
              </label>
              <label className="flex items-center gap-2 pt-6 text-xs text-slate-600">
                <input type="checkbox" defaultChecked={settings.skipWeekends} onChange={(e) => void saveSettings({ skipWeekends: e.target.checked })} />
                Ignorer samedi et dimanche
              </label>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">Calendrier</div>
            <div className="text-xs text-slate-500">Zone principale du planning</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
            {view === "month" ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
                {visibleDays.map((day) => {
                  const segments = daySegments.get(day) ?? [];
                  const visible = segments.slice(0, 3);
                  return (
                    <button key={day} type="button" className="min-h-[10rem] rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200" onClick={() => setDrawer({ mode: "day", day })}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-500">{formatDisplayDate(day)}</div>
                          <div className="text-sm font-semibold text-slate-900">{day.slice(8, 10)}</div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{segments.length}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {visible.map((segment) => (
                          <div key={`${day}:${segment.task.id}`} className={["truncate rounded-xl border border-l-4 px-2 py-1 text-xs", statusAccent(segment.task.status)].join(" ")}>
                            {segment.task.titre}
                          </div>
                        ))}
                        {segments.length > visible.length ? <div className="text-xs font-medium text-blue-700">+{segments.length - visible.length}</div> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={view === "day" ? "grid gap-3" : "grid grid-cols-7 gap-2 lg:gap-3"}>
                {visibleDays.map((day) => (
                  <DayDropZone key={day} dateKey={day} title={formatDisplayDate(day)} onAdd={() => setDrawer({ mode: "create", startDate: day })}>
                    {(daySegments.get(day) ?? []).map((segment) => (
                      <TaskCard
                        key={`${day}:${segment.task.id}:${segment.isStart ? "s" : "c"}`}
                        cardId={`${day}:${segment.task.id}:${segment.isStart ? "s" : "c"}`}
                        segment={segment}
                        assigneeName={segment.task.intervenant_id ? intervenantsById.get(segment.task.intervenant_id)?.nom ?? "" : ""}
                        isSelected={selectedTaskIds.includes(segment.task.id)}
                        draggable={segment.isStart}
                        onToggleSelect={() => toggleTaskSelection(segment.task.id)}
                        onOpen={() => setDrawer({ mode: "task", taskId: segment.task.id })}
                        onShiftOrder={segment.isStart ? (delta) => void reorderWithinDay(day, segment.task.id, delta) : undefined}
                        onResize={(delta) => void persistTask(segment.task.id, { duration_days: clampDurationDays(segment.task.duration_days + delta) })}
                        onDelete={() => void handleDelete(segment.task.id)}
                      />
                    ))}
                  </DayDropZone>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 border-b border-slate-100 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Taches</div>
                <div className="text-xs text-slate-500">Liste compacte, scrollable, ouverture du drawer au clic</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button type="button" className={segmentedButton(taskPanelTab === "backlog")} onClick={() => setTaskPanelTab("backlog")}>Non planifiees</button>
                  <button type="button" className={segmentedButton(taskPanelTab === "planned")} onClick={() => setTaskPanelTab("planned")}>Planifiees</button>
                </div>
                <button type="button" className={buttonClass("primary")} onClick={() => setDrawer({ mode: "create", startDate: null })}>
                  <Plus className="mr-1 inline h-4 w-4" />Ajouter une tache
                </button>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {taskPanelTab === "backlog" ? backlogTasks.length : plannedTasks.length} element(s)
                </span>
              </div>
            </div>
          </div>

          <div className="max-h-[24rem] overflow-auto pr-1">
            {taskPanelTab === "backlog" ? (
              <div ref={backlogDrop.setNodeRef} className={["space-y-2 rounded-2xl border border-dashed border-slate-200 p-2", backlogDrop.isOver ? "border-blue-400 bg-blue-50/60" : ""].join(" ")}>
                {backlogTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucune tache non planifiee.</div>
                ) : (
                  backlogTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      cardId={`backlog:${task.id}`}
                      segment={{ task, isStart: true, isEnd: true }}
                      assigneeName={task.intervenant_id ? intervenantsById.get(task.intervenant_id)?.nom ?? "" : ""}
                      isSelected={selectedTaskIds.includes(task.id)}
                      draggable
                      onToggleSelect={() => toggleTaskSelection(task.id)}
                      onOpen={() => setDrawer({ mode: "task", taskId: task.id })}
                      onResize={(delta) => void persistTask(task.id, { duration_days: clampDurationDays(task.duration_days + delta) })}
                      onDelete={() => void handleDelete(task.id)}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[minmax(14rem,2fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_6rem_8rem_3rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <span>Tache</span>
                  <span>Lot</span>
                  <span>Intervenant</span>
                  <span>Duree</span>
                  <span>Statut</span>
                  <span></span>
                </div>
                <div className="divide-y divide-slate-100">
                  {plannedTasks.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-slate-500">Aucune tache planifiee avec les filtres actuels.</div>
                  ) : (
                    plannedTasks.map((task) => (
                      <button key={task.id} type="button" className="grid w-full grid-cols-[minmax(14rem,2fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_6rem_8rem_3rem] gap-3 px-3 py-3 text-left hover:bg-slate-50" onClick={() => setDrawer({ mode: "task", taskId: task.id })}>
                        <span className="min-w-0 truncate text-sm font-medium text-slate-900">{task.titre}</span>
                        <span className="truncate text-sm text-slate-600">{task.lot ?? task.corps_etat ?? "-"}</span>
                        <span className="truncate text-sm text-slate-600">{task.intervenant_id ? intervenantsById.get(task.intervenant_id)?.nom ?? "-" : "-"}</span>
                        <span className="text-sm text-slate-600">{task.duration_days}j</span>
                        <span className="text-sm text-slate-600">{STATUS_OPTIONS.find((option) => option.value === task.status)?.label ?? task.status}</span>
                        <span className="text-right text-slate-400">�</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {drawer ? (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setDrawer(null)} aria-label="Fermer" />
            <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl xl:inset-y-4 xl:right-4 xl:left-auto xl:w-[28rem] xl:max-h-none xl:rounded-3xl">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {drawer.mode === "task" ? "Details / modifications" : drawer.mode === "create" ? "Nouvelle tache" : "Jour selectionne"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {drawer.mode === "day" ? formatDisplayDate(drawer.day) : chantier?.nom ?? chantierName ?? "Planning"}
                  </div>
                </div>
                <button type="button" className={buttonClass()} onClick={() => setDrawer(null)}><X className="h-4 w-4" /></button>
              </div>

              {drawer.mode === "day" ? (
                <div className="space-y-3">
                  <button type="button" className={buttonClass("primary")} onClick={() => setDrawer({ mode: "create", startDate: drawer.day })}>
                    <Plus className="mr-1 inline h-4 w-4" />Ajouter une tache dans ce jour
                  </button>
                  {drawerDayTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucune tache planifiee.</div>
                  ) : (
                    drawerDayTasks.map((task) => (
                      <button key={task.id} type="button" className="w-full rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50" onClick={() => setDrawer({ mode: "task", taskId: task.id })}>
                        <div className="text-sm font-semibold text-slate-900">{task.titre}</div>
                        <div className="mt-1 text-xs text-slate-500">{task.duration_days}j - {task.temps_prevu_h ?? computePlannedHours(task.duration_days, settings)}h</div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Titre</span>
                    <input className={inputClass()} value={draft.titre} onChange={(e) => setDraft((current) => ({ ...current, titre: e.target.value }))} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Description</span>
                    <textarea className={`${inputClass()} min-h-24`} value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Date de debut</span>
                      <input type="date" className={inputClass()} value={draft.date_debut} onChange={(e) => setDraft((current) => ({ ...current, date_debut: e.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Duree (jours)</span>
                      <select className={inputClass()} value={String(draft.duration_days)} onChange={(e) => setDraft((current) => ({ ...current, duration_days: Number(e.target.value) }))}>
                        {DURATION_OPTIONS.map((value) => (
                          <option key={value} value={value}>{value}j</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Intervenant</span>
                      <select className={inputClass()} value={draft.intervenant_id} onChange={(e) => setDraft((current) => ({ ...current, intervenant_id: e.target.value }))}>
                        <option value="">Aucun</option>
                        {intervenants.map((it) => (
                          <option key={it.id} value={it.id}>{it.nom}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Statut</span>
                      <select className={inputClass()} value={draft.status} onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value }))}>
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Lot / phase</span>
                    <input className={inputClass()} value={draft.lot} onChange={(e) => setDraft((current) => ({ ...current, lot: e.target.value }))} />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Temps prevu calcule automatiquement: {computePlannedHours(draft.duration_days, settings)}h ({draft.duration_days}j x {settings.hoursPerDay}h)
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button type="button" className={buttonClass("primary")} onClick={() => void handleSaveDraft()} disabled={saving || !draft.titre.trim()}>
                      {saving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    {currentTask ? (
                      <>
                        <button type="button" className={buttonClass()} onClick={() => void handleDuplicate()}>
                          <Copy className="mr-1 inline h-4 w-4" />Dupliquer
                        </button>
                        <button type="button" className={buttonClass("danger")} onClick={() => void handleDelete(currentTask.id)}>
                          <Trash2 className="mr-1 inline h-4 w-4" />Supprimer
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </aside>
          </>
        ) : null}
      </div>
    </DndContext>
  );
}
