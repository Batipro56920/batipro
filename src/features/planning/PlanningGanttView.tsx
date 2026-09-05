import { useMemo } from "react";
import type { PlanningEntryRow, PlanningTaskRow } from "./planning.service";
import { diffDays, formatDate, parseDate, startOfWeek } from "./planning.utils";

type Props = {
  tasks: PlanningTaskRow[];
  entries: PlanningEntryRow[];
  viewStart: Date;
  viewDays: Date[];
  dayWidth: number;
  conflictEntryIds: Set<string>;
  violatedEntryIds: Set<string>;
  selectedEntryId: string | null;
  onSelectEntry: (entry: PlanningEntryRow) => void;
  onCreateEntry: (task: PlanningTaskRow) => void;
};

const ROW_HEIGHT = 34;

function statusBarClass(status: string, conflict: boolean, violated: boolean) {
  if (conflict || violated) return "bg-red-500";
  if (status === "FAIT") return "bg-emerald-500";
  if (status === "EN_COURS") return "bg-blue-500";
  return "bg-slate-400";
}

function formatShortDate(value: string) {
  const date = parseDate(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function PlanningGanttView({
  tasks,
  entries,
  viewStart,
  viewDays,
  dayWidth,
  conflictEntryIds,
  violatedEntryIds,
  selectedEntryId,
  onSelectEntry,
  onCreateEntry,
}: Props) {
  const entryByTask = useMemo(() => {
    const map = new Map<string, PlanningEntryRow>();
    for (const entry of entries) map.set(entry.task_id, entry);
    return map;
  }, [entries]);

  const weekGroups = useMemo(() => {
    const groups: { label: string; days: Date[] }[] = [];
    for (const day of viewDays) {
      const weekKey = formatDate(startOfWeek(day));
      const last = groups[groups.length - 1];
      if (last && last.label === weekKey) {
        last.days.push(day);
      } else {
        groups.push({ label: weekKey, days: [day] });
      }
    }
    return groups;
  }, [viewDays]);

  const timelineWidth = viewDays.length * dayWidth;
  const bandWidth = dayWidth * 7;
  const todayOffset = diffDays(viewStart, new Date(new Date().toDateString()));
  const showTodayLine = todayOffset >= 0 && todayOffset < viewDays.length;

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucune tâche à planifier pour ce chantier.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex">
        <div className="w-[260px] shrink-0 border-r border-slate-200">
          <div className="grid grid-cols-[56px_56px_1fr] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Début</span>
            <span>Fin</span>
            <span>Titre</span>
          </div>
          <div>
            {tasks.map((task) => {
              const entry = entryByTask.get(task.id);
              return (
                <div
                  key={task.id}
                  className="grid grid-cols-[56px_56px_1fr] items-center gap-2 border-b border-slate-100 px-3 text-xs"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="text-slate-500">{entry ? formatShortDate(entry.start_date) : "—"}</span>
                  <span className="text-slate-500">{entry ? formatShortDate(entry.end_date) : "—"}</span>
                  <span className="flex min-w-0 items-center justify-between gap-1">
                    <span className="truncate" title={task.titre}>{task.titre}</span>
                    {!entry ? (
                      <button
                        type="button"
                        onClick={() => onCreateEntry(task)}
                        className="shrink-0 rounded-lg border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Planifier
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: timelineWidth }}>
            <div className="flex border-b border-slate-200 bg-white">
              {weekGroups.map((group) => (
                <div
                  key={group.label}
                  className="shrink-0 border-r border-slate-100 py-2 text-center text-[11px] font-medium text-slate-500"
                  style={{ width: group.days.length * dayWidth }}
                >
                  Semaine du {formatShortDate(formatDate(group.days[0]))}
                </div>
              ))}
            </div>

            <div
              className="relative"
              style={{
                backgroundImage: `repeating-linear-gradient(to right, #f8fafc 0, #f8fafc ${bandWidth}px, #ffffff ${bandWidth}px, #ffffff ${bandWidth * 2}px)`,
              }}
            >
              {showTodayLine ? (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
                  style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                />
              ) : null}

              {tasks.map((task) => {
                const entry = entryByTask.get(task.id);
                if (!entry) {
                  return <div key={task.id} style={{ height: ROW_HEIGHT }} />;
                }

                const start = parseDate(entry.start_date);
                const end = parseDate(entry.end_date);
                const duration = Math.max(1, diffDays(start, end) + 1);
                const leftDays = diffDays(viewStart, start);
                const barLeft = leftDays * dayWidth;
                const barWidth = Math.max(dayWidth - 4, duration * dayWidth - 4);
                const isConflict = conflictEntryIds.has(entry.id);
                const isViolated = violatedEntryIds.has(entry.id);
                const isSelected = selectedEntryId === entry.id;

                return (
                  <div key={task.id} className="relative" style={{ height: ROW_HEIGHT }}>
                    {leftDays + duration >= 0 && leftDays <= viewDays.length ? (
                      <button
                        type="button"
                        onClick={() => onSelectEntry(entry)}
                        title={task.titre}
                        className={[
                          "absolute top-1/2 flex h-[18px] -translate-y-1/2 items-center rounded px-2 text-left text-[11px] font-medium text-white shadow-sm transition",
                          statusBarClass(task.status, isConflict, isViolated),
                          isSelected ? "ring-2 ring-offset-1 ring-slate-900" : "",
                        ].join(" ")}
                        style={{ left: barLeft + 2, width: barWidth }}
                      >
                        <span className="truncate">{task.titre}</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> À faire</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> En cours</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Fait</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Conflit / dépendance</span>
      </div>
    </div>
  );
}
