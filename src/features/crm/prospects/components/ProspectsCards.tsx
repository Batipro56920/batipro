import type { CrmProspectRow } from "../../../../services/crm.service";
import { entityLabel, eur } from "../../components/crmFormat";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectActionHandlers } from "../types";

export function ProspectsCards({ rows, actions, onSelect }: { rows: CrmProspectRow[]; actions: ProspectActionHandlers; onSelect: (row: CrmProspectRow) => void }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
          <button type="button" onClick={() => onSelect(row)} className="block w-full text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-950">{entityLabel(row)}</h3>
                <p className="mt-1 truncate text-xs text-slate-500">{row.email ?? row.mobile ?? row.telephone ?? "Contact à compléter"}</p>
              </div>
              <ProspectStatusBadge status={row.statut} />
            </div>
            <div className="mt-4 text-sm font-medium text-slate-800">{row.type_projet ?? "Projet à qualifier"}</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{row.description_besoin ?? row.notes ?? "Aucune description renseignée."}</p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">Budget estimé</div>
              <div className="mt-1 font-semibold text-slate-950">{row.budget_estime ? eur(row.budget_estime) : "—"}</div>
            </div>
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => actions.onTask(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">Tâche</button>
            <button type="button" onClick={() => actions.onCreateQuote(row)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50">Devis</button>
            <button type="button" onClick={() => actions.onConvert(row)} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">Convertir</button>
          </div>
        </article>
      ))}
    </section>
  );
}
