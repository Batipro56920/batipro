import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BadgeEuro, Headphones, Percent, Send, UsersRound } from "lucide-react";

export type CrmKpiItem = {
  key: string;
  label: string;
  value: string;
  hint: string;
  href: string;
  tone: "normal" | "info" | "success" | "warning" | "danger";
};

const icons: Record<string, LucideIcon> = {
  prospects: UsersRound,
  quotes: Send,
  revenue: BadgeEuro,
  transform: Percent,
  overdue: AlertTriangle,
  sav: Headphones,
};

const toneClasses = {
  normal: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
};

export function CrmKpiGrid({ items }: { items: CrmKpiItem[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = icons[item.key] ?? UsersRound;
        return (
          <Link
            key={item.key}
            to={item.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-xl border p-2 ${toneClasses[item.tone]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="h-1.5 w-10 rounded-full bg-slate-100">
                <span className={`block h-1.5 rounded-full ${item.tone === "danger" ? "w-full bg-red-500" : item.tone === "warning" ? "w-2/3 bg-amber-500" : "w-1/2 bg-blue-500"}`} />
              </span>
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.hint}</div>
          </Link>
        );
      })}
    </section>
  );
}
