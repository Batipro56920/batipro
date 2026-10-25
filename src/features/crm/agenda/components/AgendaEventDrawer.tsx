import { useEffect, useState } from "react";
import { FolderOpen, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { AgendaEvent } from "../types";

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AgendaEventDrawer({
  event,
  projectPath,
  busy,
  onClose,
  onDone,
  onReschedule,
  onCancel,
}: {
  event: AgendaEvent | null;
  projectPath?: string | null;
  busy: boolean;
  onClose: () => void;
  onDone: (event: AgendaEvent) => void;
  onReschedule: (event: AgendaEvent, dueAt: string) => void;
  onCancel: (event: AgendaEvent) => void;
}) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [nextDueAt, setNextDueAt] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    setRescheduleOpen(false);
    setNextDueAt(toDateTimeLocal(event?.task?.due_at));
    setDateError(null);
  }, [event]);

  if (!event) return null;

  const taskClosed = event.source === "task" && event.status === "terminee";

  function submitReschedule() {
    if (!nextDueAt) {
      setDateError("Choisissez la nouvelle date de relance.");
      return;
    }
    const nextDate = new Date(nextDueAt);
    if (Number.isNaN(nextDate.getTime()) || nextDate.getTime() <= Date.now()) {
      setDateError("La nouvelle échéance doit être dans le futur.");
      return;
    }
    setDateError(null);
    onReschedule(event, nextDate.toISOString());
  }

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
          {projectPath ? (
            <Link
              to={projectPath}
              onClick={onClose}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <FolderOpen className="h-4 w-4" />
              Ouvrir le projet associé
            </Link>
          ) : null}
          {event.source === "task" && !taskClosed ? (
            <>
              {rescheduleOpen ? (
                <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                  <label className="text-sm font-medium text-slate-800">
                    Nouvelle échéance
                    <input
                      type="datetime-local"
                      value={nextDueAt}
                      onChange={(inputEvent) => {
                        setNextDueAt(inputEvent.target.value);
                        setDateError(null);
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    />
                  </label>
                  {dateError ? <p className="mt-2 text-sm text-red-700">{dateError}</p> : null}
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setRescheduleOpen(false)} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">
                      Fermer
                    </button>
                    <button type="button" onClick={submitReschedule} disabled={busy} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {busy ? "Enregistrement..." : "Confirmer le report"}
                    </button>
                  </div>
                </section>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => onDone(event)} disabled={busy} className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Terminer
                </button>
                <button type="button" onClick={() => setRescheduleOpen((open) => !open)} disabled={busy} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Reporter
                </button>
                <button type="button" onClick={() => onCancel(event)} disabled={busy} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Annuler
                </button>
              </div>
            </>
          ) : event.source === "task" ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Cette tâche est terminée.</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
