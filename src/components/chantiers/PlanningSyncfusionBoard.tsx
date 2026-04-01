import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { registerLicense } from "@syncfusion/ej2-base";
import {
  ScheduleComponent,
  ViewsDirective,
  ViewDirective,
  ResourcesDirective,
  ResourceDirective,
  Inject,
  TimelineViews,
  Resize,
  DragAndDrop,
} from "@syncfusion/ej2-react-schedule";
import type {
  CellClickEventArgs,
  DragEventArgs,
  EventClickArgs,
  EventRenderedArgs,
  PopupOpenEventArgs,
  RenderCellEventArgs,
  ResizeEventArgs,
} from "@syncfusion/ej2-react-schedule";
import "@syncfusion/ej2-base/styles/tailwind.css";
import "@syncfusion/ej2-react-schedule/styles/tailwind.css";
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
  type PlanningCalendarSegment,
  type PlanningCalendarState,
  type PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  addDaysToKey,
  clampDurationDays,
  computePlannedHours,
  distributeDayLoads,
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
  getSegmentPlanningTitle,
  getTaskPlanningState,
  getTaskPlanningTitle,
  normalizeBlockStatus,
  type PlanningBlockStatus,
  type PlanningTaskSummary,
  type TaskPlanningState,
} from "./planningBoard.utils";
import "./planningSyncfusion.css";

if (import.meta.env.VITE_SYNCFUSION_LICENSE_KEY) {
  registerLicense(import.meta.env.VITE_SYNCFUSION_LICENSE_KEY);
}

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
type SchedulerResource = {
  Id: string;
  Text: string;
  Color: string;
  SoftColor: string;
  BorderColor: string;
  TextColor: string;
  WeekHours: number;
  IntervenantId: string | null;
  IsUnassigned: boolean;
};
type SchedulerEvent = {
  Id: string;
  SegmentId: string;
  TaskId: string;
  Subject: string;
  TaskTitle: string;
  Lot: string;
  StartTime: Date;
  EndTime: Date;
  ResourceId: string;
  Status: PlanningBlockStatus;
  ProgressPercent: number;
  PlannedHours: number;
  Color: string;
  SoftColor: string;
  BorderColor: string;
  TextColor: string;
  IsAllDay: boolean;
};

const DURATION_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7];
const BLOCK_STATUS_OPTIONS: Array<{ value: PlanningBlockStatus; label: string }> = [
  { value: "brouillon", label: "Brouillon" },
  { value: "planifie", label: "Planifie" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Termine" },
  { value: "annule", label: "Annule" },
];
const VIEW_LABELS: Record<CalendarView, "TimelineDay" | "TimelineWeek"> = {
  day: "TimelineDay",
  week: "TimelineWeek",
};
const WORKDAY_START_HOUR = 8;

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
  if ((a.intervenant_id ?? "") !== (b.intervenant_id ?? "")) {
    return String(a.intervenant_id ?? "").localeCompare(String(b.intervenant_id ?? ""), "fr");
  }
  return a.order_in_day - b.order_in_day;
}

function dateAtHour(dateKey: string, hour: number) {
  const date = parseDateKey(dateKey);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function toSchedulerRange(segment: PlanningCalendarSegment, settings: PlanningCalendarSettings) {
  const loads = distributeDayLoads(segment.duration_days, segment.start_date, settings);
  const start = dateAtHour(loads[0]?.date ?? segment.start_date, WORKDAY_START_HOUR);
  const last = loads[loads.length - 1] ?? { date: segment.start_date, load: 1 };
  const end = dateAtHour(last.date, WORKDAY_START_HOUR);
  end.setMinutes(end.getMinutes() + Math.round(last.load * settings.hoursPerDay * 60));
  return { start, end };
}

function computeHoursFromSchedulerRange(start: Date, end: Date, settings: PlanningCalendarSettings) {
  if (!(start instanceof Date) || !(end instanceof Date) || end <= start) return settings.hoursPerDay * 0.25;
  let totalMinutes = 0;
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= lastDay) {
    const dateKey = formatDateKey(cursor);
    if (isWorkingDay(dateKey, settings)) {
      const workStart = dateAtHour(dateKey, WORKDAY_START_HOUR);
      const workEnd = new Date(workStart.getTime());
      workEnd.setMinutes(workEnd.getMinutes() + settings.hoursPerDay * 60);
      const overlapStart = Math.max(workStart.getTime(), start.getTime());
      const overlapEnd = Math.min(workEnd.getTime(), end.getTime());
      if (overlapEnd > overlapStart) {
        totalMinutes += Math.round((overlapEnd - overlapStart) / 60000);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.max(settings.hoursPerDay * 0.25, totalMinutes / 60);
}

function buildRangePatch(start: Date, end: Date, settings: PlanningCalendarSettings) {
  const startDate = nextPlannableDate(formatDateKey(start), settings);
  const hours = computeHoursFromSchedulerRange(start, end, settings);
  return {
    start_date: startDate,
    duration_days: clampDurationDays(hours / settings.hoursPerDay),
  };
}

function EventTemplate(props: SchedulerEvent) {
  return (
    <div className="planning-sf__event-card">
      <div className="planning-sf__event-title" title={props.Subject}>{props.Subject}</div>
      <div className="planning-sf__event-meta">{formatHours(props.PlannedHours)}</div>
    </div>
  );
}

function BacklogCard({
  item,
  settings,
  selected,
  onPlan,
  onDragStart,
  onDragEnd,
}: {
  item: BacklogTask;
  settings: PlanningCalendarSettings;
  selected: boolean;
  onPlan: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { task, summary, planningState } = item;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        "w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition",
        selected ? "border-slate-900 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow-md",
      ].join(" ")}
    >
      <button type="button" onClick={onPlan} className="block w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {task.lot ?? task.corps_etat ?? "Sans lot"}
          </span>
          <span className={["rounded-full px-2 py-1 text-[11px] font-semibold", taskStateTone(planningState)].join(" ")}>
            {taskStateLabel(planningState)}
          </span>
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
      </button>
      <div className="mt-4 flex gap-2">
        <button type="button" className={buttonClass("primary")} onClick={onPlan}>Planifier</button>
        <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500">Glisser vers timeline</div>
      </div>
    </div>
  );
}

export default function PlanningSyncfusionBoard({ chantierId, chantierName, intervenants }: Props) {
  const { locale } = useI18n();
  const scheduleRef = useRef<ScheduleComponent | null>(null);
  const [state, setState] = useState<PlanningCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(() => formatDateKey(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [search, setSearch] = useState("");
  const [lotFilter, setLotFilter] = useState("__all__");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("a_planifier");
  const [intervenantFilter, setIntervenantFilter] = useState("__all__");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
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
  const schemaWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (state?.planningColumnsMissing) warnings.push("Schema taches planning legacy detecte. Applique la migration Supabase de reparation.");
    if (state?.segmentColumnsMissing) warnings.push("Schema segments planning legacy detecte. La migration Supabase reste recommandee.");
    return warnings;
  }, [state?.planningColumnsMissing, state?.segmentColumnsMissing]);

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

  const segmentsByTask = useMemo(() => {
    const next = new Map<string, PlanningCalendarSegment[]>();
    for (const segment of segments) {
      const list = next.get(segment.task_id) ?? [];
      list.push(segment);
      next.set(segment.task_id, list);
    }
    for (const list of next.values()) list.sort(sortSegmentsByPlanning);
    return next;
  }, [segments]);

  const { blockMetrics, taskSummaries } = useMemo(() => computePlanningProgress(tasks, segments, settings), [tasks, segments, settings]);

  const taskCards = useMemo<BacklogTask[]>(() => {
    const order: TaskPlanningState[] = ["a_planifier", "partielle", "planifiee", "en_cours", "bloquee", "terminee"];
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
        const byState = order.indexOf(a.planningState) - order.indexOf(b.planningState);
        if (byState !== 0) return byState;
        const byLot = String(a.task.lot ?? a.task.corps_etat ?? "").localeCompare(String(b.task.lot ?? b.task.corps_etat ?? ""), "fr");
        if (byLot !== 0) return byLot;
        return getTaskPlanningTitle(a.task).localeCompare(getTaskPlanningTitle(b.task), "fr");
      });
  }, [taskSummaries, tasks]);

  const lots = useMemo(
    () => [...new Set(tasks.map((task) => String(task.lot ?? task.corps_etat ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [tasks],
  );

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

  const intervenantRows = useMemo(() => {
    const ids = new Set<string>();
    intervenants.forEach((intervenant) => ids.add(intervenant.id));
    tasks.forEach((task) => { if (task.intervenant_id) ids.add(task.intervenant_id); });
    segments.forEach((segment) => { if (segment.intervenant_id) ids.add(segment.intervenant_id); });
    return [...ids]
      .map((id) => {
        const found = intervenantsById.get(id);
        return { id, nom: found?.nom ?? "Intervenant inconnu", color: getIntervenantColor(id) };
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [intervenants, intervenantsById, segments, tasks]);

  const filteredIntervenantRows = useMemo(
    () => (intervenantFilter === "__all__" ? intervenantRows : intervenantRows.filter((row) => row.id === intervenantFilter)),
    [intervenantFilter, intervenantRows],
  );

  const visibleSegments = useMemo(
    () => (intervenantFilter === "__all__" ? segments : segments.filter((segment) => !segment.intervenant_id || segment.intervenant_id === intervenantFilter)),
    [segments, intervenantFilter],
  );

  const rowLoadByCell = useMemo(() => {
    const next = new Map<string, number>();
    for (const segment of visibleSegments) {
      const loads = computeDayLoadHours(segment, settings);
      for (const load of loads) {
        if (!visibleDaySet.has(load.date)) continue;
        const rowId = segment.intervenant_id ?? "__unassigned__";
        const key = `${rowId}:${load.date}`;
        next.set(key, Math.round(((next.get(key) ?? 0) + load.hours) * 100) / 100);
      }
    }
    return next;
  }, [settings, visibleDaySet, visibleSegments]);

  const rowWeekHours = useMemo(() => {
    const next = new Map<string, number>();
    for (const row of filteredIntervenantRows) {
      const total = visibleDays.reduce((sum, day) => sum + (rowLoadByCell.get(`${row.id}:${day}`) ?? 0), 0);
      next.set(row.id, Math.round(total * 100) / 100);
    }
    const unassigned = visibleDays.reduce((sum, day) => sum + (rowLoadByCell.get(`__unassigned__:${day}`) ?? 0), 0);
    next.set("__unassigned__", Math.round(unassigned * 100) / 100);
    return next;
  }, [filteredIntervenantRows, rowLoadByCell, visibleDays]);

  const dayTotals = useMemo(() => {
    const next = new Map<string, number>();
    for (const day of visibleDays) {
      let total = rowLoadByCell.get(`__unassigned__:${day}`) ?? 0;
      for (const row of filteredIntervenantRows) total += rowLoadByCell.get(`${row.id}:${day}`) ?? 0;
      next.set(day, Math.round(total * 100) / 100);
    }
    return next;
  }, [filteredIntervenantRows, rowLoadByCell, visibleDays]);

  const schedulerResources = useMemo<SchedulerResource[]>(() => {
    const mapped: SchedulerResource[] = filteredIntervenantRows.map((row) => ({
      Id: row.id,
      Text: row.nom,
      Color: row.color.solid,
      SoftColor: row.color.soft,
      BorderColor: row.color.border,
      TextColor: row.color.text,
      WeekHours: rowWeekHours.get(row.id) ?? 0,
      IntervenantId: row.id,
      IsUnassigned: false,
    }));
    mapped.push({
      Id: "__unassigned__",
      Text: "Non affecte",
      Color: "#64748b",
      SoftColor: "#f1f5f9",
      BorderColor: "#cbd5e1",
      TextColor: "#334155",
      WeekHours: rowWeekHours.get("__unassigned__") ?? 0,
      IntervenantId: null,
      IsUnassigned: true,
    });
    return mapped;
  }, [filteredIntervenantRows, rowWeekHours]);

  const schedulerEvents = useMemo<SchedulerEvent[]>(() => {
    return visibleSegments
      .map((segment) => {
        const task = taskById.get(segment.task_id);
        if (!task) return null;
        const metrics = blockMetrics.get(segment.id);
        const color = segment.intervenant_id ? getIntervenantColor(segment.intervenant_id) : getIntervenantColor("sans-affectation");
        const range = toSchedulerRange(segment, settings);
        return {
          Id: segment.id,
          SegmentId: segment.id,
          TaskId: task.id,
          Subject: getSegmentPlanningTitle(segment, task),
          TaskTitle: getTaskPlanningTitle(task),
          Lot: task.lot ?? task.corps_etat ?? "Sans lot",
          StartTime: range.start,
          EndTime: range.end,
          ResourceId: segment.intervenant_id ?? "__unassigned__",
          Status: metrics?.status ?? normalizeBlockStatus(segment.status, segment.progress_percent),
          ProgressPercent: metrics?.progressPercent ?? parseProgress(String(segment.progress_percent ?? 0)),
          PlannedHours: metrics?.plannedHours ?? computePlannedHours(segment.duration_days, settings),
          Color: color.solid,
          SoftColor: color.soft,
          BorderColor: color.border,
          TextColor: color.text,
          IsAllDay: true,
        };
      })
      .filter(Boolean) as SchedulerEvent[];
  }, [blockMetrics, settings, taskById, visibleSegments]);

  const alerts = useMemo<AlertItem[]>(() => {
    const next: AlertItem[] = [];
    for (const item of taskCards) {
      const { task, summary } = item;
      if (summary.inconsistency) {
        next.push({
          id: `task:${task.id}`,
          tone: summary.scheduledBlockHours > summary.plannedTaskHours ? "danger" : "warning",
          label: `${getTaskPlanningTitle(task)} : ${formatHours(summary.scheduledBlockHours)} planifiees pour ${formatHours(summary.plannedTaskHours)} prevues.`,
        });
      }
      const taskSegments = segmentsByTask.get(task.id) ?? [];
      if (taskSegments.length > 0 && taskSegments.some((segment) => !segment.intervenant_id)) {
        next.push({
          id: `task-unassigned:${task.id}`,
          tone: "warning",
          label: `${getTaskPlanningTitle(task)} contient des blocs sans intervenant.`,
        });
      }
    }
    for (const row of filteredIntervenantRows) {
      for (const day of visibleDays) {
        const hours = rowLoadByCell.get(`${row.id}:${day}`) ?? 0;
        if (hours > settings.hoursPerDay + 0.05) {
          next.push({
            id: `overload:${row.id}:${day}`,
            tone: "danger",
            label: `${row.nom} est surcharge le ${formatDayLabel(day, locale)} (${formatHours(hours)} pour ${formatHours(settings.hoursPerDay)} de capacite).`,
          });
        }
      }
    }
    return next.slice(0, 8);
  }, [filteredIntervenantRows, locale, rowLoadByCell, segmentsByTask, settings.hoursPerDay, taskCards, visibleDays]);

  function resetNewBlockForm(task: PlanningCalendarTask, startDate?: string, intervenantId = "") {
    const nextDate = startDate ?? nextPlannableDate(visibleDays[0] ?? anchorDate, settings);
    setNewBlockDraft({
      ...defaultDraft(task, nextDate),
      intervenant_id: intervenantId || task.intervenant_id || "",
    });
  }

  function upsertSegmentLocally(segment: PlanningCalendarSegment) {
    setState((current) => {
      if (!current) return current;
      const nextSegments = [...current.segments.filter((item) => item.id !== segment.id), segment].sort(sortSegmentsByPlanning);
      return { ...current, segments: nextSegments };
    });
  }

  function upsertTaskLocally(task: PlanningCalendarTask) {
    setState((current) => {
      if (!current) return current;
      return { ...current, tasks: current.tasks.map((item) => (item.id === task.id ? task : item)) };
    });
  }

  function removeSegmentsLocally(ids: string[]) {
    if (!ids.length) return;
    setState((current) => {
      if (!current) return current;
      return { ...current, segments: current.segments.filter((segment) => !ids.includes(segment.id)) };
    });
  }

  function openTask(taskId: string) {
    const task = taskById.get(taskId);
    if (!task) return;
    setSelectedTaskId(taskId);
    setSelectedSegmentId(null);
    resetNewBlockForm(task);
    setDrawerOpen(true);
  }

  function openSegment(segmentId: string) {
    const segment = segmentById.get(segmentId);
    if (!segment) return;
    setSelectedTaskId(segment.task_id);
    setSelectedSegmentId(segmentId);
    setDrawerOpen(true);
  }

  useEffect(() => {
    if (!selectedTask) return;
    const nextDate = selectedSegment?.start_date ?? nextPlannableDate(visibleDays[0] ?? anchorDate, settings);
    setNewBlockDraft((current) => ({
      ...defaultDraft(selectedTask, nextDate),
      title_override: current.title_override && selectedTaskId === selectedTask.id ? current.title_override : getTaskPlanningTitle(selectedTask),
      intervenant_id: current.intervenant_id && selectedTaskId === selectedTask.id ? current.intervenant_id : selectedTask.intervenant_id ?? "",
      duration_days: selectedTaskId === selectedTask.id ? current.duration_days : 1,
      progress_percent: selectedTaskId === selectedTask.id ? current.progress_percent : "0",
      status: selectedTaskId === selectedTask.id ? current.status : "planifie",
      comment: selectedTaskId === selectedTask.id ? current.comment : "",
      start_date: selectedTaskId === selectedTask.id && current.start_date ? current.start_date : nextDate,
    }));
  }, [anchorDate, selectedSegment?.start_date, selectedTask, selectedTaskId, settings, visibleDays]);

  async function createBlock(task: PlanningCalendarTask, draft: Draft, options?: { keepOpen?: boolean }) {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
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
          duration_days: draft.duration_days,
          order_in_day: (segmentsByTask.get(task.id)?.filter((segment) => segment.start_date === draft.start_date && (segment.intervenant_id ?? "") === (draft.intervenant_id || "")).length ?? 0),
          intervenant_id: draft.intervenant_id || null,
          title_override: draft.title_override,
          progress_percent: parseProgress(draft.progress_percent),
          status: draft.status,
          comment: draft.comment,
        },
        settings,
      );
      upsertSegmentLocally(created);
      setSelectedTaskId(task.id);
      setSelectedSegmentId(options?.keepOpen ? null : created.id);
      setDrawerOpen(true);
      if (options?.keepOpen) resetNewBlockForm(task, created.start_date, draft.intervenant_id);
      setNotice("Bloc planning cree.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Creation du bloc impossible.");
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
      const updated = await updatePlanningCalendarSegment(
        segment.id,
        {
          start_date: draft.start_date,
          duration_days: draft.duration_days,
          intervenant_id: draft.intervenant_id || null,
          title_override: draft.title_override,
          progress_percent: parseProgress(draft.progress_percent),
          status: draft.status,
          comment: draft.comment,
        },
        settings,
        { start_date: segment.start_date, duration_days: segment.duration_days },
      );
      upsertSegmentLocally(updated);
      if (selectedTask) {
        setSegmentDrafts((current) => ({ ...current, [segment.id]: mapSegmentToDraft(selectedTask, updated) }));
      }
      setNotice("Bloc planning mis a jour.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Mise a jour du bloc impossible.");
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
      setSelectedSegmentId((current) => (current && ids.includes(current) ? null : current));
      setNotice(ids.length > 1 ? "Blocs supprimes." : "Bloc supprime.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateBlock(segment: PlanningCalendarSegment) {
    const task = taskById.get(segment.task_id);
    if (!task) return;
    const draft = mapSegmentToDraft(task, segment);
    await createBlock(task, { ...draft, title_override: `${draft.title_override} copie`.trim() });
  }

  async function markBlockDone(segment: PlanningCalendarSegment) {
    const task = taskById.get(segment.task_id);
    if (!task) return;
    await saveBlock(segment, {
      ...(segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment)),
      progress_percent: "100",
      status: "termine",
    });
  }

  async function applyTaskStatus(status: string) {
    if (!selectedTask) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePlanningCalendarTask(selectedTask.id, { status }, settings, state?.mergedMetaSupported ?? false);
      upsertTaskLocally(updated);
      setNotice("Tache mise a jour.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre a jour la tache.");
    } finally {
      setSaving(false);
    }
  }

  async function applySuggestion(task: PlanningCalendarTask) {
    const suggestions = buildSuggestedBlocks(task, nextPlannableDate(anchorDate, settings), settings);
    if (!suggestions.length) return;
    setSaving(true);
    setError(null);
    try {
      for (const [index, suggestion] of suggestions.entries()) {
        const created = await createPlanningCalendarSegment(
          chantierId,
          task.id,
          {
            start_date: suggestion.start_date,
            duration_days: suggestion.duration_days,
            order_in_day: index,
            intervenant_id: task.intervenant_id,
            title_override: suggestion.title_override,
            progress_percent: 0,
            status: "planifie",
            comment: null,
          },
          settings,
        );
        upsertSegmentLocally(created);
      }
      setSelectedTaskId(task.id);
      setSelectedSegmentId(null);
      setDrawerOpen(true);
      setNotice("Decoupage planning genere.");
      void loadPlanning(true);
    } catch (err: any) {
      setError(err?.message ?? "Generation du decoupage impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSchedulerMove(args: DragEventArgs) {
    args.cancel = true;
    const item = args.data as SchedulerEvent;
    const segment = segmentById.get(String(item?.SegmentId ?? item?.Id));
    if (!segment || !args.startTime || !args.endTime) return;
    const resource = schedulerResources[args.groupIndex ?? schedulerResources.findIndex((entry) => entry.Id === item.ResourceId)];
    const patch = buildRangePatch(args.startTime, args.endTime, settings);
    const task = taskById.get(segment.task_id);
    if (!task) return;
    await saveBlock(segment, {
      ...(segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment)),
      ...patch,
      intervenant_id: resource?.IntervenantId ?? "",
    });
  }

  async function handleSchedulerResize(args: ResizeEventArgs) {
    args.cancel = true;
    const item = args.data as SchedulerEvent;
    const segment = segmentById.get(String(item?.SegmentId ?? item?.Id));
    if (!segment || !args.startTime || !args.endTime) return;
    const task = taskById.get(segment.task_id);
    if (!task) return;
    const patch = buildRangePatch(args.startTime, args.endTime, settings);
    await saveBlock(segment, {
      ...(segmentDrafts[segment.id] ?? mapSegmentToDraft(task, segment)),
      ...patch,
    });
  }

  function prefillFromCell(date: Date, resourceIndex: number | undefined) {
    if (!selectedTask) {
      setNotice("Selectionne une tache a planifier avant d'ajouter un bloc.");
      return;
    }
    const resource = schedulerResources[resourceIndex ?? 0] ?? schedulerResources[0];
    const startDate = nextPlannableDate(formatDateKey(date), settings);
    setSelectedSegmentId(null);
    setDrawerOpen(true);
    setNewBlockDraft((current) => ({
      ...current,
      start_date: startDate,
      intervenant_id: resource?.IntervenantId ?? "",
      title_override: current.title_override || getTaskPlanningTitle(selectedTask),
    }));
  }

  function handleBacklogDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    const taskId = draggedTaskId || event.dataTransfer.getData("text/plain");
    setDraggedTaskId(null);
    if (!taskId) return;
    const task = taskById.get(taskId);
    if (!task) return;
    const target = (event.target as HTMLElement).closest("[data-planning-date][data-resource-id]") as HTMLElement | null;
    if (!target?.dataset.planningDate) {
      setNotice("Depose la tache sur une cellule de la timeline.");
      return;
    }
    const resourceId = target.dataset.resourceId ?? "__unassigned__";
    const draft = {
      ...defaultDraft(task, target.dataset.planningDate),
      intervenant_id: resourceId === "__unassigned__" ? "" : resourceId,
    };
    setSelectedTaskId(task.id);
    setSelectedSegmentId(null);
    setDrawerOpen(true);
    setNewBlockDraft(draft);
    void createBlock(task, draft, { keepOpen: true });
  }

  function navigate(offset: number) {
    setAnchorDate(addDaysToKey(anchorDate, calendarView === "day" ? offset : offset * 7));
  }

  const visibleBlockCount = schedulerEvents.length;
  const visibleHours = useMemo(
    () => Math.round(Array.from(dayTotals.values()).reduce((sum, value) => sum + value, 0) * 100) / 100,
    [dayTotals],
  );

  const taskSummaryFallback: PlanningTaskSummary = {
    taskId: selectedTask?.id ?? "__none__",
    plannedTaskHours: selectedTask?.temps_prevu_h ?? 0,
    scheduledBlockHours: 0,
    estimatedWorkedHours: 0,
    actualWorkedHours: selectedTask?.temps_reel_h ?? 0,
    remainingHours: selectedTask?.temps_prevu_h ?? 0,
    progressPercent: 0,
    inconsistency: false,
    segmentCount: 0,
  };
  const currentTaskSummary = selectedTaskSummary ?? taskSummaryFallback;

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-500 shadow-sm">
        Chargement du planning chantier...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Planning chantier</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{chantierName ?? "Organisation chantier"}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Une vue planning tres lisible, inspiree d'un tableau de cartes. Les taches restent la source de verite, puis se transforment en blocs simples a deplacer par jour et par intervenant.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Periode</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatRangeLabel(visibleDays, locale)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Blocs visibles</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{visibleBlockCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Charge periode</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{formatHours(visibleHours)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Backlog</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Taches a planifier</div>
            </div>
            <button type="button" className={buttonClass()} disabled={!selectedTask || saving} onClick={() => selectedTask && void applySuggestion(selectedTask)}>
              <WandSparkles className="mr-1 inline h-4 w-4" />
              Decouper
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputClass()} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une tache..." />
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              <select className={inputClass()} value={lotFilter} onChange={(event) => setLotFilter(event.target.value)}>
                <option value="__all__">Tous les lots</option>
                {lots.map((lot) => <option key={lot} value={lot}>{lot}</option>)}
              </select>
              <select className={inputClass()} value={intervenantFilter} onChange={(event) => setIntervenantFilter(event.target.value)}>
                <option value="__all__">Tous les intervenants</option>
                {intervenantRows.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["a_planifier", "A planifier"],
                ["partielle", "Partielles"],
                ["planifiee", "Planifiees"],
                ["en_cours", "En cours"],
                ["all", "Toutes"],
              ] as Array<[TaskFilter, string]>).map(([value, label]) => (
                <button key={value} type="button" className={compactBadgeClass(taskFilter === value)} onClick={() => setTaskFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Aucune tache ne correspond aux filtres courants.
              </div>
            ) : (
              filteredTasks.map((item) => (
                <BacklogCard
                  key={item.task.id}
                  item={item}
                  settings={settings}
                  selected={selectedTaskId === item.task.id}
                  onPlan={() => openTask(item.task.id)}
                  onDragStart={() => setDraggedTaskId(item.task.id)}
                  onDragEnd={() => setDraggedTaskId(null)}
                />
              ))
            )}
          </div>
        </aside>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" className={compactBadgeClass(calendarView === "week")} onClick={() => setCalendarView("week")}>Semaine</button>
                <button type="button" className={compactBadgeClass(calendarView === "day")} onClick={() => setCalendarView("day")}>Jour</button>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1">
                <button type="button" className={buttonClass("ghost")} onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-[160px] text-center text-sm font-semibold text-slate-900">{formatRangeLabel(visibleDays, locale)}</div>
                <button type="button" className={buttonClass("ghost")} onClick={() => navigate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className={buttonClass()} onClick={() => setAnchorDate(formatDateKey(new Date()))}>Aujourd'hui</button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Glisse une tache depuis le backlog vers un jour. Chaque bloc reste une carte simple et deplacable.
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
          {schemaWarnings.length ? (
            <div className="mt-4 space-y-2">
              {schemaWarnings.map((warning) => <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{warning}</div>)}
            </div>
          ) : null}

          <div className="planning-sf-shell mt-4" onDragOver={(event) => event.preventDefault()} onDrop={handleBacklogDrop}>
            <ScheduleComponent
              ref={scheduleRef}
              cssClass="planning-sf-scheduler"
              width="100%"
              height="720px"
              currentView={VIEW_LABELS[calendarView]}
              selectedDate={parseDateKey(anchorDate)}
              showHeaderBar={false}
              showQuickInfo={false}
              allowDragAndDrop
              allowResizing
              allowSwiping={false}
              rowAutoHeight
              showWeekend={!settings.skipWeekends}
              workDays={settings.workingDays}
              firstDayOfWeek={1}
              timeScale={{ enable: false }}
              group={{ resources: ["Intervenants"] }}
              dateHeaderTemplate={(props: { date: Date }) => {
                const dateKey = formatDateKey(props.date);
                const total = dayTotals.get(dateKey) ?? 0;
                return (
                  <div className="planning-sf__date-header">
                    <div>{formatDayLabel(dateKey, locale)}</div>
                    <div className="planning-sf__date-total">{total > 0 ? formatHours(total) : "A planifier"}</div>
                  </div>
                );
              }}
              resourceHeaderTemplate={(props: any) => {
                const data = props.resourceData as SchedulerResource;
                return (
                  <div className="planning-sf__resource">
                    <span className="planning-sf__resource-dot" style={{ backgroundColor: data.Color }} />
                    <div className="min-w-0">
                      <div className="truncate planning-sf__resource-title">{data.Text}</div>
                      <div className="planning-sf__resource-meta">{formatHours(data.WeekHours)} sur la periode</div>
                    </div>
                  </div>
                );
              }}
              eventSettings={{
                dataSource: schedulerEvents,
                template: EventTemplate,
                enableTooltip: false,
                allowAdding: false,
                allowDeleting: false,
                allowEditing: false,
                enableIndicator: true,
                fields: {
                  id: "Id",
                  subject: { name: "Subject" },
                  startTime: { name: "StartTime" },
                  endTime: { name: "EndTime" },
                  isAllDay: { name: "IsAllDay" },
                },
              }}
              popupOpen={(args: PopupOpenEventArgs) => {
                if (["QuickInfo", "Editor", "EditEventInfo", "ViewEventInfo"].includes(String(args.type))) args.cancel = true;
              }}
              cellClick={(args: CellClickEventArgs) => {
                args.cancel = true;
                prefillFromCell(args.startTime, args.groupIndex);
              }}
              eventClick={(args: EventClickArgs) => {
                args.cancel = true;
                const event = Array.isArray(args.event) ? args.event[0] : args.event;
                if (event?.SegmentId || event?.Id) openSegment(String(event.SegmentId ?? event.Id));
              }}
              dragStop={(args: DragEventArgs) => void handleSchedulerMove(args)}
              resizeStop={(args: ResizeEventArgs) => void handleSchedulerResize(args)}
              renderCell={(args: RenderCellEventArgs) => {
                if (args.elementType !== "workCells" || !args.date) return;
                const resource = schedulerResources[args.groupIndex ?? 0];
                const dateKey = formatDateKey(args.date);
                const element = args.element as HTMLElement;
                const load = rowLoadByCell.get(`${resource?.IntervenantId ?? "__unassigned__"}:${dateKey}`) ?? 0;
                element.dataset.planningDate = dateKey;
                element.dataset.resourceId = resource?.IntervenantId ?? "__unassigned__";
                element.classList.toggle("planning-sf__cell--today", dateKey === formatDateKey(new Date()));
                element.classList.toggle("planning-sf__cell--weekend", !isWorkingDay(dateKey, settings));
                element.classList.toggle("planning-sf__cell--overload", load > settings.hoursPerDay + 0.05);
                element.classList.toggle("planning-sf__cell--droppable", Boolean(selectedTaskId || draggedTaskId));
              }}
              eventRendered={(args: EventRenderedArgs) => {
                const data = args.data as SchedulerEvent;
                args.element.classList.add("planning-sf__event");
                args.element.style.background = data.SoftColor;
                args.element.style.borderColor = data.BorderColor;
                args.element.style.color = data.TextColor;
                args.element.style.boxShadow = "0 12px 24px rgba(15, 23, 42, 0.08)";
              }}
            >
              <ResourcesDirective>
                <ResourceDirective
                  field="ResourceId"
                  title="Intervenants"
                  name="Intervenants"
                  allowMultiple={false}
                  dataSource={schedulerResources}
                  textField="Text"
                  idField="Id"
                  colorField="Color"
                />
              </ResourcesDirective>
              <ViewsDirective>
                <ViewDirective option="TimelineDay" displayName="Jour" />
                <ViewDirective option="TimelineWeek" displayName="Semaine" />
              </ViewsDirective>
              <Inject services={[TimelineViews, Resize, DragAndDrop]} />
            </ScheduleComponent>
          </div>
        </section>

        {selectedTask && drawerOpen ? (
          <button type="button" className="fixed inset-0 z-40 bg-slate-950/25" onClick={() => { setDrawerOpen(false); setSelectedSegmentId(null); }} aria-label="Fermer le drawer" />
        ) : null}

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
              <div className="mt-1 text-xs text-slate-500">{selectedTask ? `${selectedTask.lot ?? selectedTask.corps_etat ?? "Sans lot"} - ${formatHours(currentTaskSummary.remainingHours)} restantes` : "Selectionne une tache a planifier."}</div>
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
                        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intervenant</span><select className={inputClass()} value={draft.intervenant_id} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [selectedSegment.id]: { ...draft, intervenant_id: event.target.value } }))}><option value="">Non affecte</option>{intervenantRows.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}</select></label>
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
                    <div><div className="text-sm font-semibold text-slate-900">Creer un bloc</div><div className="mt-1 text-xs text-slate-500">Choisis le jour, l'intervenant, la duree et valide. Le bloc apparait immediatement dans la timeline Syncfusion.</div></div>
                    <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intitule terrain</span><input className={inputClass()} value={newBlockDraft.title_override} onChange={(event) => setNewBlockDraft((current) => ({ ...current, title_override: event.target.value }))} /></label>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Date</span><input type="date" className={inputClass()} value={newBlockDraft.start_date} onChange={(event) => setNewBlockDraft((current) => ({ ...current, start_date: event.target.value }))} /></label>
                      <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Intervenant</span><select className={inputClass()} value={newBlockDraft.intervenant_id} onChange={(event) => setNewBlockDraft((current) => ({ ...current, intervenant_id: event.target.value }))}><option value="">Non affecte</option>{intervenantRows.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}</select></label>
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
                        <button type="button" className={buttonClass("ghost")} disabled={saving} onClick={() => resetNewBlockForm(selectedTask, newBlockDraft.start_date, newBlockDraft.intervenant_id)}>Reinitialiser</button>
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
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Selectionne une tache dans le backlog ou clique sur une cellule pour commencer la planification.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
