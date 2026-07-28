import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, CircleDot, Clock, ListChecks, PackageCheck } from "lucide-react";
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
  warning: "bg-amber-500",
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
  normal: "bg-slate-50 text-slate-600",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

function PriorityRow({ item }: { item: DashboardPriorityItem }) {
  return (
    <Link to={item.href} className="group block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/30">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[item.tone]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</div>
            </div>
            <div className="shrink-0 text-xs font-medium text-slate-500">{item.meta}</div>
          </div>
          {item.detail ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{item.detail}</p> : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
      </div>
    </Link>
  );
}

function AlertSummary({ alerts }: { alerts: DashboardAlertCard[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {alerts.slice(0, 4).map((alert) => {
        const Icon = alertIcons[alert.key as keyof typeof alertIcons] ?? CircleDot;
        return (
          <Link key={alert.key} to={alert.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50/40">
            <span className={`rounded-lg p-2 ${alertToneClasses[alert.tone]}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-800">{alert.label}</span>
                <span className="text-base font-semibold text-slate-950">{alert.value}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{alert.description}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function FeedSection({ title, icon: Icon, items }: { title: string; icon: typeof CalendarDays; items: DashboardPriorityItem[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">Aucune priorité à afficher.</div>
        ) : (
          items.map((item) => <PriorityRow key={item.key} item={item} />)
        )}
      </div>
    </section>
  );
}

export function DashboardPriorityFeed({ today, week, focusRows, alerts, hasActiveFocus, onClearFocus }: DashboardPriorityFeedProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.02]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">À traiter</h2>
          <p className="mt-1 text-sm text-slate-500">Priorités chantier, retards et vigilances regroupés au même endroit.</p>
        </div>
        {hasActiveFocus ? (
          <button type="button" onClick={onClearFocus} className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
            Réinitialiser
          </button>
        ) : null}
      </div>

      <AlertSummary alerts={alerts} />

      {hasActiveFocus ? (
        <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ListChecks className="h-4 w-4 text-blue-600" />
            Focus sélectionné
          </div>
          <div className="space-y-2">
            {focusRows.length === 0 ? <EmptyState title="Aucun élément dans ce focus" /> : focusRows.map((item) => <PriorityRow key={item.key} item={item} />)}
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <FeedSection title="Aujourd'hui" icon={CalendarDays} items={today} />
        <FeedSection title="Cette semaine" icon={ListChecks} items={week} />
      </div>
    </div>
  );
}
