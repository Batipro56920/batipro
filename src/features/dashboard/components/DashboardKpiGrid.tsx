import type { ReactNode } from "react";
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
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

function KpiContent({ kpi, children }: { kpi: DashboardKpi; children?: ReactNode }) {
  const Icon = icons[kpi.key];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{kpi.label}</span>
        <span className={`rounded-lg p-2 ${toneClasses[kpi.tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{kpi.value}</div>
      <div className="mt-1 line-clamp-1 text-xs text-slate-500">{kpi.hint}</div>
      {children}
    </>
  );
}

export function DashboardKpiGrid({ kpis, activeView, onSelect }: DashboardKpiGridProps) {
  const visibleKpis = kpis.filter((kpi) => visibleKpiKeys.has(kpi.key));

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {visibleKpis.map((kpi) => {
        const selectableKey = kpi.key === "marge" ? null : kpi.key;
        const active = selectableKey && activeView === selectableKey;
        const cardClassName = [
          "group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-950/[0.02] transition hover:border-blue-200 hover:bg-blue-50/30 disabled:cursor-default",
          active ? "border-blue-300 bg-blue-50/40 ring-1 ring-blue-200" : "",
        ].join(" ");

        if (kpi.href) {
          return (
            <Link key={kpi.key} to={kpi.href} className={cardClassName}>
              <KpiContent kpi={kpi} />
            </Link>
          );
        }

        return (
          <button
            key={kpi.key}
            type="button"
            disabled={!selectableKey}
            onClick={() => selectableKey && onSelect(active ? null : selectableKey)}
            className={cardClassName}
          >
            <KpiContent kpi={kpi} />
          </button>
        );
      })}
    </section>
  );
}
