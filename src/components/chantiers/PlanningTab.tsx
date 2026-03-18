import { useEffect, useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, Trash2, X } from "lucide-react";
import type { IntervenantRow } from "../../services/intervenants.service";
import { useI18n } from "../../i18n";
import {
  createPlanningCalendarSegment,
  deletePlanningCalendarSegments,
  deletePlanningCalendarTasks,
  getPlanningCalendarState,
  updatePlanningCalendarSegment,
  updatePlanningCalendarSettings,
  updatePlanningCalendarTask,
  type PlanningCalendarSegment,
  type PlanningCalendarState,
  type PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  addDaysToKey,
  clampDurationDays,
  compareDateKeys,
  computePlannedHours,
  DEFAULT_PLANNING_SETTINGS,
  distributeDayLoads,
  formatDateKey,
  parseDateKey,
  startOfMonthGrid,
  startOfWeek,
  statusPriority,
  type PlanningCalendarSettings,
} from "./planningCalendar.utils";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

type PlanningView = "day" | "week" | "month";
type DrawerState = { mode: "task"; taskId: string } | { mode: "day"; day: string } | null;

type DayEntry = {
  segment: PlanningCalendarSegment;
  task: PlanningCalendarTask;
  isStart: boolean;
  dayLoad: number;
};

type TaskDraft = {
  titre: string;
  status: string;
  lot: string;
  intervenant_id: string;
  planned_duration_days: number;
};

type SegmentDraft = {
  start_date: string;
  duration_days: number;
  intervenant_id: string;
};

const DURATION_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7];
function formatDisplayDate(dateKey: string, locale: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatShortDate(dateKey: string, locale: string): string {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}

function addMonthsToKey(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey);
  return formatDateKey(new Date(date.getFullYear(), date.getMonth() + amount, 1));
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

function taskStatusClass(status: string): string {
  const key = status.toUpperCase();
  if (key === "EN_COURS") return "border-l-amber-500 bg-amber-50/60";
  if (key === "FAIT") return "border-l-emerald-500 bg-emerald-50/60";
  if (key === "BLOQUE") return "border-l-rose-500 bg-rose-50/60";
  return "border-l-blue-500 bg-white";
}

function getTaskDraft(task: PlanningCalendarTask | null): TaskDraft {
  return {
    titre: task?.titre ?? "",
    status: task?.status ?? "A_FAIRE",
    lot: task?.lot ?? task?.corps_etat ?? "",
    intervenant_id: task?.intervenant_id ?? "",
    planned_duration_days: clampDurationDays(task?.planned_duration_days ?? 1),
  };
}

function getSegmentDraft(startDate?: string | null): SegmentDraft {
  return {
    start_date: startDate ?? formatDateKey(new Date()),
    duration_days: 1,
    intervenant_id: "",
  };
}

function DayDropZone({
  day,
  title,
  onOpen,
  children,
}: {
  day: string;
  title: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  return (
    <div
      ref={setNodeRef}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-planning-card='1']")) return;
        onOpen();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={[
        "flex min-h-[14rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 lg:p-3",
        isOver ? "border-blue-400 bg-blue-50/60" : "",
      ].join(" ")}
    >
      <div className="mb-3">
        <div className="truncate text-xs font-semibold text-slate-900 lg:text-sm">{title}</div>
        <div className="text-[11px] text-slate-500">{t("planningTab.backlog.dropHint")}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function BacklogRow({ task, assigneeName, onOpen }: { task: PlanningCalendarTask; assigneeName: string; onOpen: () => void }) {
  const { t } = useI18n();
  const drag = useDraggable({ id: `task:${task.id}` });
  const style = drag.transform
    ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={drag.setNodeRef} style={style} data-planning-card="1" className="rounded-2xl border border-slate-200 p-3">
      <div className="flex items-start gap-2">
        <button type="button" className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100" {...drag.listeners} {...drag.attributes}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="truncate text-sm font-semibold text-slate-900">{task.titre}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span>{t("planningTab.backlog.plannedDays", { days: task.planned_duration_days })}</span>
            {assigneeName ? <span>{assigneeName}</span> : null}
            {(task.lot || task.corps_etat) ? <span>{task.lot ?? task.corps_etat}</span> : null}
          </div>
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-blue-700" onClick={onOpen}>
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />{t("planningTab.backlog.schedule")}
        </button>
      </div>
    </div>
  );
}

function SegmentCard({
  entry,
  assigneeName,
  onOpenTask,
  onResize,
  onMoveOrder,
  onDelete,
}: {
  entry: DayEntry;
  assigneeName: string;
  onOpenTask: () => void;
  onResize: (delta: number) => void;
  onMoveOrder: (delta: number) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const drag = useDraggable({ id: entry.isStart ? `segment:${entry.segment.id}` : `segment-copy:${entry.segment.id}` });
  const style = entry.isStart && drag.transform
    ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={entry.isStart ? drag.setNodeRef : undefined} style={style} data-planning-card="1" className={[
      "rounded-2xl border border-slate-200 border-l-4 p-2 shadow-sm",
      taskStatusClass(entry.task.status),
    ].join(" ")}>
      <div className="flex items-start gap-2">
        {entry.isStart ? (
          <button type="button" className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100" {...drag.listeners} {...drag.attributes}>
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <div className="mt-2 h-2 w-2 rounded-full bg-slate-300" />
        )}

        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpenTask}>
          <div className="truncate text-sm font-semibold text-slate-900">{entry.isStart ? entry.task.titre : t("planningTab.backlog.continued", { title: entry.task.titre })}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{entry.isStart ? entry.segment.duration_days : entry.dayLoad}j</span>
            {assigneeName ? <span>{assigneeName}</span> : null}
          </div>
        </button>

        {entry.isStart ? (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onMoveOrder(-1)}><ChevronUp className="h-3.5 w-3.5" /></button>
            <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onMoveOrder(1)}><ChevronDown className="h-3.5 w-3.5" /></button>
            <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onResize(-0.25)}>-</button>
            <button type="button" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs" onClick={() => onResize(0.25)}>+</button>
            <button type="button" className="rounded-lg border border-rose-200 px-1.5 py-1 text-xs text-rose-700" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PlanningTab({ chantierId, chantierName, intervenants }: Props) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<PlanningCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<PlanningView>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "month" : "week"));
  const [anchorDate, setAnchorDate] = useState(() => formatDateKey(new Date()));
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => getTaskDraft(null));
  const [newSegmentDraft, setNewSegmentDraft] = useState<SegmentDraft>(() => getSegmentDraft(null));
  const [dayTaskId, setDayTaskId] = useState("");
  const [dayDuration, setDayDuration] = useState(1);
  const [dayAssigneeId, setDayAssigneeId] = useState("");
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [lotFilter, setLotFilter] = useState("__all__");
  const [taskTab, setTaskTab] = useState<"backlog" | "planned">("backlog");
  const [showSettings, setShowSettings] = useState(false);

  const settings = state?.settings ?? DEFAULT_PLANNING_SETTINGS;
  const tasks = state?.tasks ?? [];
  const segments = state?.segments ?? [];
  const chantier = state?.chantier ?? null;
  const viewOptions: Array<{ value: PlanningView; label: string }> = [
    { value: "day", label: t("planningTab.view.day") },
    { value: "week", label: t("planningTab.view.week") },
    { value: "month", label: t("planningTab.view.month") },
  ];
  const statusOptions = [
    { value: "A_FAIRE", label: t("planningTab.status.todo") },
    { value: "EN_COURS", label: t("planningTab.status.inProgress") },
    { value: "FAIT", label: t("planningTab.status.done") },
    { value: "BLOQUE", label: t("planningTab.status.blocked") },
  ];

  const backlogDrop = useDroppable({ id: "backlog" });

  async function loadAll(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      setState(await getPlanningCalendarState(chantierId));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.load"));
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(false);
  }, [chantierId]);

  const intervenantsById = useMemo(() => {
    const map = new Map<string, IntervenantRow>();
    for (const it of intervenants) map.set(it.id, it);
    return map;
  }, [intervenants]);

  const taskById = useMemo(() => {
    const map = new Map<string, PlanningCalendarTask>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((task) => (assigneeFilter === "__all__" ? true : task.intervenant_id === assigneeFilter))
      .filter((task) => (statusFilter === "__all__" ? true : task.status === statusFilter))
      .filter((task) => (lotFilter === "__all__" ? true : (task.lot ?? task.corps_etat ?? "") === lotFilter))
      .filter((task) => {
        if (!q) return true;
        return [task.titre, task.lot ?? "", task.corps_etat ?? ""].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const statusDiff = statusPriority(a.status) - statusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;
        return a.titre.localeCompare(b.titre, "fr");
      });
  }, [assigneeFilter, lotFilter, query, statusFilter, tasks]);

  const filteredTaskIds = useMemo(() => new Set(filteredTasks.map((task) => task.id)), [filteredTasks]);

  const filteredSegments = useMemo(() => segments.filter((segment) => filteredTaskIds.has(segment.task_id)), [filteredTaskIds, segments]);

  const segmentsByTask = useMemo(() => {
    const map = new Map<string, PlanningCalendarSegment[]>();
    for (const segment of segments) {
      const list = map.get(segment.task_id) ?? [];
      list.push(segment);
      map.set(segment.task_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const dateDiff = compareDateKeys(a.start_date, b.start_date);
        if (dateDiff !== 0) return dateDiff;
        const orderDiff = a.order_in_day - b.order_in_day;
        if (orderDiff !== 0) return orderDiff;
        return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
      });
    }
    return map;
  }, [segments]);

  const backlogTasks = useMemo(() => filteredTasks.filter((task) => (segmentsByTask.get(task.id)?.length ?? 0) === 0), [filteredTasks, segmentsByTask]);
  const plannedTasks = useMemo(() => filteredTasks.filter((task) => (segmentsByTask.get(task.id)?.length ?? 0) > 0), [filteredTasks, segmentsByTask]);

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

  const dayEntries = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    for (const day of visibleDays) map.set(day, []);

    for (const segment of filteredSegments) {
      const task = taskById.get(segment.task_id);
      if (!task) continue;
      const loads = distributeDayLoads(segment.duration_days, segment.start_date, settings);
      for (let index = 0; index < loads.length; index += 1) {
        const load = loads[index];
        if (!visibleDaySet.has(load.date)) continue;
        const list = map.get(load.date) ?? [];
        list.push({ segment, task, isStart: index === 0, dayLoad: load.load });
        map.set(load.date, list);
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const orderDiff = a.segment.order_in_day - b.segment.order_in_day;
        if (orderDiff !== 0) return orderDiff;
        return a.task.titre.localeCompare(b.task.titre, "fr");
      });
    }

    return map;
  }, [filteredSegments, settings, taskById, visibleDaySet, visibleDays]);

  const currentTask = useMemo(() => (drawer?.mode === "task" ? taskById.get(drawer.taskId) ?? null : null), [drawer, taskById]);

  const currentTaskSegments = useMemo(() => {
    if (!currentTask) return [];
    return segmentsByTask.get(currentTask.id) ?? [];
  }, [currentTask, segmentsByTask]);

  const dayDrawerSegments = useMemo(() => {
    if (drawer?.mode !== "day") return [];
    const entries = dayEntries.get(drawer.day) ?? [];
    const map = new Map<string, DayEntry>();
    for (const entry of entries) if (!map.has(entry.segment.id)) map.set(entry.segment.id, entry);
    return [...map.values()];
  }, [dayEntries, drawer]);

  const rangeSummary = useMemo(() => {
    const warnings: string[] = [];
    let totalHours = 0;
    const byDay = new Map<string, number>();
    const byAssigneeDay = new Map<string, number>();

    for (const segment of filteredSegments) {
      const loads = distributeDayLoads(segment.duration_days, segment.start_date, settings).filter((load) => visibleDaySet.has(load.date));
      for (const load of loads) {
        totalHours += load.load * settings.hoursPerDay;
        byDay.set(load.date, (byDay.get(load.date) ?? 0) + load.load);
        if (segment.intervenant_id) {
          const key = `${segment.intervenant_id}:${load.date}`;
          byAssigneeDay.set(key, (byAssigneeDay.get(key) ?? 0) + load.load);
        }
      }
    }

    for (const [key, value] of byAssigneeDay.entries()) {
      if (value <= 1) continue;
      const [intervenantId, day] = key.split(":");
      warnings.push(t("planningTab.warnings.assigneeOverload", { name: intervenantsById.get(intervenantId)?.nom ?? t("planningTab.headers.intervenant").toLowerCase(), date: formatShortDate(day, locale), value: value.toFixed(2) }));
    }
    for (const [day, value] of byDay.entries()) {
      if (value <= settings.dayCapacity) continue;
      warnings.push(t("planningTab.warnings.globalLoad", { date: formatShortDate(day, locale), value: value.toFixed(2), capacity: settings.dayCapacity }));
    }

    return { totalHours: Math.round(totalHours * 100) / 100, warnings };
  }, [filteredSegments, intervenantsById, settings, visibleDaySet]);

  useEffect(() => {
    if (currentTask) {
      setTaskDraft(getTaskDraft(currentTask));
      setNewSegmentDraft(getSegmentDraft(anchorDate));
    }
  }, [anchorDate, currentTask]);

  useEffect(() => {
    if (drawer?.mode === "day") {
      setDayTaskId("");
      setDayDuration(1);
      setDayAssigneeId("");
    }
  }, [drawer]);

  async function saveTaskMeta(taskId: string, patch: Parameters<typeof updatePlanningCalendarTask>[1]) {
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarTask(taskId, patch, settings, false);
      await loadAll(true);
      setNotice(t("planningTab.notices.taskUpdated"));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.taskUpdate"));
    } finally {
      setSaving(false);
    }
  }

  async function saveSegment(segmentId: string, patch: Parameters<typeof updatePlanningCalendarSegment>[1]) {
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarSegment(segmentId, patch, settings, { start_date: segment.start_date, duration_days: segment.duration_days });
      await loadAll(true);
      setNotice(t("planningTab.notices.segmentUpdated"));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.segmentUpdate"));
    } finally {
      setSaving(false);
    }
  }

  function dayStartEntries(day: string): DayEntry[] {
    return (dayEntries.get(day) ?? []).filter((entry) => entry.isStart);
  }

  async function addSegment(taskId: string, day: string, duration: number, assigneeId: string | null, orderInDay?: number) {
    setSaving(true);
    setError(null);
    try {
      await createPlanningCalendarSegment(chantierId, taskId, {
        start_date: day,
        duration_days: duration,
        intervenant_id: assigneeId,
        order_in_day: orderInDay ?? dayStartEntries(day).length,
      }, settings);
      await loadAll(true);
      setNotice(t("planningTab.notices.segmentPlanned"));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.segmentPlan"));
    } finally {
      setSaving(false);
    }
  }

  async function removeSegments(segmentIds: string[]) {
    if (!segmentIds.length) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlanningCalendarSegments(segmentIds);
      await loadAll(true);
      setNotice(t("planningTab.notices.segmentDeleted"));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.segmentDelete"));
    } finally {
      setSaving(false);
    }
  }

  async function deplanifyTask(taskId: string) {
    await removeSegments((segmentsByTask.get(taskId) ?? []).map((segment) => segment.id));
  }

  async function deleteTask(taskId: string) {
    const confirmed = typeof window === "undefined" ? true : window.confirm(t("planningTab.confirms.deleteTask"));
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlanningCalendarTasks([taskId]);
      setDrawer((current) => (current && current.mode === "task" && current.taskId === taskId ? null : current));
      await loadAll(true);
      setNotice(t("common.actions.delete"));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.taskDelete"));
    } finally {
      setSaving(false);
    }
  }

  async function reorderInDay(day: string, segmentId: string, delta: number) {
    const entries = dayStartEntries(day);
    const from = entries.findIndex((entry) => entry.segment.id === segmentId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= entries.length) return;

    const a = entries[from].segment;
    const b = entries[to].segment;

    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarSegment(a.id, { order_in_day: b.order_in_day }, settings, { start_date: a.start_date, duration_days: a.duration_days });
      await updatePlanningCalendarSegment(b.id, { order_in_day: a.order_in_day }, settings, { start_date: b.start_date, duration_days: b.duration_days });
      await loadAll(true);
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.reorder"));
    } finally {
      setSaving(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const active = String(event.active.id ?? "");
    const over = String(event.over?.id ?? "");
    if (!active || !over) return;

    if (active.startsWith("task:")) {
      if (!over.startsWith("day:")) return;
      const taskId = active.replace(/^task:/, "");
      const day = over.replace(/^day:/, "");
      const task = taskById.get(taskId);
      await addSegment(taskId, day, 1, task?.intervenant_id ?? null, dayStartEntries(day).length);
      return;
    }

    if (active.startsWith("segment:")) {
      const segmentId = active.replace(/^segment:/, "");
      const segment = segments.find((item) => item.id === segmentId);
      if (!segment) return;
      if (over === "backlog") {
        await removeSegments([segmentId]);
        return;
      }
      if (over.startsWith("day:")) {
        const day = over.replace(/^day:/, "");
        await saveSegment(segmentId, { start_date: day, order_in_day: dayStartEntries(day).length });
      }
    }
  }

  async function saveSettings(patch: Partial<PlanningCalendarSettings>) {
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarSettings(chantierId, patch);
      await loadAll(true);
      setNotice(t("planningTab.notices.settingsUpdated"));
    } catch (err: any) {
      setError(err?.message ?? t("planningTab.errors.settings"));
    } finally {
      setSaving(false);
    }
  }

  function navigate(offset: number) {
    if (view === "month") setAnchorDate((current) => addMonthsToKey(current, offset));
    else if (view === "week") setAnchorDate((current) => addDaysToKey(current, offset * 7));
    else setAnchorDate((current) => addDaysToKey(current, offset));
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{t("planningTab.loading")}</div>;

  const lotOptions = [...new Set(tasks.map((task) => task.lot ?? task.corps_etat ?? "").filter((value) => String(value).trim()))].sort((a, b) => String(a).localeCompare(String(b), "fr"));

  return (
    <DndContext onDragEnd={(event) => void onDragEnd(event)}>
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">{t("planningTab.title")}</h2>
                {chantierName ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{chantierName}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                  {viewOptions.map((option) => (
                    <button key={option.value} type="button" className={segmentedButton(view === option.value)} onClick={() => setView(option.value)}>{option.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-full border border-slate-200 p-1">
                  <button type="button" className={buttonClass()} onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" className={buttonClass()} onClick={() => setAnchorDate(formatDateKey(new Date()))}>{t("planningTab.today")}</button>
                  <button type="button" className={buttonClass()} onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[48rem]">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_12rem_12rem_10rem_auto] xl:items-center">
                <input className={inputClass()} placeholder={t("planningTab.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className={inputClass()} value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                  <option value="__all__">{t("planningTab.allIntervenants")}</option>
                  {intervenants.map((it) => <option key={it.id} value={it.id}>{it.nom}</option>)}
                </select>
                <select className={inputClass()} value={lotFilter} onChange={(e) => setLotFilter(e.target.value)}>
                  <option value="__all__">{t("planningTab.allLots")}</option>
                  {lotOptions.map((lot) => <option key={lot} value={lot}>{lot}</option>)}
                </select>
                <select className={inputClass()} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="__all__">{t("planningTab.allStatuses")}</option>
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" className={buttonClass()} onClick={() => setShowSettings((current) => !current)}>{showSettings ? t("planningTab.hideSettings") : t("planningTab.settings")}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{`${visibleDays[0]} -> ${visibleDays[visibleDays.length - 1]}`}</span>
                <span>{t("planningTab.totalHours", { value: rangeSummary.totalHours })}</span>
                <span>{t("planningTab.alerts", { count: rangeSummary.warnings.length })}</span>
                {state?.segmentColumnsMissing ? <span className="text-amber-700">{t("planningTab.segmentMigration")}</span> : null}
              </div>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

          {showSettings ? (
            <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">{t("planningTab.hoursPerDay")}</span>
                <input type="number" min="1" step="0.5" className={inputClass()} defaultValue={settings.hoursPerDay} onBlur={(e) => void saveSettings({ hoursPerDay: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">{t("planningTab.dayCapacity")}</span>
                <input type="number" min="1" step="0.25" className={inputClass()} defaultValue={settings.dayCapacity} onBlur={(e) => void saveSettings({ dayCapacity: Number(e.target.value) })} />
              </label>
              <label className="flex items-center gap-2 pt-6 text-xs text-slate-600">
                <input type="checkbox" defaultChecked={settings.skipWeekends} onChange={(e) => void saveSettings({ skipWeekends: e.target.checked })} />
                {t("planningTab.skipWeekends")}
              </label>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">{t("planningTab.calendar")}</div>
            <div className="text-xs text-slate-500">{t("planningTab.calendarSubtitle")}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
            {view === "month" ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
                {visibleDays.map((day) => {
                  const entries = dayEntries.get(day) ?? [];
                  const visible = entries.slice(0, 3);
                  return (
                    <button key={day} type="button" className="min-h-[10rem] rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200" onClick={() => setDrawer({ mode: "day", day })}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-500">{formatDisplayDate(day, locale)}</div>
                          <div className="text-sm font-semibold text-slate-900">{day.slice(8, 10)}</div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{entries.length}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {visible.map((entry) => (
                          <div key={`${day}:${entry.segment.id}`} className={["truncate rounded-xl border border-l-4 px-2 py-1 text-xs", taskStatusClass(entry.task.status)].join(" ")}>
                            {entry.task.titre}
                          </div>
                        ))}
                        {entries.length > visible.length ? <div className="text-xs font-medium text-blue-700">+{entries.length - visible.length}</div> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={view === "day" ? "grid gap-3" : "grid grid-cols-7 gap-2 lg:gap-3"}>
                {visibleDays.map((day) => (
                  <DayDropZone key={day} day={day} title={formatDisplayDate(day, locale)} onOpen={() => setDrawer({ mode: "day", day })}>
                    {(dayEntries.get(day) ?? []).map((entry) => (
                      <SegmentCard
                        key={`${day}:${entry.segment.id}:${entry.isStart ? "s" : "c"}`}
                        entry={entry}
                        assigneeName={entry.segment.intervenant_id ? intervenantsById.get(entry.segment.intervenant_id)?.nom ?? "" : ""}
                        onOpenTask={() => setDrawer({ mode: "task", taskId: entry.task.id })}
                        onMoveOrder={(delta) => void reorderInDay(day, entry.segment.id, delta)}
                        onResize={(delta) => void saveSegment(entry.segment.id, { duration_days: clampDurationDays(entry.segment.duration_days + delta) })}
                        onDelete={() => void removeSegments([entry.segment.id])}
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
                <div className="text-sm font-semibold text-slate-900">{t("planningTab.tasksTitle")}</div>
                <div className="text-xs text-slate-500">{t("planningTab.tasksSubtitle")}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button type="button" className={segmentedButton(taskTab === "backlog")} onClick={() => setTaskTab("backlog")}>{t("planningTab.unscheduled")}</button>
                  <button type="button" className={segmentedButton(taskTab === "planned")} onClick={() => setTaskTab("planned")}>{t("planningTab.scheduled")}</button>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{t("planningTab.elements", { count: taskTab === "backlog" ? backlogTasks.length : plannedTasks.length })}</span>
              </div>
            </div>
          </div>

          <div className="max-h-[24rem] overflow-auto pr-1">
            {taskTab === "backlog" ? (
              <div ref={backlogDrop.setNodeRef} className={["space-y-2 rounded-2xl border border-dashed border-slate-200 p-2", backlogDrop.isOver ? "border-blue-400 bg-blue-50/60" : ""].join(" ")}>
                {backlogTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("planningTab.noUnscheduled")}</div>
                ) : (
                  backlogTasks.map((task) => (
                    <BacklogRow
                      key={task.id}
                      task={task}
                      assigneeName={task.intervenant_id ? intervenantsById.get(task.intervenant_id)?.nom ?? "" : ""}
                      onOpen={() => setDrawer({ mode: "task", taskId: task.id })}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[minmax(14rem,2fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_6rem_6rem_6rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <span>{t("planningTab.headers.task")}</span><span>{t("planningTab.headers.lot")}</span><span>{t("planningTab.headers.intervenant")}</span><span>{t("planningTab.headers.planned")}</span><span>{t("planningTab.headers.scheduled")}</span><span></span>
                </div>
                <div className="divide-y divide-slate-100">
                  {plannedTasks.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-slate-500">{t("planningTab.noScheduledWithFilters")}</div>
                  ) : (
                    plannedTasks.map((task) => {
                      const plannedDays = Math.round(((segmentsByTask.get(task.id) ?? []).reduce((sum, segment) => sum + segment.duration_days, 0)) * 100) / 100;
                      return (
                        <button key={task.id} type="button" className="grid w-full grid-cols-[minmax(14rem,2fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_6rem_6rem_6rem] gap-3 px-3 py-3 text-left hover:bg-slate-50" onClick={() => setDrawer({ mode: "task", taskId: task.id })}>
                          <span className="min-w-0 truncate text-sm font-medium text-slate-900">{task.titre}</span>
                          <span className="truncate text-sm text-slate-600">{task.lot ?? task.corps_etat ?? "-"}</span>
                          <span className="truncate text-sm text-slate-600">{task.intervenant_id ? intervenantsById.get(task.intervenant_id)?.nom ?? "-" : "-"}</span>
                          <span className="text-sm text-slate-600">{task.planned_duration_days}j</span>
                          <span className="text-sm text-slate-600">{plannedDays}j</span>
                          <span className="text-right text-slate-400">...</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {drawer ? (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setDrawer(null)} aria-label="Fermer" />
            <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl xl:inset-y-4 xl:right-4 xl:left-auto xl:w-[30rem] xl:max-h-none xl:rounded-3xl">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{drawer.mode === "task" ? t("planningTab.drawer.taskDetails") : t("planningTab.drawer.selectedDay")}</div>
                  <div className="text-xs text-slate-500">{drawer.mode === "day" ? formatDisplayDate(drawer.day, locale) : chantier?.nom ?? chantierName ?? t("planningTab.title")}</div>
                </div>
                <button type="button" className={buttonClass()} onClick={() => setDrawer(null)}><X className="h-4 w-4" /></button>
              </div>

              {drawer.mode === "day" ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-medium text-slate-500">{t("planningTab.drawer.assignExistingTask")}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select className={inputClass()} value={dayTaskId} onChange={(e) => setDayTaskId(e.target.value)}>
                        <option value="">{t("planningTab.drawer.chooseUnscheduledTask")}</option>
                        {backlogTasks.map((task) => <option key={task.id} value={task.id}>{task.titre}</option>)}
                      </select>
                      <select className={inputClass()} value={String(dayDuration)} onChange={(e) => setDayDuration(Number(e.target.value))}>
                        {DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value}j</option>)}
                      </select>
                      <select className={inputClass()} value={dayAssigneeId} onChange={(e) => setDayAssigneeId(e.target.value)}>
                        <option value="">{t("planningTab.drawer.defaultIntervenant")}</option>
                        {intervenants.map((it) => <option key={it.id} value={it.id}>{it.nom}</option>)}
                      </select>
                      <button type="button" className={buttonClass("primary")} disabled={!dayTaskId || saving} onClick={() => void addSegment(dayTaskId, drawer.day, dayDuration, dayAssigneeId || null, dayStartEntries(drawer.day).length)}>{t("planningTab.drawer.assign")}</button>
                    </div>
                  </div>

                  {dayDrawerSegments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("planningTab.drawer.emptyDay")}</div>
                  ) : (
                    dayDrawerSegments.map((entry) => (
                      <div key={entry.segment.id} className="rounded-2xl border border-slate-200 p-3">
                        <button type="button" className="text-left" onClick={() => setDrawer({ mode: "task", taskId: entry.task.id })}>
                          <div className="text-sm font-semibold text-slate-900">{entry.task.titre}</div>
                          <div className="mt-1 text-xs text-slate-500">{entry.segment.duration_days}j - {computePlannedHours(entry.segment.duration_days, settings)}h</div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : currentTask ? (
                <div className="space-y-4">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">{t("planningTab.drawer.title")}</span><input className={inputClass()} value={taskDraft.titre} onChange={(e) => setTaskDraft((current) => ({ ...current, titre: e.target.value }))} /></label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">{t("planningTab.drawer.intervenant")}</span><select className={inputClass()} value={taskDraft.intervenant_id} onChange={(e) => setTaskDraft((current) => ({ ...current, intervenant_id: e.target.value }))}><option value="">{t("planningTab.drawer.none")}</option>{intervenants.map((it) => <option key={it.id} value={it.id}>{it.nom}</option>)}</select></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">{t("planningTab.drawer.status")}</span><select className={inputClass()} value={taskDraft.status} onChange={(e) => setTaskDraft((current) => ({ ...current, status: e.target.value }))}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  </div>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">{t("planningTab.drawer.lotPhase")}</span><input className={inputClass()} value={taskDraft.lot} onChange={(e) => setTaskDraft((current) => ({ ...current, lot: e.target.value }))} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">{t("planningTab.drawer.plannedDuration")}</span><select className={inputClass()} value={String(taskDraft.planned_duration_days)} onChange={(e) => setTaskDraft((current) => ({ ...current, planned_duration_days: Number(e.target.value) }))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value}j</option>)}</select></label>

                  <button type="button" className={buttonClass("primary")} disabled={saving || !taskDraft.titre.trim()} onClick={() => void saveTaskMeta(currentTask.id, { titre: taskDraft.titre, status: taskDraft.status, lot: taskDraft.lot || null, corps_etat: taskDraft.lot || null, intervenant_id: taskDraft.intervenant_id || null, planned_duration_days: taskDraft.planned_duration_days })}>{t("planningTab.drawer.saveTask")}</button>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("planningTab.drawer.planning")}</div>
                    {(() => {
                      const planned = Math.round(currentTaskSegments.reduce((sum, segment) => sum + segment.duration_days, 0) * 100) / 100;
                      const remaining = Math.round((taskDraft.planned_duration_days - planned) * 100) / 100;
                      return <div className="mt-2 text-xs text-slate-700">{t("planningTab.drawer.planningSummary", { planned: taskDraft.planned_duration_days, scheduled: planned, remaining })}{planned > taskDraft.planned_duration_days ? t("planningTab.drawer.planningSummaryOver") : ""}</div>;
                    })()}

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <input type="date" className={inputClass()} value={newSegmentDraft.start_date} onChange={(e) => setNewSegmentDraft((current) => ({ ...current, start_date: e.target.value }))} />
                      <select className={inputClass()} value={String(newSegmentDraft.duration_days)} onChange={(e) => setNewSegmentDraft((current) => ({ ...current, duration_days: Number(e.target.value) }))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value}j</option>)}</select>
                      <select className={inputClass()} value={newSegmentDraft.intervenant_id} onChange={(e) => setNewSegmentDraft((current) => ({ ...current, intervenant_id: e.target.value }))}><option value="">{t("planningTab.drawer.defaultIntervenant")}</option>{intervenants.map((it) => <option key={it.id} value={it.id}>{it.nom}</option>)}</select>
                      <button type="button" className={buttonClass("primary")} disabled={!newSegmentDraft.start_date || saving} onClick={() => void addSegment(currentTask.id, newSegmentDraft.start_date, newSegmentDraft.duration_days, newSegmentDraft.intervenant_id || null, currentTaskSegments.length)}>{t("planningTab.drawer.addSegment")}</button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {currentTaskSegments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">{t("planningTab.drawer.noSegmentForTask")}</div>
                      ) : (
                        currentTaskSegments.map((segment) => (
                          <div key={segment.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-[1fr_7rem_7rem_auto] md:items-center">
                            <input type="date" className={inputClass()} value={segment.start_date} onChange={(e) => void saveSegment(segment.id, { start_date: e.target.value })} />
                            <select className={inputClass()} value={String(segment.duration_days)} onChange={(e) => void saveSegment(segment.id, { duration_days: Number(e.target.value) })}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value}j</option>)}</select>
                            <select className={inputClass()} value={segment.intervenant_id ?? ""} onChange={(e) => void saveSegment(segment.id, { intervenant_id: e.target.value || null })}><option value="">{t("planningTab.drawer.default")}</option>{intervenants.map((it) => <option key={it.id} value={it.id}>{it.nom}</option>)}</select>
                            <button type="button" className={buttonClass("danger")} onClick={() => void removeSegments([segment.id])}><Trash2 className="mr-1 inline h-4 w-4" />{t("planningTab.drawer.delete")}</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentTaskSegments.length > 0 ? <button type="button" className={buttonClass()} onClick={() => void deplanifyTask(currentTask.id)}>{t("planningTab.drawer.unscheduleTask")}</button> : null}
                    <button type="button" className={buttonClass("danger")} onClick={() => void deleteTask(currentTask.id)}><Trash2 className="mr-1 inline h-4 w-4" />{t("planningTab.drawer.deleteTask")}</button>
                  </div>
                </div>
              ) : null}
            </aside>
          </>
        ) : null}
      </div>
    </DndContext>
  );
}
