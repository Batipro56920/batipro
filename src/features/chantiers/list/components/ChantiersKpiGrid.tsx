import { AlertTriangle, BarChart3, CalendarCheck, Euro, Factory, TimerReset } from "lucide-react";
import { currency } from "../utils/chantiersListUtils";

type Metrics = {
  active: number;
  preparation: number;
  late: number;
  alerts: number;
  completedThisMonth: number;
  estimatedMargin: number | null;
};

export function ChantiersKpiGrid({ metrics }: { metrics: Metrics }) {
  const cards = [
    { label: "Chantiers actifs", value: metrics.active, hint: "Préparation, en cours, pause", icon: Factory, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "En préparation", value: metrics.preparation, hint: "À lancer prochainement", icon: CalendarCheck, tone: "text-sky-700 bg-sky-50 border-sky-200" },
    { label: "En retard", value: metrics.late, hint: "Échéance dépassée", icon: TimerReset, tone: "text-red-700 bg-red-50 border-red-200" },
    { label: "Alertes", value: metrics.alerts, hint: "Retards ou temps dépassé", icon: AlertTriangle, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Terminés ce mois", value: metrics.completedThisMonth, hint: "Historique mensuel", icon: BarChart3, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "Marge estimée", value: currency(metrics.estimatedMargin), hint: "Selon budgets renseignés", icon: Euro, tone: "text-slate-700 bg-slate-50 border-slate-200" },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</div>
              <span className={`rounded-xl border p-2 ${card.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{card.value}</div>
            <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
          </div>
        );
      })}
    </section>
  );
}

