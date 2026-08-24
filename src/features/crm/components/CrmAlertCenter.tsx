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
  normal: "border-subtle bg-interactive text-ink-secondary",
  info: "border-info/20 bg-info-soft text-info-on",
  warning: "border-warning/20 bg-warning-soft text-warning-on",
  danger: "border-danger/20 bg-danger-soft text-danger-on",
};

export function CrmAlertCenter({ items }: { items: CrmAlertItem[] }) {
  const hasAlerts = items.some((item) => item.value > 0);

  return (
    <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="mb-3">
        <div className="bt-caption text-danger-on">Points de vigilance</div>
        <h2 className="bt-card-title mt-1 text-ink">Ce qui demande attention</h2>
      </div>
      {!hasAlerts ? (
        <CrmEmptyState title="Aucun point critique" description="Les relances, devis et SAV sont sous contrôle." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons] ?? AlertTriangle;
            return (
              <Link key={item.key} to={item.href} className="group flex items-center gap-3 rounded-card border border-subtle bg-surface p-3 transition hover:border-primary/30 hover:bg-interactive">
                <span className={`rounded-xl border p-2 ${toneClass[item.tone]}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{item.label}</span>
                    <span className="text-lg font-bold text-ink">{item.value}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{item.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary-on" strokeWidth={1.75} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
