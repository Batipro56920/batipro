import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Boxes, BriefcaseBusiness, Clock3, Euro, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";
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

const visibleKpiKeys = new Set<DashboardKpi["key"]>(["chantiers", "alertes", "avancement", "heures"]);

const toneClasses: Record<DashboardKpi["tone"], string> = {
  normal: "bg-slate-100 text-slate-600",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-orange-50 text-orange-700",
  danger: "bg-red-50 text-red-700",
};

function KpiContent({ kpi }: { kpi: DashboardKpi }) {
  const Icon = icons[kpi.key];

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-500">{kpi.label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{kpi.value}</div>
        </div>
        <span className={`rounded-lg p-2 ${toneClasses[kpi.tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 line-clamp-1 text-xs text-slate-500">{kpi.hint}</div>
    </>
  );
}

export function DashboardKpiGrid({ kpis, activeView, onSelect }: DashboardKpiGridProps) {
  const visibleKpis = kpis.filter((kpi) => visibleKpiKeys.has(kpi.key));

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs principaux">
      {visibleKpis.map((kpi) => {
        const selectableKey = kpi.key === "marge" ? null : kpi.key;
        const active = selectableKey && activeView === selectableKey;
        const className = [
          "min-h-28 rounded-lg border bg-white p-4 text-left shadow-sm transition",
          active
            ? "border-blue-300 ring-2 ring-blue-100"
            : "border-slate-200 hover:border-blue-200 hover:shadow-md",
        ].join(" ");

        if (kpi.href) {
          return <Link key={kpi.key} to={kpi.href} className={className}><KpiContent kpi={kpi} /></Link>;
        }

        return (
          <button
            key={kpi.key}
            type="button"
            disabled={!selectableKey}
            onClick={() => selectableKey && onSelect(active ? null : selectableKey)}
            className={className}
            aria-pressed={Boolean(active)}
          >
            <KpiContent kpi={kpi} />
          </button>
        );
      })}
    </section>
  );
}
