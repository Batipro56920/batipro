import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Headphones, ThumbsDown, TimerReset } from "lucide-react";
import { CrmEmptyState } from "./CrmEmptyState";

export type CrmAlertItem = {
  key: string;
  label: string;
  value: number;
  description: string;
  href: string;
  tone: "warning" | "danger" | "info" | "normal";
};

const icons = {
  overdue: TimerReset,
  refused: ThumbsDown,
  sav: Headphones,
  inactive: AlertTriangle,
};

const toneClass = {
  normal: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
};

export function CrmAlertCenter({ items }: { items: CrmAlertItem[] }) {
  const hasAlerts = items.some((item) => item.value > 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-600">Points de vigilance</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Ce qui demande attention</h2>
      </div>
      {!hasAlerts ? (
        <CrmEmptyState title="Aucun point critique" description="Les relances, devis et SAV sont sous contrôle." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons] ?? AlertTriangle;
            return (
              <Link key={item.key} to={item.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                <span className={`rounded-xl border p-2 ${toneClass[item.tone]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-950">{item.label}</span>
                    <span className="text-lg font-bold text-slate-950">{item.value}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
