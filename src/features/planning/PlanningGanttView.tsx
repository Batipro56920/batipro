import { useEffect, useMemo, useRef } from "react";
import type { PlanningEntryRow, PlanningTaskRow } from "./planning.service";
import { diffDays, formatDate, isWeekend, parseDate, startOfWeek } from "./planning.utils";

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
const WEEK_HEADER_HEIGHT = 22;
const DAY_HEADER_HEIGHT = 30;
const WEEKDAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

function weekdayLetter(date: Date) {
  return WEEKDAY_LETTERS[date.getDay()];
}

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

  const todayOffset = diffDays(viewStart, new Date(new Date().toDateString()));
  const showTodayLine = todayOffset >= 0 && todayOffset < viewDays.length;
  const gridTemplateColumns = `repeat(${viewDays.length}, minmax(${dayWidth}px, 1fr))`;
  const minTimelineWidth = viewDays.length * dayWidth;

  const scrollRef = useRef<HTMLDivElement | null>(null);

  function scrollToToday(behavior: ScrollBehavior = "auto") {
    const container = scrollRef.current;
    if (!container || !showTodayLine) return;
    const targetLeft = (todayOffset / viewDays.length) * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior });
  }

  useEffect(() => {
    scrollToToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDays.length]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucune tâche à planifier pour ce chantier.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-end border-b border-slate-100 px-3 py-1.5">
        <button
          type="button"
          onClick={() => scrollToToday("smooth")}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          Aujourd'hui
        </button>
      </div>
      <div className="flex">
        <div className="w-[260px] shrink-0 border-r border-slate-200">
          <div
            className="grid grid-cols-[56px_56px_1fr] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            style={{ height: WEEK_HEADER_HEIGHT + DAY_HEADER_HEIGHT }}
          >
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

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto">
          <div
            className="relative"
            style={{
              minWidth: minTimelineWidth,
              display: "grid",
              gridTemplateColumns,
              gridTemplateRows: `${WEEK_HEADER_HEIGHT}px ${DAY_HEADER_HEIGHT}px repeat(${tasks.length}, ${ROW_HEIGHT}px)`,
              backgroundImage: [
                `repeating-linear-gradient(to right, transparent 0, transparent ${dayWidth - 1}px, #e2e8f0 ${dayWidth - 1}px, #e2e8f0 ${dayWidth}px)`,
                `repeating-linear-gradient(to right, transparent 0px, transparent ${dayWidth * 5}px, #f1f5f9 ${dayWidth * 5}px, #f1f5f9 ${dayWidth * 7}px)`,
              ].join(", "),
            }}
          >
            {showTodayLine ? (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
                style={{ left: `calc(${todayOffset} / ${viewDays.length} * 100% + ${dayWidth / 2}px)` }}
              />
            ) : null}

            {weekGroups.map((group, groupIndex) => {
              const startIndex = weekGroups.slice(0, groupIndex).reduce((sum, g) => sum + g.days.length, 0);
              return (
                <div
                  key={group.label}
                  className="border-b border-r border-slate-200 bg-slate-50 py-2 text-center text-[11px] font-medium text-slate-500"
                  style={{ gridColumn: `${startIndex + 1} / span ${group.days.length}`, gridRow: 1 }}
                >
                  Semaine du {formatShortDate(formatDate(group.days[0]))}
                </div>
              );
            })}

            {viewDays.map((day, index) => (
              <div
                key={`day-${formatDate(day)}`}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 border-b border-r border-slate-200 text-[10px] font-medium",
                  isWeekend(day) ? "bg-slate-100 text-slate-400" : "bg-slate-50 text-slate-500",
                ].join(" ")}
                style={{ gridColumn: index + 1, gridRow: 2 }}
              >
                <span className="uppercase leading-none">{weekdayLetter(day)}</span>
                <span className="text-[11px] font-semibold leading-none text-slate-700">{day.getDate()}</span>
              </div>
            ))}

            {tasks.map((task, taskIndex) => {
              const entry = entryByTask.get(task.id);
              if (!entry) return null;

              const start = parseDate(entry.start_date);
              const end = parseDate(entry.end_date);
              const duration = Math.max(1, diffDays(start, end) + 1);
              const leftDays = diffDays(viewStart, start);
              if (leftDays + duration <= 0 || leftDays >= viewDays.length) return null;

              const colStart = Math.max(1, leftDays + 1);
              const colEnd = Math.min(viewDays.length + 1, leftDays + 1 + duration);
              const isConflict = conflictEntryIds.has(entry.id);
              const isViolated = violatedEntryIds.has(entry.id);
              const isSelected = selectedEntryId === entry.id;

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  title={task.titre}
                  className={[
                    "z-[1] m-1 flex items-center overflow-hidden rounded px-2 text-left text-[11px] font-medium text-white shadow-sm transition",
                    statusBarClass(task.status, isConflict, isViolated),
                    isSelected ? "ring-2 ring-offset-1 ring-slate-900" : "",
                  ].join(" ")}
                  style={{ gridColumn: `${colStart} / ${colEnd}`, gridRow: taskIndex + 3 }}
                >
                  <span className="truncate">{task.titre}</span>
                </button>
              );
            })}
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
