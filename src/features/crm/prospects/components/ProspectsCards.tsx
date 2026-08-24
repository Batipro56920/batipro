import type { CrmProspectRow } from "../../../../services/crm.service";
import { CrmWorkflowSteps } from "../../components/CrmWorkflowSteps";
import { buildCrmWorkflowSteps, type CrmWorkflowStepKey } from "../../components/crmWorkflowModel";
import { entityLabel, eur } from "../../components/crmFormat";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectActionHandlers } from "../types";

function workflowForProspect(row: CrmProspectRow) {
  const done: CrmWorkflowStepKey[] = ["prospect"];
  const isQualified = ["qualifie", "devis_en_cours", "negociation", "gagne"].includes(row.statut);
  if (isQualified) done.push("opportunity");
  if (["devis_en_cours", "negociation", "gagne"].includes(row.statut)) done.push("visit", "prequote");
  if (["negociation", "gagne"].includes(row.statut)) done.push("quote");
  return buildCrmWorkflowSteps(isQualified ? "visit" : "opportunity", done);
}

export function ProspectsCards({ rows, actions, onSelect }: { rows: CrmProspectRow[]; actions: ProspectActionHandlers; onSelect: (row: CrmProspectRow) => void }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
          <button type="button" onClick={() => onSelect(row)} className="block w-full text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-ink">{entityLabel(row)}</h3>
                <p className="mt-1 truncate text-xs text-muted">{row.email ?? row.mobile ?? row.telephone ?? "Contact à compléter"}</p>
              </div>
              <ProspectStatusBadge status={row.statut} />
            </div>
            <div className="mt-4 text-sm font-medium text-ink-secondary">{row.type_projet ?? "Projet à qualifier"}</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{row.description_besoin ?? row.notes ?? "Aucune description renseignée."}</p>
            <div className="mt-4 rounded-card border border-subtle bg-interactive p-3 text-sm">
              <div className="text-xs text-muted">Budget estimé</div>
              <div className="mt-1 font-semibold text-ink">{row.budget_estime ? eur(row.budget_estime) : "—"}</div>
            </div>
            <div className="mt-3">
              <CrmWorkflowSteps compact steps={workflowForProspect(row).slice(0, 5)} />
            </div>
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => actions.onTask(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Tâche</button>
            <button type="button" onClick={() => actions.onCreateOpportunity(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Affaire</button>
            <button type="button" onClick={() => actions.onCreateAppointment(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">RDV</button>
            <button type="button" onClick={() => actions.onCreateQuote(row)} className="bt-control rounded-field border border-subtle px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-interactive">Devis</button>
            <button type="button" onClick={() => actions.onConvert(row)} className="bt-control rounded-field border border-success/20 bg-success-soft px-2 py-1 text-xs font-semibold text-success-on hover:bg-interactive">Convertir</button>
          </div>
        </article>
      ))}
    </section>
  );
}
