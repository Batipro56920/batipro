import type { AgendaEvent } from "../types";

function EventCard({ event, onSelect }: { event: AgendaEvent; onSelect: (event: AgendaEvent) => void }) {
  return (
    <button type="button" onClick={() => onSelect(event)} className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30">
      <div className="text-sm font-semibold text-slate-950">{event.title}</div>
      <div className="mt-1 text-xs text-slate-500">{event.type} · {event.date ?? "Sans date"} · {event.priority ?? event.status}</div>
    </button>
  );
}

function Section({ title, events, onSelect }: { title: string; events: AgendaEvent[]; onSelect: (event: AgendaEvent) => void }) {
  return (
    <section>
      <div className="mb-2 text-sm font-semibold text-slate-950">{title}</div>
      <div className="space-y-2">
        {events.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Aucune action.</div> : events.slice(0, 5).map((event) => <EventCard key={event.id} event={event} onSelect={onSelect} />)}
      </div>
    </section>
  );
}

export function AgendaActionCenter({ today, overdue, week, relances, onSelect }: { today: AgendaEvent[]; overdue: AgendaEvent[]; week: AgendaEvent[]; relances: AgendaEvent[]; onSelect: (event: AgendaEvent) => void }) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Action center</div>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">Actions commerciales</h3>
      </div>
      <div className="space-y-5">
        <Section title="Aujourd’hui" events={today} onSelect={onSelect} />
        <Section title="En retard" events={overdue} onSelect={onSelect} />
        <Section title="Cette semaine" events={week} onSelect={onSelect} />
        <Section title="Relances à appeler" events={relances} onSelect={onSelect} />
      </div>
    </aside>
  );
}
