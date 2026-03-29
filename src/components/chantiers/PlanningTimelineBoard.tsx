import { useEffect, useMemo, useState } from "react";
import Timeline, { DateHeader, SidebarHeader, TimelineHeaders, TodayMarker } from "react-calendar-timeline";
import "react-calendar-timeline/style.css";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Search,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { useI18n } from "../../i18n";
import type { IntervenantRow } from "../../services/intervenants.service";
import {
  createPlanningCalendarSegment,
  deletePlanningCalendarSegments,
  getPlanningCalendarState,
  updatePlanningCalendarSegment,
  updatePlanningCalendarTask,
  updatePlanningCalendarSettings,
  type PlanningCalendarSegment,
  type PlanningCalendarState,
  type PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  addDaysToKey,
  clampDurationDays,
  computeEndDate,
  computePlannedHours,
  formatDateKey,
  isWorkingDay,
  nextPlannableDate,
  parseDateKey,
  startOfWeek,
  type PlanningCalendarSettings,
} from "./planningCalendar.utils";
import {
  buildSuggestedBlocks,
  computeDayLoadHours,
  computePlanningProgress,
  getIntervenantColor,
  getLotColor,
  getSegmentPlanningTitle,
  getTaskPlanningState,
  getTaskPlanningTitle,
  normalizeBlockStatus,
  type PlanningBlockStatus,
  type PlanningColor,
  type PlanningTaskSummary,
  type TaskPlanningState,
} from "./planningBoard.utils";
import "./planningTimeline.css";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

type CalendarView = "day" | "week";
type TaskFilter = "all" | "a_planifier" | "partielle" | "planifiee" | "en_cours" | "terminee" | "bloquee";
type Draft = {
  start_date: string;
  duration_days: number;
  intervenant_id: string;
  title_override: string;
  progress_percent: string;
  status: PlanningBlockStatus;
  comment: string;
};
type BacklogTask = {
  task: PlanningCalendarTask;
  summary: PlanningTaskSummary;
  planningState: TaskPlanningState;
};
type AlertItem = {
  id: string;
  tone: "danger" | "warning";
  label: string;
};
type Row = {
  id: string;
  label: string;
  intervenantId: string | null;
  color: PlanningColor;
};
type TimelineGroup = {
  id: string;
  title: string;
  intervenantId: string | null;
  color: PlanningColor;
  weekHours: number;
  isUnassigned: boolean;
};
type TimelineItem = {
  id: string;
  group: string;
  title: string;
  start_time: number;
  end_time: number;
  canMove: boolean;
  canResize: "right";
  canChangeGroup: boolean;
  taskId: string;
  taskTitle: string;
  lot: string;
  color: PlanningColor;
  progressPercent: number;
  status: PlanningBlockStatus;
  plannedHours: number;
};

const DURATION_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7];
const BLOCK_STATUS_OPTIONS: Array<{ value: PlanningBlockStatus; label: string }> = [
  { value: "brouillon", label: "Brouillon" },
  { value: "planifie", label: "Planifie" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Termine" },
  { value: "annule", label: "Annule" },
];
const DAY_MS = 86400000;

function buttonClass(kind: "primary" | "secondary" | "danger" | "ghost" = "secondary") {
  if (kind === "primary") return "rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300";
  if (kind === "danger") return "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";
  if (kind === "ghost") return "rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";
  return "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
}

function inputClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100";
}

function compactBadgeClass(active: boolean) {
  return active
    ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
    : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200";
}

function formatHours(value: number | null | undefined) {
  const safe = Math.round((Number(value ?? 0) || 0) * 10) / 10;
  return `${safe}h`;
}

function formatDayLabel(day: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(parseDateKey(day));
}

function formatRangeLabel(days: string[], locale: string) {
  if (!days.length) return "";
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return `${formatter.format(parseDateKey(days[0]))} - ${formatter.format(parseDateKey(days[days.length - 1]))}`;
}

function taskStateLabel(state: TaskPlanningState) {
  if (state === "a_planifier") return "A planifier";
  if (state === "partielle") return "Partiellement planifiee";
  if (state === "planifiee") return "Planifiee";
  if (state === "en_cours") return "En cours";
  if (state === "terminee") return "Terminee";
  return "Bloquee";
}

function taskStateTone(state: TaskPlanningState) {
  if (state === "terminee") return "bg-emerald-100 text-emerald-700";
  if (state === "en_cours") return "bg-amber-100 text-amber-700";
  if (state === "bloquee") return "bg-rose-100 text-rose-700";
  if (state === "planifiee") return "bg-blue-100 text-blue-700";
  if (state === "partielle") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-600";
}

function blockStatusLabel(status: PlanningBlockStatus) {
  if (status === "brouillon") return "Brouillon";
  if (status === "annule") return "Annule";
  if (status === "termine") return "Termine";
  if (status === "en_cours") return "En cours";
  return "Planifie";
}

function blockStatusTone(status: PlanningBlockStatus) {
  if (status === "termine") return "bg-emerald-100 text-emerald-700";
  if (status === "en_cours") return "bg-amber-100 text-amber-700";
  if (status === "annule") return "bg-rose-100 text-rose-700";
  if (status === "brouillon") return "bg-slate-100 text-slate-600";
  return "bg-blue-100 text-blue-700";
}

function defaultDraft(task: PlanningCalendarTask, startDate: string): Draft {
  return {
    start_date: startDate,
    duration_days: 1,
    intervenant_id: task.intervenant_id ?? "",
    title_override: getTaskPlanningTitle(task),
    progress_percent: "0",
    status: "planifie",
    comment: "",
  };
}

function mapSegmentToDraft(task: PlanningCalendarTask, segment: PlanningCalendarSegment): Draft {
  return {
    start_date: segment.start_date,
    duration_days: clampDurationDays(segment.duration_days),
    intervenant_id: segment.intervenant_id ?? "",
    title_override: segment.title_override ?? getTaskPlanningTitle(task),
    progress_percent: String(Math.max(0, Math.min(100, Math.round(segment.progress_percent ?? 0)))),
    status: normalizeBlockStatus(segment.status, segment.progress_percent),
    comment: segment.comment ?? "",
  };
}

function parseProgress(value: string) {
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function validateDraft(draft: Draft) {
  if (!draft.title_override.trim()) return "L'intitule du bloc est obligatoire.";
  if (!draft.start_date) return "La date du bloc est obligatoire.";
  if (!Number.isFinite(draft.duration_days) || draft.duration_days <= 0) return "Le temps estime doit etre superieur a 0.";
  const progress = Number(String(draft.progress_percent).replace(",", "."));
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) return "L'avancement doit etre compris entre 0 et 100.";
  return null;
}

function sortSegmentsByPlanning(a: PlanningCalendarSegment, b: PlanningCalendarSegment) {
  if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
  if ((a.intervenant_id ?? "") !== (b.intervenant_id ?? "")) return String(a.intervenant_id ?? "").localeCompare(String(b.intervenant_id ?? ""), "fr");
  return a.order_in_day - b.order_in_day;
}

function toTimelineItemSpan(segment: PlanningCalendarSegment, settings: PlanningCalendarSettings) {
  const endDate = computeEndDate(segment.start_date, segment.duration_days, settings);
  const start = parseDateKey(segment.start_date);
  const endExclusive = parseDateKey(addDaysToKey(endDate, 1));
  return {
    start_time: start.getTime(),
    end_time: endExclusive.getTime(),
  };
}

function countWorkingDaysInclusive(startDate: string, endInclusiveDate: string, settings: PlanningCalendarSettings) {
  let count = 0;
  let cursor = startDate;
  while (cursor <= endInclusiveDate) {
    if (isWorkingDay(cursor, settings)) count += 1;
    cursor = addDaysToKey(cursor, 1);
  }
  return Math.max(0.25, count || 0.25);
}

function BacklogCard({
  item,
  settings,
  selected,
  onPlan,
}: {
  item: BacklogTask;
  settings: PlanningCalendarSettings;
  selected: boolean;
  onPlan: () => void;
}) {
  const { task, summary, planningState } = item;

  return (
    <button
      type="button"
      onClick={onPlan}
      className={[
        "w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition",
        selected ? "border-slate-900 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {task.lot ?? task.corps_etat ?? "Sans lot"}
        </span>
        <span className={["rounded-full px-2 py-1 text-[11px] font-semibold", taskStateTone(planningState)].join(" ")}>{taskStateLabel(planningState)}</span>
      </div>
      <div className="mt-3 text-sm font-semibold leading-5 text-slate-900">{getTaskPlanningTitle(task)}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <div>Prevu : <span className="font-semibold text-slate-700">{formatHours(summary.plannedTaskHours || computePlannedHours(task.planned_duration_days, settings))}</span></div>
        <div>Planifie : <span className="font-semibold text-slate-700">{formatHours(summary.scheduledBlockHours)}</span></div>
        <div>Restant : <span className="font-semibold text-slate-700">{formatHours(summary.remainingHours)}</span></div>
        <div>Avancement : <span className="font-semibold text-slate-700">{summary.progressPercent}%</span></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${summary.progressPercent}%` }} />
      </div>
      <div className="mt-4 flex gap-2">
        <span className={buttonClass("primary")}>Planifier</span>
        <span className={buttonClass()}>Ouvrir</span>
      </div>
    </button>
  );
}

export default function PlanningTimelineBoard({ chantierId, chantierName, intervenants }: Props) {
  const { locale } = useI18n();
  const [state, setState] = useState<PlanningCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(() => formatDateKey(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [search, setSearch] = useState("");
  const [lotFilter, setLotFilter] = useState("__all__");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [intervenantFilter, setIntervenantFilter] = useState("__all__");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newBlockDraft, setNewBlockDraft] = useState<Draft>({
    start_date: formatDateKey(new Date()),
    duration_days: 1,
    intervenant_id: "",
    title_override: "",
    progress_percent: "0",
    status: "planifie",
    comment: "",
  });
  const [segmentDrafts, setSegmentDrafts] = useState<Record<string, Draft>>({});

  async function loadPlanning(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      setState(await getPlanningCalendarState(chantierId));
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement planning.");
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlanning(false);
  }, [chantierId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setSelectedSegmentId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const settings = state?.settings ?? { hoursPerDay: 7, dayCapacity: 3, workingDays: [1, 2, 3, 4, 5], skipWeekends: true };
  const tasks = state?.tasks ?? [];
  const segments = state?.segments ?? [];

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const segmentById = useMemo(() => new Map(segments.map((segment) => [segment.id, segment])), [segments]);
  const intervenantsById = useMemo(() => new Map(intervenants.map((intervenant) => [intervenant.id, intervenant])), [intervenants]);

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const visibleDays = useMemo(() => {
    if (calendarView === "day") return [anchorDate];
    const count = settings.skipWeekends ? 5 : 7;
    return Array.from({ length: count }, (_, index) => addDaysToKey(weekStart, index));
  }, [anchorDate, calendarView, settings.skipWeekends, weekStart]);
  const visibleDaySet = useMemo(() => new Set(visibleDays), [visibleDays]);
  const visibleTimeStart = useMemo(() => parseDateKey(visibleDays[0] ?? anchorDate).getTime(), [anchorDate, visibleDays]);
  const visibleTimeEnd = useMemo(() => parseDateKey(addDaysToKey(visibleDays[visibleDays.length - 1] ?? anchorDate, 1)).getTime(), [anchorDate, visibleDays]);

  const segmentsByTask = useMemo(() => {
    const next = new Map<string, PlanningCalendarSegment[]>();
    for (const segment of segments) {
      const list = next.get(segment.task_id) ?? [];
      list.push(segment);
      next.set(segment.task_id, list);
    }
    for (const list of next.values()) {
      list.sort(sortSegmentsByPlanning);
    }
    return next;
  }, [segments]);

  const { blockMetrics, taskSummaries } = useMemo(() => computePlanningProgress(tasks, segments, settings), [tasks, segments, settings]);

  const taskCards = useMemo<BacklogTask[]>(() => {
    return tasks
      .map((task) => {
        const summary = taskSummaries.get(task.id) ?? {
          taskId: task.id,
          plannedTaskHours: task.temps_prevu_h ?? 0,
          scheduledBlockHours: 0,
          estimatedWorkedHours: 0,
          actualWorkedHours: task.temps_reel_h ?? 0,
          remainingHours: task.temps_prevu_h ?? 0,
          progressPercent: 0,
          inconsistency: false,
          segmentCount: 0,
        };
        return { task, summary, planningState: getTaskPlanningState(task, summary) };
      })
      .sort((a, b) => {
        const byState = a.planningState.localeCompare(b.planningState);
        if (byState !== 0) return byState;
        const byLot = String(a.task.lot ?? a.task.corps_etat ?? "").localeCompare(String(b.task.lot ?? b.task.corps_etat ?? ""), "fr");
        if (byLot !== 0) return byLot;
        return getTaskPlanningTitle(a.task).localeCompare(getTaskPlanningTitle(b.task), "fr");
      });
  }, [taskSummaries, tasks]);

  const lots = useMemo(() => [...new Set(tasks.map((task) => String(task.lot ?? task.corps_etat ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return taskCards.filter(({ task, planningState }) => {
      const matchesQuery =
        !query ||
        [getTaskPlanningTitle(task), task.lot ?? "", task.corps_etat ?? "", task.libelle_devis_original ?? ""].join(" ").toLowerCase().includes(query);
      const matchesLot = lotFilter === "__all__" || (task.lot ?? task.corps_etat ?? "") === lotFilter;
      const matchesState = taskFilter === "all" || planningState === taskFilter;
      const matchesIntervenant =
        intervenantFilter === "__all__" ||
        task.intervenant_id === intervenantFilter ||
        (segmentsByTask.get(task.id) ?? []).some((segment) => segment.intervenant_id === intervenantFilter);
      return matchesQuery && matchesLot && matchesState && matchesIntervenant;
    });
  }, [search, lotFilter, taskFilter, intervenantFilter, taskCards, segmentsByTask]);

  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) ?? null : null;
  const selectedSegment = selectedSegmentId ? segmentById.get(selectedSegmentId) ?? null : null;
  const selectedTaskSegments = useMemo(() => (selectedTask ? segmentsByTask.get(selectedTask.id) ?? [] : []), [selectedTask, segmentsByTask]);
  const selectedTaskSummary = selectedTask ? taskSummaries.get(selectedTask.id) ?? null : null;
  const createBlockValidationError = selectedTask ? validateDraft(newBlockDraft) : "Selectionne une tache a planifier.";

  function resetNewBlockForm(task: PlanningCalendarTask, startDate?: string) {
    setNewBlockDraft(defaultDraft(task, startDate ?? nextPlannableDate(visibleDays[0] ?? anchorDate, settings)));
  }

  function upsertSegmentLocally(segment: PlanningCalendarSegment) {
    setState((current) => {
      if (!current) return current;
      const nextSegments = [...current.segments.filter((item) => item.id !== segment.id), segment].sort(sortSegmentsByPlanning);
      return { ...current, segments: nextSegments };
    });
  }

  function removeSegmentsLocally(ids: string[]) {
    if (!ids.length) return;
    setState((current) => {
      if (!current) return current;
      return { ...current, segments: current.segments.filter((segment) => !ids.includes(segment.id)) };
    });
  }

  useEffect(() => {
    if (!selectedTask) return;
    const startDate = selectedSegment?.start_date ?? selectedTaskSegments[0]?.start_date ?? nextPlannableDate(visibleDays[0] ?? anchorDate, settings);
    setNewBlockDraft((current) => ({
      ...defaultDraft(selectedTask, startDate),
      title_override: current.title_override && current.title_override !== getTaskPlanningTitle(selectedTask) ? current.title_override : getTaskPlanningTitle(selectedTask),
    }));
    const next: Record<string, Draft> = {};
    for (const segment of selectedTaskSegments) {
      next[segment.id] = mapSegmentToDraft(selectedTask, segment);
    }
    setSegmentDrafts(next);
  }, [anchorDate, selectedSegment, selectedTask, selectedTaskSegments, settings, visibleDays]);

  const filteredIntervenants = useMemo(() => (intervenantFilter === "__all__" ? intervenants : intervenants.filter((intervenant) => intervenant.id === intervenantFilter)), [intervenantFilter, intervenants]);

  const rows = useMemo<Row[]>(
    () => [
      { id: "unassigned", label: "Non affecte", intervenantId: null, color: getIntervenantColor("unassigned") },
      ...filteredIntervenants.map((intervenant) => ({ id: intervenant.id, label: intervenant.nom, intervenantId: intervenant.id, color: getIntervenantColor(intervenant.id) })),
    ],
    [filteredIntervenants],
  );

  const rowLoadByCell = useMemo(() => {
    const map = new Map<string, number>();
    for (const segment of segments) {
      const rowId = segment.intervenant_id ?? "unassigned";
      for (const load of computeDayLoadHours(segment, settings)) {
        if (!visibleDaySet.has(load.date)) continue;
        const key = `${rowId}:${load.date}`;
        map.set(key, Math.round(((map.get(key) ?? 0) + load.hours) * 100) / 100);
      }
    }
    return map;
  }, [segments, settings, visibleDaySet]);

  const rowWeekHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const total = visibleDays.reduce((sum, day) => sum + (rowLoadByCell.get(`${row.id}:${day}`) ?? 0), 0);
      map.set(row.id, Math.round(total * 100) / 100);
    }
    return map;
  }, [rowLoadByCell, rows, visibleDays]);

  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of visibleDays) {
      const total = rows.reduce((sum, row) => sum + (rowLoadByCell.get(`${row.id}:${day}`) ?? 0), 0);
      map.set(day, Math.round(total * 100) / 100);
    }
    return map;
  }, [rowLoadByCell, rows, visibleDays]);

  const visibleSegments = useMemo(() => (intervenantFilter === "__all__" ? segments : segments.filter((segment) => !segment.intervenant_id || segment.intervenant_id === intervenantFilter)), [segments, intervenantFilter]);

  const timelineGroups = useMemo<TimelineGroup[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        title: row.label,
        intervenantId: row.intervenantId,
        color: row.color,
        weekHours: rowWeekHours.get(row.id) ?? 0,
        isUnassigned: row.id === "unassigned",
      })),
    [rowWeekHours, rows],
  );

  const timelineItems = useMemo<TimelineItem[]>(
    () =>
      visibleSegments
        .map((segment) => {
          const task = taskById.get(segment.task_id);
          if (!task) return null;
          const metric = blockMetrics.get(segment.id);
          const span = toTimelineItemSpan(segment, settings);
          return {
            id: segment.id,
            group: segment.intervenant_id ?? "unassigned",
            title: getSegmentPlanningTitle(segment, task),
            start_time: span.start_time,
            end_time: span.end_time,
            canMove: true,
            canResize: "right",
            canChangeGroup: true,
            taskId: task.id,
            taskTitle: getTaskPlanningTitle(task),
            lot: task.lot ?? task.corps_etat ?? "Sans lot",
            color: getLotColor(task),
            progressPercent: metric?.progressPercent ?? 0,
            status: metric?.status ?? "planifie",
            plannedHours: metric?.plannedHours ?? computePlannedHours(segment.duration_days, settings),
          };
        })
        .filter((item): item is TimelineItem => Boolean(item)),
    [blockMetrics, settings, taskById, visibleSegments],
  );

  const alerts = useMemo<AlertItem[]>(() => {
    const next: AlertItem[] = [];
    const today = formatDateKey(new Date());

    for (const { task, summary, planningState } of taskCards) {
      if ((task.temps_prevu_h ?? 0) <= 0) {
        next.push({ id: `task-no-hours-${task.id}`, tone: "warning", label: `${getTaskPlanningTitle(task)} : tache sans duree prevue.` });
      }
      if (summary.scheduledBlockHours > summary.plannedTaskHours + 0.25 && summary.plannedTaskHours > 0) {
        next.push({ id: `task-over-${task.id}`, tone: "danger", label: `${getTaskPlanningTitle(task)} : tache sur-planifiee.` });
      }
      if (planningState !== "terminee") {
        const futureBlocks = (segmentsByTask.get(task.id) ?? []).filter((segment) => segment.start_date >= today);
        if (summary.progressPercent > 0 && futureBlocks.length === 0) {
          next.push({ id: `task-late-${task.id}`, tone: "warning", label: `${getTaskPlanningTitle(task)} : aucun bloc futur planifie.` });
        }
      }
    }

    for (const segment of segments) {
      const task = taskById.get(segment.task_id);
      if (!task) continue;
      if (!segment.intervenant_id) {
        next.push({ id: `segment-unassigned-${segment.id}`, tone: "warning", label: `${getSegmentPlanningTitle(segment, task)} : bloc sans intervenant.` });
      }
      if (!getSegmentPlanningTitle(segment, task).trim()) {
        next.push({ id: `segment-title-${segment.id}`, tone: "warning", label: `${getTaskPlanningTitle(task)} : bloc sans intitule.` });
      }
      if (!isWorkingDay(segment.start_date, settings)) {
        next.push({ id: `segment-day-${segment.id}`, tone: "warning", label: `${getSegmentPlanningTitle(segment, task)} : bloc sur jour non ouvre.` });
      }
    }

    for (const [key, hours] of rowLoadByCell.entries()) {
      if (hours <= settings.hoursPerDay) continue;
      const [rowId, day] = key.split(":");
      const label = rowId === "unassigned" ? "Non affecte" : intervenantsById.get(rowId)?.nom ?? "Intervenant";
      next.push({ id: `overload-${key}`, tone: "danger", label: `${label} surcharge le ${formatDayLabel(day, locale)} (${formatHours(hours)}).` });
    }

    return next.slice(0, 12);
  }, [intervenantsById, locale, rowLoadByCell, segments, segmentsByTask, settings, taskById, taskCards]);

  const visibleBlockCount = useMemo(() => timelineItems.length, [timelineItems.length]);
  const visibleHours = useMemo(() => Math.round(Array.from(dayTotals.values()).reduce((sum, value) => sum + value, 0) * 100) / 100, [dayTotals]);

  function openTask(taskId: string) {
    setSelectedTaskId(taskId);
    setSelectedSegmentId(null);
    setDrawerOpen(true);
  }

  function openSegment(segmentId: string) {
    const segment = segmentById.get(segmentId);
    if (!segment) return;
    setSelectedTaskId(segment.task_id);
    setSelectedSegmentId(segmentId);
    setDrawerOpen(true);
  }

  function prefillFromTimeline(groupId: string, time: number) {
    const day = formatDateKey(new Date(time));
    if (!selectedTask) {
      setNotice("Selectionne d'abord une tache a planifier dans la colonne de droite.");
      return;
    }
    setSelectedSegmentId(null);
    setDrawerOpen(true);
    setNewBlockDraft({
      ...defaultDraft(selectedTask, day),
      start_date: day,
      intervenant_id: groupId === "unassigned" ? "" : groupId,
    });
  }

  function nextOrderInDay(day: string, excludeId?: string) {
    return segments.filter((segment) => segment.start_date === day && segment.id !== excludeId).length;
  }

  async function saveSettings(patch: Partial<PlanningCalendarSettings>) {
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarSettings(chantierId, patch);
      await loadPlanning(true);
      setNotice("Parametres planning mis a jour.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise a jour parametres planning.");
    } finally {
      setSaving(false);
    }
  }

  async function createBlock(task: PlanningCalendarTask, draft: Draft, options?: { keepOpen?: boolean }) {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      setDrawerOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createPlanningCalendarSegment(
        chantierId,
        task.id,
        {
          start_date: draft.start_date,
          duration_days: clampDurationDays(draft.duration_days),
          intervenant_id: draft.intervenant_id || task.intervenant_id || null,
          order_in_day: nextOrderInDay(draft.start_date),
          title_override: draft.title_override.trim() || getTaskPlanningTitle(task),
          progress_percent: parseProgress(draft.progress_percent),
          status: draft.status,
          comment: draft.comment.trim() || null,
        },
        settings,
      );
      upsertSegmentLocally(created);
      setSelectedTaskId(task.id);
      if (options?.keepOpen) {
        const nextDate = nextPlannableDate(addDaysToKey(computeEndDate(created.start_date, created.duration_days, settings), 1), settings);
        setSelectedSegmentId(null);
        resetNewBlockForm(task, nextDate);
      } else {
        setSelectedSegmentId(created.id);
      }
      setDrawerOpen(true);
      setNotice("Bloc planning cree.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Erreur creation bloc.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBlock(segment: PlanningCalendarSegment, draft: Draft) {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updatePlanningCalendarSegment(
        segment.id,
        {
          start_date: draft.start_date,
          duration_days: clampDurationDays(draft.duration_days),
          intervenant_id: draft.intervenant_id || null,
          order_in_day: draft.start_date !== segment.start_date ? nextOrderInDay(draft.start_date, segment.id) : segment.order_in_day,
          title_override: draft.title_override.trim() || null,
          progress_percent: parseProgress(draft.progress_percent),
          status: draft.status,
          comment: draft.comment.trim() || null,
        },
        settings,
        { start_date: segment.start_date, duration_days: segment.duration_days },
      );
      upsertSegmentLocally(saved);
      setSelectedSegmentId(segment.id);
      setDrawerOpen(true);
      setNotice("Bloc planning mis a jour.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise a jour bloc.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBlocks(ids: string[]) {
    if (!ids.length) return;
    setSaving(true);
    setError(null);
    try {
      await deletePlanningCalendarSegments(ids);
      removeSegmentsLocally(ids);
      if (ids.includes(selectedSegmentId ?? "")) setSelectedSegmentId(null);
      setNotice(ids.length > 1 ? "Blocs supprimes." : "Bloc supprime.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Erreur suppression bloc.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateBlock(segment: PlanningCalendarSegment) {
    const task = taskById.get(segment.task_id);
    if (!task) return;
    const draft = segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment);
    await createBlock(task, { ...draft, title_override: `${draft.title_override} copie`.trim() });
  }

  async function markBlockDone(segment: PlanningCalendarSegment) {
    const task = taskById.get(segment.task_id);
    if (!task) return;
    await saveBlock(segment, { ...(segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment)), progress_percent: "100", status: "termine" });
  }

  async function applyTaskStatus(status: string) {
    if (!selectedTask) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarTask(selectedTask.id, { status }, settings, false);
      await loadPlanning(true);
      setNotice("Statut tache mis a jour.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise a jour tache.");
    } finally {
      setSaving(false);
    }
  }

  async function applySuggestion(task: PlanningCalendarTask) {
    const startDate = nextPlannableDate(visibleDays[0] ?? anchorDate, settings);
    const suggestion = buildSuggestedBlocks(task, startDate, settings);
    if (!suggestion.length) return;
    if ((segmentsByTask.get(task.id)?.length ?? 0) > 0 && typeof window !== "undefined" && !window.confirm("Remplacer les blocs existants de cette tache ?")) return;
    setSaving(true);
    setError(null);
    try {
      const existing = segmentsByTask.get(task.id) ?? [];
      if (existing.length) {
        await deletePlanningCalendarSegments(existing.map((segment) => segment.id));
      }
      for (const item of suggestion) {
        await createPlanningCalendarSegment(
          chantierId,
          task.id,
          {
            start_date: item.start_date,
            duration_days: item.duration_days,
            intervenant_id: task.intervenant_id,
            order_in_day: nextOrderInDay(item.start_date),
            title_override: item.title_override,
            progress_percent: 0,
            status: "planifie",
            comment: null,
          },
          settings,
        );
      }
      await loadPlanning(true);
      setSelectedTaskId(task.id);
      setSelectedSegmentId(null);
      setDrawerOpen(true);
      setNotice("Decoupage suggere applique.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur reequilibrage planning.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTimelineMove(itemId: string, dragTime: number, newGroupOrder: number) {
    const segment = segmentById.get(itemId);
    const task = segment ? taskById.get(segment.task_id) : null;
    const group = timelineGroups[newGroupOrder];
    if (!segment || !task || !group) return;
    const draft = segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment);
    await saveBlock(segment, {
      ...draft,
      start_date: formatDateKey(new Date(dragTime)),
      intervenant_id: group.id === "unassigned" ? "" : group.id,
    });
  }

  async function handleTimelineResize(itemId: string, time: number, edge: "left" | "right") {
    if (edge !== "right") return;
    const segment = segmentById.get(itemId);
    const task = segment ? taskById.get(segment.task_id) : null;
    if (!segment || !task) return;
    const endInclusiveDate = formatDateKey(new Date(Math.max(time - 1, parseDateKey(segment.start_date).getTime())));
    const nextDuration = countWorkingDaysInclusive(segment.start_date, endInclusiveDate, settings);
    const draft = segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment);
    await saveBlock(segment, { ...draft, duration_days: nextDuration });
  }

  function handleTimeChange(visibleStart: number) {
    const nextAnchor = formatDateKey(new Date(visibleStart));
    setAnchorDate(calendarView === "week" ? startOfWeek(nextAnchor) : nextAnchor);
  }

  if (loading) {
    return <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement planning...</div>;
  }

  const taskSummaryFallback: PlanningTaskSummary = selectedTask
    ? {
        taskId: selectedTask.id,
        plannedTaskHours: 0,
        scheduledBlockHours: 0,
        estimatedWorkedHours: 0,
        actualWorkedHours: 0,
        remainingHours: 0,
        progressPercent: 0,
        inconsistency: false,
        segmentCount: 0,
      }
    : {
        taskId: "",
        plannedTaskHours: 0,
        scheduledBlockHours: 0,
        estimatedWorkedHours: 0,
        actualWorkedHours: 0,
        remainingHours: 0,
        progressPercent: 0,
        inconsistency: false,
        segmentCount: 0,
      };
  const currentTaskSummary = selectedTaskSummary ?? taskSummaryFallback;

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Planning chantier</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-950">Planning chantier</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{chantierName ?? "Chantier"}</span>
            </div>
            <div className="mt-2 text-sm text-slate-500">Timeline interactive groupee par intervenant, basee sur les taches et les blocs planning.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button type="button" className={buttonClass("ghost")} onClick={() => setAnchorDate(addDaysToKey(anchorDate, calendarView === "week" ? -7 : -1))}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="px-3 text-sm font-medium text-slate-700">{formatRangeLabel(visibleDays, locale)}</div>
              <button type="button" className={buttonClass("ghost")} onClick={() => setAnchorDate(addDaysToKey(anchorDate, calendarView === "week" ? 7 : 1))}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button type="button" className={compactBadgeClass(calendarView === "day")} onClick={() => setCalendarView("day")}>Vue jour</button>
            <button type="button" className={compactBadgeClass(calendarView === "week")} onClick={() => setCalendarView("week")}>Vue semaine</button>
            <button type="button" className={buttonClass("primary")} disabled={!selectedTask} onClick={() => selectedTask && setDrawerOpen(true)}>
              <Plus className="mr-1 inline h-4 w-4" />
              Creer un bloc
            </button>
            <button type="button" className={buttonClass()} disabled={!selectedTask || saving} onClick={() => selectedTask && void applySuggestion(selectedTask)}>
              <WandSparkles className="mr-1 inline h-4 w-4" />
              Reequilibrer
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem_14rem]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Lot</span>
              <select className={inputClass()} value={lotFilter} onChange={(event) => setLotFilter(event.target.value)}>
                <option value="__all__">Tous les lots</option>
                {lots.map((lot) => <option key={lot} value={lot}>{lot}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Intervenant</span>
              <select className={inputClass()} value={intervenantFilter} onChange={(event) => setIntervenantFilter(event.target.value)}>
                <option value="__all__">Tous</option>
                {intervenants.map((intervenant) => <option key={intervenant.id} value={intervenant.id}>{intervenant.nom}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Statut</span>
              <select className={inputClass()} value={taskFilter} onChange={(event) => setTaskFilter(event.target.value as TaskFilter)}>
                <option value="all">Tous</option>
                <option value="a_planifier">Non planifiees</option>
                <option value="partielle">Partiellement planifiees</option>
                <option value="planifiee">Planifiees</option>
                <option value="en_cours">En cours</option>
                <option value="terminee">Terminees</option>
                <option value="bloquee">Bloquees</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={settings.skipWeekends} onChange={(event) => void saveSettings({ skipWeekends: event.target.checked })} />
            Exclure les week-ends
          </label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Taches non planifiees</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{taskCards.filter((item) => item.planningState === "a_planifier").length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Blocs visibles</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{visibleBlockCount}</div>
          </div>
          <div className={["rounded-2xl border px-4 py-3 text-sm", alerts.length ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700"].join(" ")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Charge / alertes</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-lg font-semibold">{formatHours(visibleHours)}</span>
              <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold">{alerts.length} alerte(s)</span>
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm xl:order-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Timeline equipe</div>
              <div className="text-xs text-slate-500">Deplace les blocs, redimensionne-les sur la droite, clique un bloc pour l'editer, clique un vide pour pre-remplir un nouveau bloc.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.slice(0, 2).map((alert) => (
                <span key={alert.id} className={["rounded-full px-3 py-1 text-xs font-semibold", alert.tone === "danger" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"].join(" ")}>
                  {alert.tone === "danger" ? "Alerte" : "Vigilance"}
                </span>
              ))}
            </div>
          </div>
          <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleDays.length)}, minmax(0,1fr))` }}>
            {visibleDays.map((day) => (
              <div key={day} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{formatDayLabel(day, locale)}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(dayTotals.get(day) ?? 0)}</div>
              </div>
            ))}
          </div>
          <div className="planning-timeline-shell">
            <Timeline
              groups={timelineGroups as any}
              items={timelineItems as any}
              visibleTimeStart={visibleTimeStart}
              visibleTimeEnd={visibleTimeEnd}
              sidebarWidth={250}
              rightSidebarWidth={0}
              selected={selectedSegmentId ? [selectedSegmentId] : []}
              canMove
              canResize="right"
              canChangeGroup
              stackItems
              useResizeHandle
              itemHeightRatio={0.82}
              itemVerticalGap={10}
              lineHeight={88}
              dragSnap={DAY_MS}
              minZoom={DAY_MS}
              maxZoom={calendarView === "week" ? DAY_MS * Math.max(visibleDays.length, 1) : DAY_MS}
              traditionalZoom={false}
              className="planning-timeline"
              groupRenderer={({ group }: any) => (
                <div className="planning-timeline__group">
                  <span className="planning-timeline__group-dot" style={{ backgroundColor: group.color.solid }} />
                  <div className="min-w-0">
                    <div className="truncate planning-timeline__group-title">{group.title}</div>
                    <div className="planning-timeline__group-meta">{formatHours(group.weekHours)} sur la periode</div>
                  </div>
                </div>
              )}
              itemRenderer={({ item, itemContext, getItemProps, getResizeProps }: any) => {
                const resizeProps = getResizeProps();
                return (
                  <div
                    {...getItemProps({
                      className: ["planning-timeline__item", itemContext.selected ? "planning-timeline__item--selected" : ""].join(" "),
                      style: { background: item.color.soft, borderColor: item.color.border, color: item.color.text },
                    })}
                  >
                    <div className="planning-timeline__item-lot">{item.lot}</div>
                    <div className="planning-timeline__item-title">{item.title}</div>
                    <div className="planning-timeline__item-subtitle">{item.taskTitle}</div>
                    <div className="planning-timeline__item-footer">
                      <span className="planning-timeline__pill">{formatHours(item.plannedHours)}</span>
                      <span className="planning-timeline__pill">{item.progressPercent}%</span>
                      <span className={["planning-timeline__pill", blockStatusTone(item.status)].join(" ")}>{blockStatusLabel(item.status)}</span>
                    </div>
                    {itemContext.canResizeRight ? <div {...resizeProps.right} className="planning-timeline__resize" /> : null}
                  </div>
                );
              }}
              onItemSelect={(itemId: string | number) => openSegment(String(itemId))}
              onItemClick={(itemId: string | number) => openSegment(String(itemId))}
              onItemDoubleClick={(itemId: string | number) => openSegment(String(itemId))}
              onItemDeselect={() => setSelectedSegmentId(null)}
              onItemMove={(itemId: string | number, dragTime: number, newGroupOrder: number) => void handleTimelineMove(String(itemId), dragTime, newGroupOrder)}
              onItemResize={(itemId: string | number, time: number, edge: "left" | "right") => void handleTimelineResize(String(itemId), time, edge)}
              onCanvasClick={(groupId: string | number, time: number) => prefillFromTimeline(String(groupId), time)}
              onTimeChange={(start: number, end: number, updateScrollCanvas: (startTime: number, endTime: number) => void) => {
                updateScrollCanvas(start, end);
                handleTimeChange(start);
              }}
              verticalLineClassNamesForTime={(timeStart: number) => {
                const day = formatDateKey(new Date(timeStart));
                const classes = [];
                if (!isWorkingDay(day, settings)) classes.push("planning-timeline__column--weekend");
                if (day === formatDateKey(new Date())) classes.push("planning-timeline__column--today");
                return classes;
              }}
              horizontalLineClassNamesForGroup={(group: any) => (group.isUnassigned ? ["planning-timeline__row--unassigned"] : [])}
            >
              <TimelineHeaders className="sticky top-0 z-10">
                <SidebarHeader>
                  {({ getRootProps }: any) => (
                    <div {...getRootProps()} className="flex h-full items-center px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Intervenants
                    </div>
                  )}
                </SidebarHeader>
                <DateHeader unit="primaryHeader" />
                <DateHeader unit="day" />
              </TimelineHeaders>
              <TodayMarker>{() => <div className="planning-timeline__today-marker" />}</TodayMarker>
            </Timeline>
          </div>
        </section>
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm xl:order-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Taches a planifier</div>
              <div className="text-xs text-slate-500">Clique une carte pour ouvrir la planification dans le drawer.</div>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{filteredTasks.length}</span>
          </div>
          <label className="mt-4 block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputClass()} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une tache, un lot, un libelle" />
            </div>
          </label>
          <div className="mt-4 max-h-[72vh] space-y-3 overflow-auto pr-1">
            {filteredTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucune tache avec ces filtres.</div> : filteredTasks.map((item) => (
              <BacklogCard key={item.task.id} item={item} settings={settings} selected={selectedTaskId === item.task.id && !selectedSegmentId} onPlan={() => openTask(item.task.id)} />
            ))}
          </div>
        </aside>
        {selectedTask && drawerOpen ? <button type="button" className="fixed inset-0 z-40 bg-slate-950/25" onClick={() => { setDrawerOpen(false); setSelectedSegmentId(null); }} aria-label="Fermer le drawer" /> : null}
        <aside
          className={[
            "fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl transition",
            selectedTask && drawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
          ].join(" ")}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{selectedSegmentId ? "Edition de bloc" : "Planification rapide"}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{selectedTask ? getTaskPlanningTitle(selectedTask) : "Planning chantier"}</div>
              <div className="mt-1 text-xs text-slate-500">{selectedTask ? `${selectedTask.lot ?? selectedTask.corps_etat ?? "Sans lot"} - ${formatHours(selectedTaskSummary?.remainingHours ?? 0)} restant(es)` : "Selectionne une tache a planifier."}</div>
            </div>
            <button type="button" className={buttonClass("ghost")} onClick={() => { setDrawerOpen(false); setSelectedSegmentId(null); }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedTask ? (
            selectedSegment ? (
              (() => {
                const draft = segmentDrafts[selectedSegment.id] ?? mapSegmentToDraft(selectedTask, selectedSegment);
                return (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Bloc planning</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{draft.title_override || getSegmentPlanningTitle(selectedSegment, selectedTask)}</div>
                        <div className="mt-1 text-xs text-slate-500">{getTaskPlanningTitle(selectedTask)} - {selectedTask.lot ?? selectedTask.corps_etat ?? "Sans lot"}</div>
                      </div>
                      <button type="button" className={buttonClass("ghost")} onClick={() => setSelectedSegmentId(null)}>Voir tache</button>
                    </div>
                    <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intitule terrain</span><input className={inputClass()} value={draft.title_override} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, title_override: event.target.value } }))} /></label>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Date</span><input type="date" className={inputClass()} value={draft.start_date} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, start_date: event.target.value } }))} /></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intervenant</span><select className={inputClass()} value={draft.intervenant_id} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, intervenant_id: event.target.value } }))}><option value="">Non affecte</option>{intervenants.map((intervenant) => <option key={intervenant.id} value={intervenant.id}>{intervenant.nom}</option>)}</select></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Duree</span><select className={inputClass()} value={String(draft.duration_days)} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, duration_days: Number(event.target.value) } }))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{formatHours(computePlannedHours(value, settings))}</option>)}</select></label>
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Statut</span><select className={inputClass()} value={draft.status} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, status: event.target.value as PlanningBlockStatus } }))}>{BLOCK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      </div>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Avancement (%)</span><input type="number" min="0" max="100" className={inputClass()} value={draft.progress_percent} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, progress_percent: event.target.value } }))} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Commentaire</span><textarea className={`${inputClass()} min-h-[96px] resize-y`} value={draft.comment} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, comment: event.target.value } }))} /></label>
                    </div>
                    <div className="grid gap-2">
                      <button type="button" className={buttonClass("primary")} disabled={saving} onClick={() => void saveBlock(selectedSegment, draft)}>Enregistrer</button>
                      <button type="button" className={buttonClass()} disabled={saving} onClick={() => void duplicateBlock(selectedSegment)}><Copy className="mr-1 inline h-4 w-4" />Dupliquer</button>
                      <button type="button" className={buttonClass()} disabled={saving} onClick={() => void markBlockDone(selectedSegment)}><CheckCircle2 className="mr-1 inline h-4 w-4" />Marquer termine</button>
                      <button type="button" className={buttonClass("danger")} disabled={saving} onClick={() => void deleteBlocks([selectedSegment.id])}><Trash2 className="mr-1 inline h-4 w-4" />Supprimer</button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tache source</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{getTaskPlanningTitle(selectedTask)}</div>
                    <div className="mt-1 text-xs text-slate-500">{selectedTask.lot ?? selectedTask.corps_etat ?? "Sans lot"}</div>
                  </div>
                  <span className={["rounded-full px-2 py-1 text-xs font-semibold", taskStateTone(getTaskPlanningState(selectedTask, currentTaskSummary))].join(" ")}>{taskStateLabel(getTaskPlanningState(selectedTask, currentTaskSummary))}</span>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Duree prevue</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(currentTaskSummary.plannedTaskHours || selectedTask.temps_prevu_h)}</div></div>
                    <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Planifie</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(currentTaskSummary.scheduledBlockHours)}</div></div>
                    <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Restant</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatHours(currentTaskSummary.remainingHours)}</div></div>
                    <div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Avancement global</div><div className="mt-1 text-sm font-semibold text-slate-900">{currentTaskSummary.progressPercent}%</div></div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <button type="button" className={buttonClass()} disabled={saving} onClick={() => void applySuggestion(selectedTask)}><WandSparkles className="mr-1 inline h-4 w-4" />Generer decoupage</button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className={buttonClass()} disabled={saving} onClick={() => void applyTaskStatus("BLOQUE")}>Marquer en attente</button>
                    <button type="button" className={buttonClass()} disabled={saving} onClick={() => void applyTaskStatus("FAIT")}>Terminer</button>
                  </div>
                </div>
                <form className="rounded-3xl border border-slate-200 bg-slate-50 p-3" onSubmit={(event) => { event.preventDefault(); void createBlock(selectedTask, newBlockDraft); }}>
                  <div className="space-y-3">
                    <div><div className="text-sm font-semibold text-slate-900">Creer un bloc</div><div className="mt-1 text-xs text-slate-500">Renseigne les champs puis valide. Le bloc apparait immediatement dans la timeline.</div></div>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intitule terrain</span><input className={inputClass()} value={newBlockDraft.title_override} onChange={(event) => setNewBlockDraft((current) => ({ ...current, title_override: event.target.value }))} /></label>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Date</span><input type="date" className={inputClass()} value={newBlockDraft.start_date} onChange={(event) => setNewBlockDraft((current) => ({ ...current, start_date: event.target.value }))} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intervenant</span><select className={inputClass()} value={newBlockDraft.intervenant_id} onChange={(event) => setNewBlockDraft((current) => ({ ...current, intervenant_id: event.target.value }))}><option value="">Non affecte</option>{intervenants.map((intervenant) => <option key={intervenant.id} value={intervenant.id}>{intervenant.nom}</option>)}</select></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Duree</span><select className={inputClass()} value={String(newBlockDraft.duration_days)} onChange={(event) => setNewBlockDraft((current) => ({ ...current, duration_days: Number(event.target.value) }))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{formatHours(computePlannedHours(value, settings))}</option>)}</select></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Statut initial</span><select className={inputClass()} value={newBlockDraft.status} onChange={(event) => setNewBlockDraft((current) => ({ ...current, status: event.target.value as PlanningBlockStatus }))}>{BLOCK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    </div>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Avancement initial (%)</span><input type="number" min="0" max="100" className={inputClass()} value={newBlockDraft.progress_percent} onChange={(event) => setNewBlockDraft((current) => ({ ...current, progress_percent: event.target.value }))} /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Commentaire</span><textarea className={`${inputClass()} min-h-[88px] resize-y`} value={newBlockDraft.comment} onChange={(event) => setNewBlockDraft((current) => ({ ...current, comment: event.target.value }))} /></label>
                  </div>
                  <div className="sticky bottom-0 -mx-3 mt-4 border-t border-slate-200 bg-slate-50/95 px-3 pb-1 pt-3 backdrop-blur">
                    {createBlockValidationError ? <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{createBlockValidationError}</div> : null}
                    <div className="grid gap-2">
                      <button type="submit" className={`${buttonClass("primary")} w-full justify-center`} disabled={saving || Boolean(createBlockValidationError)}><Plus className="mr-1 inline h-4 w-4" />Creer le bloc</button>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" className={buttonClass()} disabled={saving || Boolean(createBlockValidationError)} onClick={() => void createBlock(selectedTask, newBlockDraft, { keepOpen: true })}>Creer et continuer</button>
                        <button type="button" className={buttonClass("ghost")} disabled={saving} onClick={() => resetNewBlockForm(selectedTask, newBlockDraft.start_date)}>Reinitialiser</button>
                      </div>
                    </div>
                  </div>
                </form>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Blocs deja crees</div>
                  {selectedTaskSegments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Cette tache n'a encore aucun bloc planning.</div> : selectedTaskSegments.map((segment) => {
                    const draft = segmentDrafts[segment.id] ?? mapSegmentToDraft(selectedTask, segment);
                    return <button key={segment.id} type="button" className={["w-full rounded-2xl border px-3 py-3 text-left", selectedSegmentId === segment.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"].join(" ")} onClick={() => openSegment(segment.id)}><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-slate-900">{draft.title_override || getSegmentPlanningTitle(segment, selectedTask)}</div><div className="mt-1 text-xs text-slate-500">{draft.start_date} - {formatHours(computePlannedHours(draft.duration_days, settings))}</div></div><span className={["rounded-full px-2 py-1 text-[11px] font-semibold", blockStatusTone(draft.status)].join(" ")}>{blockStatusLabel(draft.status)}</span></div></button>;
                  })}
                </div>
                {alerts.length > 0 ? <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold text-slate-900">Alertes</div><div className="space-y-2">{alerts.map((alert) => <div key={alert.id} className={["flex items-start gap-2 rounded-2xl px-3 py-2 text-sm", alert.tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"].join(" ")}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{alert.label}</span></div>)}</div></div> : null}
              </div>
            )
          ) : null}
        </aside>
      </div>
    </div>
  );
}
