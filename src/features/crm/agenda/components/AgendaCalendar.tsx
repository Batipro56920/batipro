import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import type { AgendaEvent, AgendaView } from "../types";

const tones = {
  rdv: "border-blue-200 bg-blue-50 text-blue-800",
  relance: "border-amber-200 bg-amber-50 text-amber-800",
  task: "border-slate-200 bg-slate-50 text-slate-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  urgent: "border-red-200 bg-red-50 text-red-800",
};

export function AgendaCalendar({ events, onSelect, onCreate }: { events: AgendaEvent[]; onSelect: (event: AgendaEvent) => void; onCreate: () => void }) {
  const [view, setView] = useState<AgendaView>("week");
  const visibleEvents = view === "day" ? events.slice(0, 8) : view === "week" ? events.slice(0, 18) : events.slice(0, 32);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Calendrier</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Vue commerciale</h3>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="mt-4 min-h-[430px] rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        {visibleEvents.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-center">
            <CalendarDays className="h-8 w-8 text-slate-300" />
            <div className="mt-3 font-semibold text-slate-900">Aucun événement</div>
            <div className="mt-1 text-sm text-slate-500">Créez une tâche ou un rendez-vous pour alimenter le calendrier.</div>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleEvents.map((event) => (
              <button key={event.id} type="button" onClick={() => onSelect(event)} className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tones[event.kind]}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">{event.type}</div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold">{event.title}</div>
                <div className="mt-2 text-xs opacity-80">{event.date ?? "Sans date"} · {event.priority ?? event.status}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
