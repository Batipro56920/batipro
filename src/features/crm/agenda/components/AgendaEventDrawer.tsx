import { X } from "lucide-react";
import type { AgendaEvent } from "../types";

export function AgendaEventDrawer({ event, onClose, onDone }: { event: AgendaEvent | null; onClose: () => void; onDone: (event: AgendaEvent) => void }) {
  if (!event) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Événement</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{event.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{event.type} · {event.date ?? "Sans date"}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-2 border-b border-slate-200 text-sm font-medium text-slate-600">
            <span className="border-b-2 border-blue-600 px-1 pb-2 text-blue-700">Détail</span>
            <span className="px-1 pb-2">Notes</span>
            <span className="px-1 pb-2">Historique</span>
          </div>
          <section className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            <div>Statut : {event.status}</div>
            <div className="mt-2">Priorité : {event.priority ?? "—"}</div>
            <p className="mt-3 leading-6">{event.description ?? "Aucune note renseignée."}</p>
          </section>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => onDone(event)} disabled={event.source !== "task" || event.status === "terminee"} className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">Terminer</button>
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Report à finaliser">Reporter</button>
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Annulation à finaliser">Annuler</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
