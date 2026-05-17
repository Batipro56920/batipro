import type { ChantierDerived, ChantierListActions } from "../types";
import { currency, shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";

const COLUMNS = [
  { key: "preparation", label: "Préparation" },
  { key: "en_cours", label: "En cours" },
  { key: "blocage", label: "Blocage" },
  { key: "termine", label: "Terminé" },
] as const;

export function ChantiersKanbanView({ rows, onPreview, actions }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void; actions: ChantierListActions }) {
  const byColumn = {
    preparation: rows.filter((row) => row.status === "PREPARATION"),
    en_cours: rows.filter((row) => row.status === "EN_COURS" || row.status === "EN_PAUSE"),
    blocage: rows.filter((row) => row.isLate),
    termine: rows.filter((row) => row.status === "TERMINE"),
  };

  return (
    <section className="grid gap-3 xl:grid-cols-4">
      {COLUMNS.map((column) => (
        <div key={column.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-xl bg-slate-50 py-1">
            <h3 className="font-semibold text-slate-950">{column.label}</h3>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{byColumn[column.key].length}</span>
          </div>
          <div className="space-y-3">
            {byColumn[column.key].length ? byColumn[column.key].map((row) => (
              <article key={`${column.key}-${row.id}`} role="button" tabIndex={0} onClick={() => onPreview(row)} onKeyDown={(event) => event.key === "Enter" && onPreview(row)} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
                <div className="font-semibold text-slate-950">{row.nom}</div>
                <div className="mt-1 text-sm text-slate-500">{row.client ?? "Client non renseigné"}</div>
                <div className="mt-3">
                  <ChantierProgress value={row.progress} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{currency(row.budgetHt)}</span>
                  <span>{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</span>
                </div>
                <div className="mt-3">
                  <ChantierRowActions row={row} actions={actions} />
                </div>
              </article>
            )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Aucun chantier</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

