import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, CircleDot, Clock, ListChecks, PackageCheck, X } from "lucide-react";
import { EmptyState } from "../../../components/ui/design-system";
import type { DashboardAlertCard, DashboardPriorityItem } from "../types";

type DashboardPriorityFeedProps = {
  today: DashboardPriorityItem[];
  week: DashboardPriorityItem[];
  focusRows: DashboardPriorityItem[];
  alerts: DashboardAlertCard[];
  hasActiveFocus: boolean;
  onClearFocus: () => void;
};

const toneDot = {
  normal: "bg-slate-300",
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-orange-500",
  danger: "bg-red-500",
};

const alertIcons = {
  urgences: AlertCircle,
  retards: Clock,
  achats: PackageCheck,
  validations: CheckCircle2,
  reserves: CircleDot,
};

const alertToneClasses = {
  normal: "bg-slate-100 text-slate-600",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-orange-50 text-orange-700",
  danger: "bg-red-50 text-red-700",
};

function PriorityRow({ item }: { item: DashboardPriorityItem }) {
  return (
    <Link to={item.href} className="group flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 last:border-0 hover:bg-slate-50/70 sm:px-2">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[item.tone]}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>
          </span>
          <span className="shrink-0 text-xs text-slate-500">{item.meta}</span>
        </span>
        {item.detail ? <span className="mt-1 block line-clamp-1 text-xs text-slate-600">{item.detail}</span> : null}
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
    </Link>
  );
}

function FeedSection({ title, icon: Icon, items }: { title: string; icon: typeof CalendarDays; items: DashboardPriorityItem[] }) {
  return (
    <section className="min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{items.length}</span>
      </h3>
      <div className="mt-2">
        {items.length === 0 ? <p className="py-4 text-sm text-slate-500">Aucune priorité à afficher.</p> : items.slice(0, 4).map((item) => <PriorityRow key={item.key} item={item} />)}
      </div>
    </section>
  );
}

export function DashboardPriorityFeed({ today, week, focusRows, alerts, hasActiveFocus, onClearFocus }: DashboardPriorityFeedProps) {
  const displayedItems = hasActiveFocus ? focusRows : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Activité et priorités</h2>
          <p className="mt-1 text-xs text-slate-500">Les actions qui demandent votre attention.</p>
        </div>
        {hasActiveFocus ? (
          <button type="button" onClick={onClearFocus} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <X className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        ) : null}
      </div>

      {displayedItems ? (
        <div className="p-4 sm:p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ListChecks className="h-4 w-4 text-blue-600" />Focus sélectionné</h3>
          {displayedItems.length === 0 ? <EmptyState title="Aucun élément dans ce focus" /> : displayedItems.map((item) => <PriorityRow key={item.key} item={item} />)}
        </div>
      ) : (
        <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
          <FeedSection title="Aujourd'hui" icon={CalendarDays} items={today} />
          <FeedSection title="Cette semaine" icon={ListChecks} items={week} />
        </div>
      )}

      {alerts.length > 0 ? (
        <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {alerts.slice(0, 4).map((alert) => {
              const Icon = alertIcons[alert.key as keyof typeof alertIcons] ?? CircleDot;
              return (
                <Link key={alert.key} to={alert.href} className="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-white">
                  <span className={`rounded-lg p-1.5 ${alertToneClasses[alert.tone]}`}><Icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{alert.label}</span>
                  <span className="text-sm font-semibold text-slate-950">{alert.value}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
