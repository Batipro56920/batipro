import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import type { DashboardBusinessMetric } from "../types";

type DashboardBusinessPanelProps = {
  metrics: DashboardBusinessMetric[];
};

const toneClass = {
  normal: "bg-slate-50 text-slate-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function DashboardBusinessPanel({ metrics }: DashboardBusinessPanelProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Business</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">CRM & rentabilité</h2>
        </div>
        <BriefcaseBusiness className="h-5 w-5 text-slate-300" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => (
          <Link key={metric.key} to={metric.href} className="group rounded-2xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{metric.label}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{metric.hint}</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${toneClass[metric.tone]}`}>{metric.value}</span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-700">
              Ouvrir
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
