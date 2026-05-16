import type { CrmAppointmentRow, CrmTaskRow } from "../../../services/crm.service";
import { dateOnly, statusPill } from "../components/crmFormat";

export default function CrmAgendaSection({ tasks, appointments, onTask, onAppointment, onDone }: { tasks: CrmTaskRow[]; appointments: CrmAppointmentRow[]; onTask: () => void; onAppointment: () => void; onDone: (row: CrmTaskRow) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tâches commerciales et rendez-vous</h2>
        <div className="flex gap-2">
          <button onClick={onTask} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">+ Tâche</button>
          <button onClick={onAppointment} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">+ RDV</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-5">
          <div className="font-semibold">Tâches</div>
          <div className="mt-4 space-y-2">
            {tasks.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-slate-50 p-3">
                <div>
                  <div className="font-medium">{row.titre}</div>
                  <div className="text-xs text-slate-500">{row.type} · {dateOnly(row.due_at)}</div>
                </div>
                {row.statut !== "terminee" ? <button onClick={() => onDone(row)} className="rounded-xl border px-3 py-2 text-xs hover:bg-white">Terminer</button> : <span className={statusPill("terminee")}>terminée</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border bg-white p-5">
          <div className="font-semibold">Calendrier</div>
          <div className="mt-4 grid gap-2">
            {appointments.map((row) => (
              <div key={row.id} className="rounded-2xl border bg-slate-50 p-3">
                <div className="font-medium">{row.titre}</div>
                <div className="text-xs text-slate-500">{row.type} · {new Date(row.starts_at).toLocaleString("fr-FR")}</div>
                {row.compte_rendu ? <div className="mt-2 text-sm text-slate-600">{row.compte_rendu}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
