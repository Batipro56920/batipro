import type { CrmProspectRow } from "../../../../services/crm.service";
import { entityLabel, eur } from "../../components/crmFormat";
import { prospectStatusLabel } from "./ProspectStatusBadge";

const stages: CrmProspectRow["statut"][] = ["nouveau", "a_qualifier", "qualifie", "devis_en_cours", "negociation", "gagne", "perdu"];

export function ProspectsKanban({ rows, onSelect }: { rows: CrmProspectRow[]; onSelect: (row: CrmProspectRow) => void }) {
  return (
    <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="grid min-w-[1120px] gap-3 xl:grid-cols-7">
        {stages.map((stage) => {
          const stageRows = rows.filter((row) => row.statut === stage);
          return (
            <div key={stage} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold text-slate-950">{prospectStatusLabel(stage)}</div>
                <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">{stageRows.length}</div>
              </div>
              <div className="mt-3 space-y-2">
                {stageRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-center text-xs text-slate-500">Aucun prospect.</div>
                ) : stageRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => onSelect(row)} className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm shadow-slate-950/[0.02] hover:border-blue-200 hover:bg-blue-50/30">
                    <div className="line-clamp-1 text-sm font-medium text-slate-950">{entityLabel(row)}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-slate-500">{row.type_projet ?? "Projet à qualifier"}</div>
                    <div className="mt-2 text-xs font-semibold text-slate-700">{row.budget_estime ? eur(row.budget_estime) : "Budget non renseigné"}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
