import { Clock3 } from "lucide-react";
import type { CrmActionItem } from "./CrmActionCenter";
import { CrmEmptyState } from "./CrmEmptyState";

export function CrmRecentActivity({ items }: { items: CrmActionItem[] }) {
  return (
    <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary-on" strokeWidth={1.75} />
        <div>
          <div className="bt-caption text-primary-on">Activité</div>
          <h2 className="bt-card-title mt-1 text-ink">Activité récente</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <CrmEmptyState title="Aucune activité récente" description="Les nouveaux prospects, devis, RDV et SAV apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-card border border-subtle bg-surface p-3">
              <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
              <div className="mt-0.5 text-xs text-muted">{item.meta}</div>
              {item.description ? <div className="mt-2 line-clamp-2 text-sm text-ink-secondary">{item.description}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
