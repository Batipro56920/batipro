import type { ChantierDerived } from "../types";
import { shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierStatusPill } from "./ChantierStatusPill";

export function ChantiersPlanningView({ rows, onPreview }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void }) {
  const sorted = [...rows].sort((a, b) => String(a.date_fin_prevue ?? a.planning_end_date ?? "9999").localeCompare(String(b.date_fin_prevue ?? b.planning_end_date ?? "9999")));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Planning chantiers</h2>
          <p className="text-sm text-slate-500">Vue chronologique des échéances chantier.</p>
        </div>
      </div>
      <div className="space-y-3">
        {sorted.map((row) => (
          <button key={row.id} type="button" onClick={() => onPreview(row)} className="grid w-full gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 md:grid-cols-[140px_minmax(0,1fr)_180px_120px] md:items-center">
            <div className="text-sm font-semibold text-slate-950">{shortDate(row.date_fin_prevue ?? row.planning_end_date)}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">{row.nom}</div>
              <div className="truncate text-sm text-slate-500">{row.client ?? "Client non renseigné"}</div>
            </div>
            <ChantierProgress value={row.progress} />
            <ChantierStatusPill status={row.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

