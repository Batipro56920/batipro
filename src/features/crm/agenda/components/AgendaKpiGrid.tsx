import { AlertTriangle, CalendarClock, CalendarDays, CheckSquare, PhoneCall } from "lucide-react";

export function AgendaKpiGrid({ kpis }: { kpis: { tasksToday: number; appointmentsToday: number; relancesDue: number; overdue: number; week: number } }) {
  const items = [
    { label: "Tâches aujourd’hui", value: kpis.tasksToday, icon: CheckSquare, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "RDV aujourd’hui", value: kpis.appointmentsToday, icon: CalendarClock, tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { label: "Relances dues", value: kpis.relancesDue, icon: PhoneCall, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "En retard", value: kpis.overdue, icon: AlertTriangle, tone: "text-red-700 bg-red-50 border-red-200" },
    { label: "Cette semaine", value: kpis.week, icon: CalendarDays, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
            <span className={`inline-flex rounded-lg border p-1.5 ${item.tone}`}><Icon className="h-4 w-4" /></span>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
          </div>
        );
      })}
    </section>
  );
}
