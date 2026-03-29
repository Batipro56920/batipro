import { useEffect, useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { AlertTriangle, ChevronLeft, ChevronRight, GripVertical, Plus, Trash2, WandSparkles } from "lucide-react";
import { useI18n } from "../../i18n";
import type { IntervenantRow } from "../../services/intervenants.service";
import {
  createPlanningCalendarSegment,
  deletePlanningCalendarSegments,
  getPlanningCalendarState,
  updatePlanningCalendarSegment,
  updatePlanningCalendarSettings,
  type PlanningCalendarSegment,
  type PlanningCalendarState,
  type PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  addDaysToKey,
  clampDurationDays,
  computePlannedHours,
  formatDateKey,
  nextPlannableDate,
  startOfWeek,
  type PlanningCalendarSettings,
} from "./planningCalendar.utils";
import {
  buildSuggestedBlocks,
  computeDayLoadHours,
  computePlanningProgress,
  computeRowLanes,
  computeSegmentSpan,
  getIntervenantColor,
  getSegmentPlanningTitle,
  getTaskPlanningTitle,
  type PlanningBlockStatus,
  type PlanningColor,
} from "./planningBoard.utils";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

type PlanningMode = "simple" | "advanced";
type Row = { id: string; label: string; intervenantId: string | null };
type Draft = { start_date: string; duration_days: number; intervenant_id: string; title_override: string };
type RowBlock = {
  id: string;
  segment: PlanningCalendarSegment;
  task: PlanningCalendarTask;
  title: string;
  color: PlanningColor;
  lane: number;
  startIndex: number;
  endIndex: number;
  plannedHours: number;
  progressPercent: number;
  status: PlanningBlockStatus;
};

const CELL_HEIGHT = 86;
const DURATION_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7];

function buttonClass(kind: "primary" | "secondary" | "danger" = "secondary") {
  if (kind === "primary") return "rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300";
  if (kind === "danger") return "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";
  return "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
}

function inputClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100";
}

function formatDay(day: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00`));
}

function statusLabel(status: PlanningBlockStatus) {
  if (status === "termine") return "Termine";
  if (status === "en_cours") return "En cours";
  return "Prevu";
}

function statusTone(status: PlanningBlockStatus) {
  if (status === "termine") return "bg-emerald-100 text-emerald-700";
  if (status === "en_cours") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function defaultDraft(task: PlanningCalendarTask, startDate: string): Draft {
  return {
    start_date: startDate,
    duration_days: 1,
    intervenant_id: task.intervenant_id ?? "",
    title_override: getTaskPlanningTitle(task),
  };
}

function BacklogCard({
  task,
  scheduled,
  assigneeName,
  plannedHours,
  onSelect,
}: {
  task: PlanningCalendarTask;
  scheduled: boolean;
  assigneeName: string;
  plannedHours: number;
  onSelect: () => void;
}) {
  const drag = useDraggable({ id: `task:${task.id}` });
  const style = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined;
  return (
    <div ref={drag.setNodeRef} style={style} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <button type="button" className="mt-0.5 shrink-0 cursor-grab rounded-lg p-1 text-slate-400 hover:bg-slate-100" {...drag.listeners} {...drag.attributes}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="truncate text-sm font-semibold text-slate-900">{getTaskPlanningTitle(task)}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span>{Math.round(plannedHours * 10) / 10}h prevues</span>
            {assigneeName ? <span>{assigneeName}</span> : null}
            {task.lot || task.corps_etat ? <span>{task.lot ?? task.corps_etat}</span> : null}
          </div>
        </button>
        <span className={["rounded-full px-2 py-1 text-[11px] font-medium", scheduled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"].join(" ")}>
          {scheduled ? "Planifiee" : "Backlog"}
        </span>
      </div>
    </div>
  );
}

function Cell({ id, label, loadHours, overloaded }: { id: string; label: string; loadHours: number; overloaded: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={["relative border-r border-slate-200 last:border-r-0", overloaded ? "bg-rose-50/70" : "bg-white", isOver ? "bg-blue-50" : ""].join(" ")} title={`${label} - ${Math.round(loadHours * 100) / 100}h`}>
      <div className="pointer-events-none absolute bottom-2 right-2 text-[11px] font-medium text-slate-400">{loadHours > 0 ? `${Math.round(loadHours * 10) / 10}h` : ""}</div>
    </div>
  );
}

function Block({ block, count, selected, onSelect }: { block: RowBlock; count: number; selected: boolean; onSelect: () => void }) {
  const drag = useDraggable({ id: `segment:${block.segment.id}` });
  const style = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined;
  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      onClick={onSelect}
      {...drag.listeners}
      {...drag.attributes}
      style={{
        ...style,
        left: `${(block.startIndex / count) * 100}%`,
        width: `${((block.endIndex - block.startIndex + 1) / count) * 100}%`,
        top: 10 + block.lane * (CELL_HEIGHT - 20),
        backgroundColor: block.color.soft,
        borderColor: block.color.border,
        color: block.color.text,
      }}
      className={["absolute z-10 rounded-2xl border px-3 py-2 text-left shadow-sm", selected ? "ring-2 ring-slate-900/15" : ""].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{block.title}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
            <span>{Math.round(block.plannedHours * 10) / 10}h</span>
            <span>{block.progressPercent}%</span>
          </div>
        </div>
        <span className={["rounded-full px-2 py-1 text-[10px] font-semibold", statusTone(block.status)].join(" ")}>{statusLabel(block.status)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, block.progressPercent))}%`, backgroundColor: block.color.solid }} />
      </div>
    </button>
  );
}

export default function PlanningOperationsTab({ chantierId, chantierName, intervenants }: Props) {
  const { locale } = useI18n();
  const [state, setState] = useState<PlanningCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<PlanningMode>("simple");
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(formatDateKey(new Date())));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newBlockDraft, setNewBlockDraft] = useState<Draft>({ start_date: formatDateKey(new Date()), duration_days: 1, intervenant_id: "", title_override: "" });
  const [segmentDrafts, setSegmentDrafts] = useState<Record<string, Draft>>({});
  const [backlogQuery, setBacklogQuery] = useState("");

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
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const settings = state?.settings ?? { hoursPerDay: 7, dayCapacity: 3, workingDays: [1, 2, 3, 4, 5], skipWeekends: true };
  const tasks = state?.tasks ?? [];
  const segments = state?.segments ?? [];

  const taskById = useMemo(() => {
    const map = new Map<string, PlanningCalendarTask>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const segmentsByTask = useMemo(() => {
    const map = new Map<string, PlanningCalendarSegment[]>();
    for (const segment of segments) {
      const list = map.get(segment.task_id) ?? [];
      list.push(segment);
      map.set(segment.task_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.start_date !== b.start_date ? a.start_date.localeCompare(b.start_date) : a.order_in_day - b.order_in_day));
    }
    return map;
  }, [segments]);

  const visibleDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysToKey(weekAnchor, index)), [weekAnchor]);
  const visibleDaySet = useMemo(() => new Set(visibleDays), [visibleDays]);
  const rows = useMemo<Row[]>(() => [{ id: "unassigned", label: "Non affecte", intervenantId: null }, ...intervenants.map((it) => ({ id: it.id, label: it.nom, intervenantId: it.id }))], [intervenants]);
  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) ?? null : null;
  const selectedTaskSegments = useMemo(() => (selectedTask ? segmentsByTask.get(selectedTask.id) ?? [] : []), [selectedTask, segmentsByTask]);
  const { blockMetrics, taskSummaries } = useMemo(() => computePlanningProgress(tasks, segments, settings), [tasks, segments, settings]);

  useEffect(() => {
    if (!selectedTask) return;
    const startDate = selectedTaskSegments[0]?.start_date ?? nextPlannableDate(visibleDays[0], settings);
    setNewBlockDraft(defaultDraft(selectedTask, startDate));
    const next: Record<string, Draft> = {};
    for (const segment of selectedTaskSegments) {
      next[segment.id] = { start_date: segment.start_date, duration_days: segment.duration_days, intervenant_id: segment.intervenant_id ?? "", title_override: segment.title_override ?? getTaskPlanningTitle(selectedTask) };
    }
    setSegmentDrafts(next);
  }, [selectedTask, selectedTaskSegments, settings, visibleDays]);

  const boardBlocksByRow = useMemo(() => {
    const base = new Map<string, Array<Omit<RowBlock, "lane">>>();
    for (const segment of segments) {
      const task = taskById.get(segment.task_id);
      if (!task) continue;
      const span = computeSegmentSpan(segment, settings, visibleDays);
      if (!span) continue;
      const rowId = segment.intervenant_id ?? "unassigned";
      const list = base.get(rowId) ?? [];
      const metric = blockMetrics.get(segment.id);
      list.push({
        id: segment.id,
        segment,
        task,
        title: getSegmentPlanningTitle(segment, task),
        color: getIntervenantColor(rowId),
        startIndex: span.startIndex,
        endIndex: span.endIndex,
        plannedHours: metric?.plannedHours ?? computePlannedHours(segment.duration_days, settings),
        progressPercent: metric?.progressPercent ?? 0,
        status: metric?.status ?? "prevu",
      });
      base.set(rowId, list);
    }
    const finalMap = new Map<string, RowBlock[]>();
    for (const [rowId, blocks] of base.entries()) {
      const lanes = computeRowLanes(blocks.map((block) => ({ id: block.id, startIndex: block.startIndex, endIndex: block.endIndex })));
      finalMap.set(rowId, blocks.map((block) => ({ ...block, lane: lanes.get(block.id) ?? 0 })).sort((a, b) => (a.startIndex !== b.startIndex ? a.startIndex - b.startIndex : a.lane - b.lane)));
    }
    return finalMap;
  }, [blockMetrics, segments, settings, taskById, visibleDays]);

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

  const filteredTasks = useMemo(() => {
    const query = backlogQuery.trim().toLowerCase();
    return tasks.filter((task) => !query || [getTaskPlanningTitle(task), task.lot ?? "", task.corps_etat ?? ""].join(" ").toLowerCase().includes(query));
  }, [backlogQuery, tasks]);
  const backlogTasks = useMemo(() => filteredTasks.filter((task) => (segmentsByTask.get(task.id)?.length ?? 0) === 0), [filteredTasks, segmentsByTask]);
  const weeklyHours = useMemo(() => Math.round(Array.from(rowLoadByCell.values()).reduce((sum, value) => sum + value, 0) * 100) / 100, [rowLoadByCell]);
  const overloadCount = useMemo(() => Array.from(rowLoadByCell.values()).filter((value) => value > settings.hoursPerDay).length, [rowLoadByCell, settings.hoursPerDay]);
  const inconsistencyCount = useMemo(() => Array.from(taskSummaries.values()).filter((summary) => summary.inconsistency).length, [taskSummaries]);

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
      setError(err?.message ?? "Erreur mise a jour parametres.");
    } finally {
      setSaving(false);
    }
  }

  async function createBlock(task: PlanningCalendarTask, draft: Partial<Draft>) {
    setSaving(true);
    setError(null);
    try {
      await createPlanningCalendarSegment(chantierId, task.id, {
        start_date: draft.start_date ?? nextPlannableDate(visibleDays[0], settings),
        duration_days: clampDurationDays(draft.duration_days ?? 1),
        intervenant_id: draft.intervenant_id || task.intervenant_id || null,
        order_in_day: nextOrderInDay(draft.start_date ?? visibleDays[0]),
        title_override: String(draft.title_override ?? "").trim() || getTaskPlanningTitle(task),
      }, settings);
      await loadPlanning(true);
      setSelectedTaskId(task.id);
      setNotice("Bloc planning cree.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur creation bloc.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBlock(segmentId: string, draft: Draft) {
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlanningCalendarSegment(segmentId, {
        start_date: draft.start_date,
        duration_days: clampDurationDays(draft.duration_days),
        intervenant_id: draft.intervenant_id || null,
        title_override: draft.title_override,
        order_in_day: draft.start_date !== segment.start_date ? nextOrderInDay(draft.start_date, segment.id) : segment.order_in_day,
      }, settings, { start_date: segment.start_date, duration_days: segment.duration_days });
      await loadPlanning(true);
      setNotice("Bloc planning mis a jour.");
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
      await loadPlanning(true);
      setNotice(ids.length > 1 ? "Blocs supprimes." : "Bloc supprime.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur suppression bloc.");
    } finally {
      setSaving(false);
    }
  }

  async function applySuggestion(task: PlanningCalendarTask) {
    const startDate = selectedTaskSegments[0]?.start_date ?? nextPlannableDate(visibleDays[0], settings);
    const suggestion = buildSuggestedBlocks(task, startDate, settings);
    if (!suggestion.length) return;
    if (selectedTaskSegments.length > 0 && !window.confirm("Remplacer les blocs existants de cette tache ?")) return;
    setSaving(true);
    setError(null);
    try {
      if (selectedTaskSegments.length > 0) {
        await deletePlanningCalendarSegments(selectedTaskSegments.map((segment) => segment.id));
      }
      for (const item of suggestion) {
        await createPlanningCalendarSegment(chantierId, task.id, {
          start_date: item.start_date,
          duration_days: item.duration_days,
          intervenant_id: task.intervenant_id,
          order_in_day: nextOrderInDay(item.start_date),
          title_override: item.title_override,
        }, settings);
      }
      await loadPlanning(true);
      setNotice("Decoupage suggere applique.");
    } catch (err: any) {
      setError(err?.message ?? "Erreur suggestion planning.");
    } finally {
      setSaving(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id ?? "");
    const overId = String(event.over?.id ?? "");
    if (!overId.startsWith("cell:")) return;
    const [, rowId, day] = overId.split(":");
    const intervenantId = rowId === "unassigned" ? "" : rowId;
    if (activeId.startsWith("task:")) {
      const task = taskById.get(activeId.replace(/^task:/, ""));
      if (!task) return;
      await createBlock(task, {
        start_date: day,
        duration_days: mode === "simple" ? clampDurationDays(task.planned_duration_days ?? 1) : 1,
        intervenant_id: intervenantId,
        title_override: getTaskPlanningTitle(task),
      });
      return;
    }
    if (activeId.startsWith("segment:")) {
      const segment = segments.find((item) => item.id === activeId.replace(/^segment:/, ""));
      const task = segment ? taskById.get(segment.task_id) : null;
      if (!segment || !task) return;
      await saveBlock(segment.id, {
        start_date: day,
        duration_days: segment.duration_days,
        intervenant_id: intervenantId,
        title_override: segment.title_override ?? getTaskPlanningTitle(task),
      });
    }
  }

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement planning...</div>;

  const selectedSummary = selectedTask ? taskSummaries.get(selectedTask.id) ?? null : null;

  return (
    <DndContext onDragEnd={(event) => void onDragEnd(event)}>
      <div className="space-y-4">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Planning chantier</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{chantierName ?? "Pilotage planning"}</div>
              <div className="mt-1 text-sm text-slate-500">Outil visuel base sur les taches et leurs blocs planning.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                <button type="button" className={mode === "simple" ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white" : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-600"} onClick={() => setMode("simple")}>Mode simple</button>
                <button type="button" className={mode === "advanced" ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white" : "rounded-full px-3 py-1.5 text-sm font-medium text-slate-600"} onClick={() => setMode("advanced")}>Mode avance</button>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2">
                <button type="button" className={buttonClass()} onClick={() => setWeekAnchor(addDaysToKey(weekAnchor, -7))}><ChevronLeft className="h-4 w-4" /></button>
                <div className="min-w-[10rem] text-center text-sm font-medium text-slate-700">{formatDay(visibleDays[0], locale)} - {formatDay(visibleDays[6], locale)}</div>
                <button type="button" className={buttonClass()} onClick={() => setWeekAnchor(addDaysToKey(weekAnchor, 7))}><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Backlog</div><div className="mt-2 text-2xl font-semibold text-slate-950">{backlogTasks.length}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Blocs</div><div className="mt-2 text-2xl font-semibold text-slate-950">{segments.length}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Charge semaine</div><div className="mt-2 text-2xl font-semibold text-slate-950">{weeklyHours}h</div></div>
            <div className={["rounded-2xl border px-4 py-3", overloadCount + inconsistencyCount > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"].join(" ")}><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Alertes</div><div className={["mt-2 text-2xl font-semibold", overloadCount + inconsistencyCount > 0 ? "text-rose-700" : "text-slate-950"].join(" ")}>{overloadCount + inconsistencyCount}</div></div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Heures par jour / intervenant</span><input type="number" min="1" step="0.5" defaultValue={settings.hoursPerDay} className={inputClass()} onBlur={(event) => void saveSettings({ hoursPerDay: Number(event.target.value) })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Capacite visuelle / jour</span><input type="number" min="1" step="0.25" defaultValue={settings.dayCapacity} className={inputClass()} onBlur={(event) => void saveSettings({ dayCapacity: Number(event.target.value) })} /></label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" defaultChecked={settings.skipWeekends} onChange={(event) => void saveSettings({ skipWeekends: event.target.checked })} />Exclure les week-ends du calcul</label>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-semibold text-slate-900">Taches a planifier</div><div className="text-xs text-slate-500">Glisser une tache sur la semaine pour creer un bloc.</div></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{filteredTasks.length}</span></div>
            <input className={`${inputClass()} mt-4`} value={backlogQuery} onChange={(event) => setBacklogQuery(event.target.value)} placeholder="Rechercher une tache ou un lot" />
            <div className="mt-4 max-h-[70vh] space-y-2 overflow-auto pr-1">
              {filteredTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucune tache avec ce filtre.</div> : filteredTasks.map((task) => {
                const summary = taskSummaries.get(task.id);
                return <BacklogCard key={task.id} task={task} scheduled={(segmentsByTask.get(task.id)?.length ?? 0) > 0} assigneeName={task.intervenant_id ? intervenants.find((it) => it.id === task.intervenant_id)?.nom ?? "" : ""} plannedHours={summary?.plannedTaskHours ?? computePlannedHours(task.planned_duration_days, settings)} onSelect={() => setSelectedTaskId(task.id)} />;
              })}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-sm font-semibold text-slate-900">Vue equipe - semaine</div><div className="text-xs text-slate-500">Colonnes = jours, lignes = intervenants, blocs = etapes de taches.</div></div>
              <div className="flex flex-wrap items-center gap-2">{overloadCount > 0 ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">{overloadCount} surcharge(s)</span> : null}{inconsistencyCount > 0 ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{inconsistencyCount} incoherence(s)</span> : null}</div>
            </div>
            <div className="overflow-x-auto"><div className="min-w-[980px]">
              <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))] overflow-hidden rounded-t-2xl border border-slate-200 border-b-0 bg-slate-50"><div className="border-r border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Intervenants</div>{visibleDays.map((day) => <div key={day} className="border-r border-slate-200 px-3 py-3 text-center text-xs font-medium text-slate-600 last:border-r-0">{formatDay(day, locale)}</div>)}</div>
              <div className="overflow-hidden rounded-b-2xl border border-slate-200 bg-white">
                {rows.map((row) => {
                  const rowBlocks = boardBlocksByRow.get(row.id) ?? [];
                  const rowHeight = Math.max(CELL_HEIGHT, (Math.max(-1, ...rowBlocks.map((block) => block.lane)) + 1) * CELL_HEIGHT);
                  const rowColor = getIntervenantColor(row.id);
                  return <div key={row.id} className="grid grid-cols-[220px_minmax(0,1fr)] border-b border-slate-100 last:border-b-0">
                    <div className="border-r border-slate-200 px-4 py-4"><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: rowColor.solid }} /><div><div className="text-sm font-semibold text-slate-900">{row.label}</div><div className="text-[11px] text-slate-500">{row.intervenantId ? "Couleur intervenant" : "Blocs non affectes"}</div></div></div></div>
                    <div className="relative" style={{ minHeight: rowHeight }}>
                      <div className="grid h-full grid-cols-7">{visibleDays.map((day) => <Cell key={`${row.id}:${day}`} id={`cell:${row.id}:${day}`} label={`${row.label} ${day}`} loadHours={rowLoadByCell.get(`${row.id}:${day}`) ?? 0} overloaded={(rowLoadByCell.get(`${row.id}:${day}`) ?? 0) > settings.hoursPerDay} />)}</div>
                      <div className="pointer-events-none absolute inset-0">{rowBlocks.map((block) => <div key={block.id} className="pointer-events-auto"><Block block={block} count={visibleDays.length} selected={selectedTaskId === block.task.id} onSelect={() => setSelectedTaskId(block.task.id)} /></div>)}</div>
                    </div>
                  </div>;
                })}
              </div></div></div>
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            {!selectedTask ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Selectionne une tache ou un bloc pour piloter son planning, son decoupage et sa coherence temps.</div> : <div className="space-y-4">
              <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-slate-900">{getTaskPlanningTitle(selectedTask)}</div><div className="mt-1 text-xs text-slate-500">{selectedTask.lot ?? selectedTask.corps_etat ?? "Sans lot"}</div></div><button type="button" className={buttonClass()} onClick={() => setSelectedTaskId(null)}>Fermer</button></div>
              {selectedSummary ? <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Avancement</div><div className="mt-2 text-2xl font-semibold text-slate-950">{selectedSummary.progressPercent}%</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Temps</div><div className="mt-2 text-sm font-semibold text-slate-950">{Math.round(selectedSummary.workedHours * 10) / 10}h / {Math.round(selectedSummary.plannedTaskHours * 10) / 10}h</div></div></div> : null}
              {selectedSummary?.inconsistency ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div>Incoherence: la somme des blocs ({Math.round(selectedSummary.scheduledBlockHours * 10) / 10}h) ne correspond pas au temps prevu tache ({Math.round(selectedSummary.plannedTaskHours * 10) / 10}h).</div></div></div> : null}
              <div className="grid gap-2 md:grid-cols-2"><button type="button" className={buttonClass("primary")} disabled={saving} onClick={() => void createBlock(selectedTask, { ...newBlockDraft, duration_days: mode === "simple" ? clampDurationDays(selectedTask.planned_duration_days ?? 1) : newBlockDraft.duration_days, title_override: newBlockDraft.title_override || getTaskPlanningTitle(selectedTask) })}><Plus className="mr-1 inline h-4 w-4" />{mode === "simple" ? "Planifier 1 bloc" : "Ajouter un bloc"}</button><button type="button" className={buttonClass()} disabled={saving} onClick={() => void applySuggestion(selectedTask)}><WandSparkles className="mr-1 inline h-4 w-4" />Generer decoupage</button></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2"><input className={inputClass()} value={newBlockDraft.title_override} onChange={(event) => setNewBlockDraft((current) => ({ ...current, title_override: event.target.value }))} placeholder="Intitule bloc terrain" /><div className="grid gap-2 md:grid-cols-[1fr_7rem_10rem]"><input type="date" className={inputClass()} value={newBlockDraft.start_date} onChange={(event) => setNewBlockDraft((current) => ({ ...current, start_date: event.target.value }))} /><select className={inputClass()} value={String(newBlockDraft.duration_days)} onChange={(event) => setNewBlockDraft((current) => ({ ...current, duration_days: Number(event.target.value) }))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value}j</option>)}</select><select className={inputClass()} value={newBlockDraft.intervenant_id} onChange={(event) => setNewBlockDraft((current) => ({ ...current, intervenant_id: event.target.value }))}><option value="">Non affecte</option>{intervenants.map((intervenant) => <option key={intervenant.id} value={intervenant.id}>{intervenant.nom}</option>)}</select></div></div>
              <div className="space-y-2">{selectedTaskSegments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Cette tache n'a encore aucun bloc planning.</div> : selectedTaskSegments.map((segment) => { const draft = segmentDrafts[segment.id] ?? defaultDraft(selectedTask, segment.start_date); return <div key={segment.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3"><input className={inputClass()} value={draft.title_override} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [segment.id]: { ...draft, title_override: event.target.value } }))} placeholder="Intitule bloc" /><div className="grid gap-2 md:grid-cols-[1fr_7rem_10rem_auto]"><input type="date" className={inputClass()} value={draft.start_date} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [segment.id]: { ...draft, start_date: event.target.value } }))} /><select className={inputClass()} value={String(draft.duration_days)} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [segment.id]: { ...draft, duration_days: Number(event.target.value) } }))}>{DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value}j</option>)}</select><select className={inputClass()} value={draft.intervenant_id} onChange={(event) => setSegmentDrafts((current) => ({ ...current, [segment.id]: { ...draft, intervenant_id: event.target.value } }))}><option value="">Non affecte</option>{intervenants.map((intervenant) => <option key={intervenant.id} value={intervenant.id}>{intervenant.nom}</option>)}</select><div className="flex gap-2"><button type="button" className={buttonClass()} disabled={saving} onClick={() => void saveBlock(segment.id, draft)}>Enregistrer</button><button type="button" className={buttonClass("danger")} disabled={saving} onClick={() => void deleteBlocks([segment.id])}><Trash2 className="h-4 w-4" /></button></div></div></div>; })}</div>
              {selectedTaskSegments.length > 0 ? <button type="button" className={buttonClass("danger")} disabled={saving} onClick={() => void deleteBlocks(selectedTaskSegments.map((segment) => segment.id))}><Trash2 className="mr-1 inline h-4 w-4" />Deplanifier la tache</button> : null}
            </div>}
          </aside>
        </div>
      </div>
    </DndContext>
  );
}
