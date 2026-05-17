import { CalendarDays, MapPin } from "lucide-react";
import type { ChantierDerived, ChantierListActions } from "../types";
import { currency, shortDate } from "../utils/chantiersListUtils";
import { ChantierProgress } from "./ChantierProgress";
import { ChantierRowActions } from "./ChantierRowActions";
import { ChantierStatusPill } from "./ChantierStatusPill";

export function ChantiersCardsView({ rows, onPreview, actions }: { rows: ChantierDerived[]; onPreview: (row: ChantierDerived) => void; actions: ChantierListActions }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article key={row.id} role="button" tabIndex={0} onClick={() => onPreview(row)} onKeyDown={(event) => event.key === "Enter" && onPreview(row)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-slate-950">{row.nom}</h3>
              <p className="mt-1 truncate text-sm text-slate-500">{row.client ?? "Client non renseigné"}</p>
            </div>
            <ChantierStatusPill status={row.status} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{row.adresse ?? "Adresse non renseignée"}</span>
          </div>
          <div className="mt-4">
            <ChantierProgress value={row.progress} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <Metric label="Budget" value={currency(row.budgetHt)} />
            <Metric label="Temps" value={`${Number(row.heures_passees ?? 0).toFixed(0)}h`} />
            <Metric label="Échéance" value={shortDate(row.date_fin_prevue ?? row.planning_end_date)} />
          </div>
          {row.isLate ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Échéance dépassée</div>
          ) : null}
          <div className="mt-4">
            <ChantierRowActions row={row} actions={actions} />
          </div>
        </article>
      ))}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-950">
        {label === "Échéance" ? <CalendarDays className="mr-1 inline h-3.5 w-3.5 text-slate-400" /> : null}
        {value}
      </div>
    </div>
  );
}

