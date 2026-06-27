import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ChantierDerived, ChantierListActions } from "../types";
import { budgetLabel, shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";

const COLUMNS = [
  { key: "preparation", label: "Préparation" },
  { key: "en_cours", label: "En cours" },
  { key: "blocage", label: "Blocage" },
  { key: "termine", label: "Terminé" },
] as const;

export function ChantiersKanbanView({ rows, onPreview, actions }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void; actions: ChantierListActions }) {
  const blockedRows = rows.filter((row) => row.isLate && row.status !== "TERMINE");
  const blockedIds = new Set(blockedRows.map((row) => row.id));
  const availableRows = rows.filter((row) => !blockedIds.has(row.id));
  const byColumn = {
    preparation: availableRows.filter((row) => row.status === "PREPARATION"),
    en_cours: availableRows.filter((row) => row.status === "EN_COURS" || row.status === "EN_PAUSE"),
    blocage: blockedRows,
    termine: availableRows.filter((row) => row.status === "TERMINE"),
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
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="truncate">{budgetLabel(row.budgetHt)}</span>
                  <span className="shrink-0">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</span>
                </div>
                {column.key === "blocage" ? (
                  <Link
                    to={`/chantiers/${row.id}/qualite`}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Traiter en qualité
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
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
