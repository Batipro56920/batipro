import { Link } from "react-router-dom";
import { CalendarPlus, CheckCircle2, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { CrmEmptyState } from "./CrmEmptyState";

export type CrmActionItem = {
  id: string;
  title: string;
  meta: string;
  description?: string;
  href?: string;
  disabledReason?: string;
  tone: "normal" | "info" | "warning" | "danger";
};

const dotClass = {
  normal: "bg-neutral",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function CrmActionCenter({
  items,
  onTask,
  onAppointment,
}: {
  items: CrmActionItem[];
  onTask: () => void;
  onAppointment: () => void;
}) {
  return (
    <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="bt-caption text-primary-on">Action center</div>
          <h2 className="bt-card-title mt-1 text-ink">Actions commerciales du jour</h2>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onTask}>
            <Plus className="h-4 w-4" />
            Tâche
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onAppointment}>
            <CalendarPlus className="h-4 w-4" />
            RDV
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <CrmEmptyState title="Aucune action urgente" description="Votre suivi commercial est à jour." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const content = (
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass[item.tone]}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{item.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{item.meta}</div>
                  {item.description ? <div className="mt-2 line-clamp-2 text-sm text-ink-secondary">{item.description}</div> : null}
                  {item.disabledReason ? <div className="mt-2 text-xs font-medium text-muted">{item.disabledReason}</div> : null}
                </div>
                <CheckCircle2 className="h-4 w-4 text-muted" strokeWidth={1.75} />
              </div>
            );

            return item.href ? (
              <Link key={item.id} to={item.href} className="block rounded-card border border-subtle bg-surface p-3 transition hover:border-primary/30 hover:bg-interactive">
                {content}
              </Link>
            ) : (
              <div key={item.id} className="rounded-card border border-subtle bg-interactive p-3 opacity-90">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
