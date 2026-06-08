import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Users } from "lucide-react";
import type { IntervenantRow } from "../../services/intervenants.service";
import {
  getPlanningCalendarState,
  type PlanningCalendarSegment,
  type PlanningCalendarState,
  type PlanningCalendarTask,
} from "../../services/chantierPlanningCalendar.service";
import {
  distributeDayLoads,
  formatDateKey,
  parseDateKey,
} from "./planningCalendar.utils";
import {
  getSegmentPlanningTitle,
  getTaskPlanningTitle,
  normalizeBlockStatus,
} from "./planningBoard.utils";

type Props = {
  chantierId: string;
  chantierName?: string | null;
  intervenants: IntervenantRow[];
};

type DailyBlock = {
  id: string;
  segment: PlanningCalendarSegment;
  task: PlanningCalendarTask;
  title: string;
  load: number;
  plannedHours: number;
  status: string;
  progress: number;
};

function todayKey() {
  return formatDateKey(new Date());
}

function addDaysToDateKey(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return formatDateKey(date);
}

function formatDayTitle(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(parseDateKey(dateKey));
}

function formatHours(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}h`;
}

function blockStatusLabel(status: string) {
  if (status === "termine") return "Terminé";
  if (status === "en_cours") return "En cours";
  if (status === "annule") return "Annulé";
  if (status === "brouillon") return "Brouillon";
  return "Planifié";
}

function blockStatusClass(status: string) {
  if (status === "termine") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "en_cours") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "annule") return "bg-red-50 text-red-700 border-red-200";
  if (status === "brouillon") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function workerLabel(intervenantId: string, intervenants: IntervenantRow[]) {
  if (intervenantId === "unassigned") return "Sans affectation";
  const intervenant = intervenants.find((item) => item.id === intervenantId);
  if (!intervenant) return "Intervenant inconnu";
  return intervenant.entreprise ? `${intervenant.nom} · ${intervenant.entreprise}` : intervenant.nom;
}

function buildDailyBlocks(state: PlanningCalendarState | null, selectedDate: string): DailyBlock[] {
  if (!state) return [];
  const tasksById = new Map(state.tasks.map((task) => [task.id, task]));
  const blocks: DailyBlock[] = [];

  for (const segment of state.segments) {
    const task = tasksById.get(segment.task_id);
    if (!task) continue;
    const dayLoad = distributeDayLoads(segment.duration_days, segment.start_date, state.settings).find((item) => item.date === selectedDate);
    if (!dayLoad) continue;
    const status = normalizeBlockStatus(segment.status, segment.progress_percent);
    const plannedHours = Math.round(dayLoad.load * state.settings.hoursPerDay * 100) / 100;
    blocks.push({
      id: segment.id,
      segment,
      task,
      title: getSegmentPlanningTitle(segment, task),
      load: dayLoad.load,
      plannedHours,
      status,
      progress: Math.max(0, Math.min(100, Math.round(Number(segment.progress_percent ?? 0) || 0))),
    });
  }

  return blocks.sort((left, right) => {
    const leftWorker = left.segment.intervenant_id ?? "unassigned";
    const rightWorker = right.segment.intervenant_id ?? "unassigned";
    if (leftWorker !== rightWorker) return leftWorker.localeCompare(rightWorker);
    if (left.segment.order_in_day !== right.segment.order_in_day) return left.segment.order_in_day - right.segment.order_in_day;
    return left.title.localeCompare(right.title, "fr", { sensitivity: "base" });
  });
}

function BlockCard({ block }: { block: DailyBlock }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{block.title}</div>
          <div className="mt-1 text-xs text-slate-500">{block.task.lot ?? block.task.corps_etat ?? "Sans lot"}</div>
        </div>
        <span className={["shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold", blockStatusClass(block.status)].join(" ")}>
          {blockStatusLabel(block.status)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{formatHours(block.plannedHours)}</span>
        <span>{block.load < 1 ? `${Math.round(block.load * 100)}% journée` : "Journée"}</span>
        {block.progress > 0 ? <span>{block.progress}% avancé</span> : null}
      </div>
      {block.segment.comment ? <p className="mt-3 text-xs leading-5 text-slate-500">{block.segment.comment}</p> : null}
    </article>
  );
}

export default function DailyChantierPlanning({ chantierId, chantierName, intervenants }: Props) {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [state, setState] = useState<PlanningCalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErrorMsg(null);
    try {
      setState(await getPlanningCalendarState(chantierId));
    } catch (error: any) {
      setErrorMsg(error?.message ?? "Impossible de charger le planning quotidien.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [chantierId]);

  const blocks = useMemo(() => buildDailyBlocks(state, selectedDate), [selectedDate, state]);
  const unplannedTasks = useMemo(() => {
    if (!state) return [];
    const plannedTaskIds = new Set(state.segments.map((segment) => segment.task_id));
    return state.tasks.filter((task) => !plannedTaskIds.has(task.id) && task.status !== "FAIT");
  }, [state]);
  const groups = useMemo(() => {
    const grouped = new Map<string, DailyBlock[]>();
    for (const block of blocks) {
      const key = block.segment.intervenant_id ?? "unassigned";
      const list = grouped.get(key) ?? [];
      list.push(block);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries());
  }, [blocks]);
  const plannedHours = blocks.reduce((sum, block) => sum + block.plannedHours, 0);

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Planning quotidien</div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{formatDayTitle(selectedDate)}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Vue opérationnelle du jour pour {chantierName ?? "ce chantier"} : équipes, blocs planifiés, charge prévue et tâches non encore planifiées.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, -1))} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" /> Jour précédent
            </button>
            <button type="button" onClick={() => setSelectedDate(todayKey())} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <CalendarDays className="h-4 w-4" /> Aujourd'hui
            </button>
            <button type="button" onClick={() => setSelectedDate(addDaysToDateKey(selectedDate, 1))} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Jour suivant <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Actualiser
            </button>
          </div>
        </div>
      </div>

      {errorMsg ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{errorMsg}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Blocs du jour</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{blocks.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Charge prévue</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{formatHours(plannedHours)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Équipes mobilisées</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{groups.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">À planifier</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{unplannedTasks.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement du planning quotidien...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
          <div className="mt-3 font-semibold text-slate-950">Aucun bloc prévu ce jour</div>
          <div className="mt-1 text-sm text-slate-500">Planifiez les blocs dans la vue Gantt pour alimenter le quotidien chantier.</div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {groups.map(([intervenantId, items]) => (
            <section key={intervenantId} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{workerLabel(intervenantId, intervenants)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{items.length} bloc(s) · {formatHours(items.reduce((sum, block) => sum + block.plannedHours, 0))}</div>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((block) => <BlockCard key={block.id} block={block} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {unplannedTasks.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <div className="font-semibold text-amber-900">Tâches chantier non planifiées</div>
              <div className="mt-1 text-sm text-amber-800">Ces tâches existent mais ne sont pas encore placées dans le planning Gantt.</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {unplannedTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm text-amber-950">
                    <div className="font-semibold">{getTaskPlanningTitle(task)}</div>
                    <div className="mt-1 text-xs text-amber-700">{task.lot ?? task.corps_etat ?? "Sans lot"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
