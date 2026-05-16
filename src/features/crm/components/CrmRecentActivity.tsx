import { Clock3 } from "lucide-react";
import type { CrmActionItem } from "./CrmActionCenter";
import { CrmEmptyState } from "./CrmEmptyState";

export function CrmRecentActivity({ items }: { items: CrmActionItem[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-blue-600" />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Activité</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Activité récente</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <CrmEmptyState title="Aucune activité récente" description="Les nouveaux prospects, devis, RDV et SAV apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{item.meta}</div>
              {item.description ? <div className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
