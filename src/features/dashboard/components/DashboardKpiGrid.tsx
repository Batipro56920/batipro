import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Boxes, BriefcaseBusiness, Clock3, Euro, TimerReset } from "lucide-react";
import type { DashboardKpi, DashboardView } from "../types";

type DashboardKpiGridProps = {
  kpis: DashboardKpi[];
  activeView: DashboardView;
  onSelect: (view: DashboardView) => void;
};

const icons: Record<DashboardKpi["key"], LucideIcon> = {
  chantiers: BriefcaseBusiness,
  avancement: TimerReset,
  heures: Clock3,
  materiel: Boxes,
  alertes: AlertTriangle,
  marge: Euro,
};

const toneClasses: Record<DashboardKpi["tone"], string> = {
  normal: "border-slate-200 bg-white text-slate-700",
  info: "border-blue-200 bg-blue-50/50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50/60 text-amber-700",
  danger: "border-red-200 bg-red-50/60 text-red-700",
};

export function DashboardKpiGrid({ kpis, activeView, onSelect }: DashboardKpiGridProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = icons[kpi.key];
        const selectableKey = kpi.key === "marge" ? null : kpi.key;
        const active = selectableKey && activeView === selectableKey;

        return (
          <button
            key={kpi.key}
            type="button"
            disabled={!selectableKey}
            onClick={() => selectableKey && onSelect(active ? null : selectableKey)}
            className={[
              "group rounded-2xl border bg-white p-4 text-left shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0",
              active ? "ring-2 ring-blue-500" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-xl border p-2 ${toneClasses[kpi.tone]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="h-1.5 w-10 rounded-full bg-slate-100">
                <span className={`block h-1.5 rounded-full ${kpi.tone === "danger" ? "w-full bg-red-500" : kpi.tone === "warning" ? "w-2/3 bg-amber-500" : "w-1/2 bg-blue-500"}`} />
              </span>
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{kpi.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{kpi.label}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{kpi.hint}</div>
          </button>
        );
      })}
    </section>
  );
}
