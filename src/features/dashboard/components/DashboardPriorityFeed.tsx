import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ListChecks } from "lucide-react";
import { EmptyState } from "../../../components/ui/design-system";
import type { DashboardPriorityItem } from "../types";

type DashboardPriorityFeedProps = {
  today: DashboardPriorityItem[];
  week: DashboardPriorityItem[];
  focusRows: DashboardPriorityItem[];
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

function PriorityRow({ item }: { item: DashboardPriorityItem }) {
  return (
    <Link to={item.href} className="group block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDot[item.tone]}`} />
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

function FeedSection({ title, icon: Icon, items }: { title: string; icon: typeof CalendarDays; items: DashboardPriorityItem[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">Aucune priorité à afficher.</div>
        ) : (
          items.map((item) => <PriorityRow key={item.key} item={item} />)
        )}
      </div>
    </section>
  );
}

export function DashboardPriorityFeed({ today, week, focusRows, hasActiveFocus, onClearFocus }: DashboardPriorityFeedProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Priorités</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Priorités du jour</h2>
        </div>
        {hasActiveFocus ? (
          <button type="button" onClick={onClearFocus} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
            Réinitialiser
          </button>
        ) : null}
      </div>

      {hasActiveFocus ? (
        <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ListChecks className="h-4 w-4 text-blue-600" />
            Focus sélectionné
          </div>
          <div className="space-y-2">
            {focusRows.length === 0 ? <EmptyState title="Aucun élément dans ce focus" /> : focusRows.map((item) => <PriorityRow key={item.key} item={item} />)}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <FeedSection title="Aujourd’hui" icon={CalendarDays} items={today} />
        <FeedSection title="Cette semaine" icon={ListChecks} items={week} />
      </div>
    </div>
  );
}
