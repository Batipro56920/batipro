import type { CrmDataset, CrmOpportunityRow } from "../../../services/crm.service";
import { eur } from "./crmFormat";

const DEFAULT_STAGES = [
  { key: "lead", label: "Lead" },
  { key: "qualification", label: "Qualification" },
  { key: "visite", label: "Visite" },
  { key: "chiffrage", label: "Chiffrage" },
  { key: "devis_envoye", label: "Devis envoyé" },
  { key: "negociation", label: "Négociation" },
  { key: "signature", label: "Signature" },
];

function rowsForStage(rows: CrmOpportunityRow[], key: string) {
  if (key === "devis_envoye") return rows.filter((row) => ["devis_envoye", "devis", "devis_envoyé"].includes(row.stage_key));
  return rows.filter((row) => row.stage_key === key);
}

export function CrmPipelinePreview({ data }: { data: CrmDataset }) {
  const stages = data.stages.length > 0
    ? data.stages
        .filter((stage) => stage.is_active)
        .sort((a, b) => a.ordre - b.ordre)
        .slice(0, 7)
        .map((stage) => ({ key: stage.key, label: stage.label }))
    : DEFAULT_STAGES;

  return (
    <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="mb-3">
        <div className="bt-caption text-primary-on">Pipeline commercial</div>
        <h2 className="bt-card-title mt-1 text-ink">Affaires par étape</h2>
      </div>
      <div className="grid gap-3 overflow-x-auto pb-1 lg:grid-cols-4 xl:grid-cols-7">
        {stages.map((stage) => {
          const rows = rowsForStage(data.opportunities, stage.key);
          const amount = rows.reduce((sum, row) => sum + Number(row.montant_estime ?? 0), 0);
          return (
            <div key={stage.key} className="min-w-56 rounded-card border border-subtle bg-interactive p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{stage.label}</div>
                  <div className="mt-1 text-xs text-muted">{rows.length} affaire(s)</div>
                </div>
                <div className="rounded-full border border-subtle bg-surface px-2 py-1 text-xs font-semibold text-ink-secondary">{eur(amount)}</div>
              </div>
              <div className="mt-3 space-y-2">
                {rows.length === 0 ? (
                  <div className="rounded-field border border-dashed border-subtle bg-surface p-3 text-center text-xs text-muted">
                    <div className="font-medium text-ink-secondary">Vide</div>
                    <div className="mt-0.5">Aucune affaire.</div>
                  </div>
                ) : (
                  rows.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-field border border-subtle bg-surface p-3 shadow-sm">
                      <div className="line-clamp-2 text-sm font-medium text-ink">{row.nom_affaire}</div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                        <span>{eur(row.montant_estime)}</span>
                        <span>{row.probabilite}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
