import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { AgendaEvent, AgendaView } from "../types";

const tones = {
  rdv: "border-blue-200 bg-blue-50 text-blue-800",
  relance: "border-amber-200 bg-amber-50 text-amber-800",
  task: "border-slate-200 bg-slate-50 text-slate-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  urgent: "border-red-200 bg-red-50 text-red-800",
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function formatRange(days: string[]) {
  if (!days.length) return "";
  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const start = formatter.format(parseDateKey(days[0]));
  const end = formatter.format(parseDateKey(days[days.length - 1]));
  return `${start} - ${end}`;
}

function formatDay(day: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(parseDateKey(day));
}

function EventPill({ event, onSelect }: { event: AgendaEvent; onSelect: (event: AgendaEvent) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:shadow-sm ${tones[event.kind]}`}
    >
      <div className="truncate font-semibold">{event.title}</div>
      <div className="mt-0.5 truncate opacity-75">{event.type} · {event.priority ?? event.status}</div>
    </button>
  );
}

export function AgendaCalendar({ events, onSelect, onCreate }: { events: AgendaEvent[]; onSelect: (event: AgendaEvent) => void; onCreate: () => void }) {
  const [view, setView] = useState<AgendaView>("week");
  const [anchor, setAnchor] = useState(() => new Date());

  const days = useMemo(() => {
    if (view === "day") return [dateKey(anchor)];
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, index) => dateKey(addDays(start, index)));
    }
    const start = startOfMonthGrid(anchor);
    return Array.from({ length: 35 }, (_, index) => dateKey(addDays(start, index)));
  }, [anchor, view]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const event of events) {
      if (!event.date) continue;
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    for (const list of map.values()) {
      list.sort((left, right) => `${left.date ?? ""}-${left.title}`.localeCompare(`${right.date ?? ""}-${right.title}`));
    }
    return map;
  }, [events]);

  function move(direction: -1 | 1) {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + direction);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    setAnchor(next);
  }

  const currentMonth = anchor.getMonth();

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Calendrier</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Vue commerciale</h3>
          <div className="mt-1 text-sm text-slate-500">{view === "month" ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(anchor) : formatRange(days)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            <button type="button" onClick={() => move(-1)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Période précédente"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setAnchor(new Date())} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Aujourd’hui</button>
            <button type="button" onClick={() => move(1)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Période suivante"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {(["day", "week", "month"] as AgendaView[]).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={["rounded-lg px-2.5 py-1.5 text-xs font-medium transition", view === item ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"].join(" ")}>
                {item === "day" ? "Jour" : item === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onCreate} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50">
            <Plus className="h-4 w-4" />Créer
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
        {events.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center bg-white text-center">
            <CalendarDays className="h-8 w-8 text-slate-300" />
            <div className="mt-3 font-semibold text-slate-900">Aucun événement</div>
            <div className="mt-1 text-sm text-slate-500">Créez une tâche ou un rendez-vous pour alimenter le calendrier.</div>
          </div>
        ) : (
          <div className={view === "day" ? "grid grid-cols-1" : "grid grid-cols-7"}>
            {days.map((day) => {
              const dayEvents = eventsByDay.get(day) ?? [];
              const outsideMonth = view === "month" && parseDateKey(day).getMonth() !== currentMonth;
              return (
                <div key={day} className={["min-h-[150px] border-b border-r border-slate-200 bg-white p-2 last:border-r-0", outsideMonth ? "bg-slate-50/80 text-slate-400" : ""].join(" ")}>
                  <div className="mb-2 text-xs font-semibold capitalize text-slate-600">{formatDay(day)}</div>
                  <div className="space-y-1.5">
                    {dayEvents.slice(0, view === "month" ? 3 : 8).map((event) => <EventPill key={event.id} event={event} onSelect={onSelect} />)}
                    {dayEvents.length > (view === "month" ? 3 : 8) ? <div className="text-xs font-medium text-slate-500">+{dayEvents.length - (view === "month" ? 3 : 8)} autre(s)</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
