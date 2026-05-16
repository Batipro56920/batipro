import { CalendarPlus, CheckCircle2, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { CrmEmptyState } from "./CrmEmptyState";

export type CrmActionItem = {
  id: string;
  title: string;
  meta: string;
  description?: string;
  tone: "normal" | "info" | "warning" | "danger";
};

const dotClass = {
  normal: "bg-slate-300",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Action center</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Actions commerciales du jour</h2>
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
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/30">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass[item.tone]}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{item.meta}</div>
                  {item.description ? <div className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</div> : null}
                </div>
                <CheckCircle2 className="h-4 w-4 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
