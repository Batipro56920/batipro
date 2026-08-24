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
  normal: "border-subtle bg-interactive text-ink-secondary",
  info: "border-info/20 bg-info-soft text-info-on",
  success: "border-success/20 bg-success-soft text-success-on",
  warning: "border-warning/20 bg-warning-soft text-warning-on",
  danger: "border-danger/20 bg-danger-soft text-danger-on",
};

const barClasses = {
  normal: "w-1/3 bg-neutral",
  info: "w-1/2 bg-info",
  success: "w-2/3 bg-success",
  warning: "w-2/3 bg-warning",
  danger: "w-full bg-danger",
};

export function CrmKpiGrid({ items }: { items: CrmKpiItem[] }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = icons[item.key] ?? UsersRound;
        return (
          <Link
            key={item.key}
            to={item.href}
            className="group rounded-card border border-subtle bg-surface p-3 shadow-sm transition hover:border-primary/30 hover:bg-interactive"
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-lg border p-1.5 ${toneClasses[item.tone]}`}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="h-1.5 w-10 rounded-full bg-track">
                <span className={`block h-1.5 rounded-full ${barClasses[item.tone]}`} />
              </span>
            </div>
            <div className="bt-card-title mt-3 text-ink">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-ink">{item.label}</div>
            <div className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted">{item.hint}</div>
          </Link>
        );
      })}
    </section>
  );
}
