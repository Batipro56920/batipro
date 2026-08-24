import type { CrmProspectRow } from "../../../../services/crm.service";
import { entityLabel, eur } from "../../components/crmFormat";
import { prospectStatusLabel } from "./prospectStatusFormat";

const stages: CrmProspectRow["statut"][] = ["nouveau", "a_qualifier", "qualifie", "devis_en_cours", "negociation", "gagne", "perdu"];

export function ProspectsKanban({ rows, onSelect }: { rows: CrmProspectRow[]; onSelect: (row: CrmProspectRow) => void }) {
  return (
    <section className="overflow-x-auto rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="grid min-w-[1120px] gap-3 xl:grid-cols-7">
        {stages.map((stage) => {
          const stageRows = rows.filter((row) => row.statut === stage);
          return (
            <div key={stage} className="rounded-card border border-subtle bg-interactive p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-semibold text-ink">{prospectStatusLabel(stage)}</div>
                <div className="rounded-full border border-subtle bg-surface px-2 py-1 text-xs font-semibold text-ink-secondary">{stageRows.length}</div>
              </div>
              <div className="mt-3 space-y-2">
                {stageRows.length === 0 ? (
                  <div className="rounded-field border border-dashed border-subtle bg-surface p-3 text-center text-xs text-muted">Aucun prospect.</div>
                ) : stageRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => onSelect(row)} className="block w-full rounded-field border border-subtle bg-surface p-3 text-left shadow-sm hover:border-primary/30 hover:bg-interactive">
                    <div className="line-clamp-1 text-sm font-medium text-ink">{entityLabel(row)}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-muted">{row.type_projet ?? "Projet à qualifier"}</div>
                    <div className="mt-2 text-xs font-semibold text-ink-secondary">{row.budget_estime ? eur(row.budget_estime) : "Budget non renseigné"}</div>
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
