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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Pipeline commercial</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Affaires par étape</h2>
      </div>
      <div className="grid gap-3 overflow-x-auto pb-1 lg:grid-cols-4 xl:grid-cols-7">
        {stages.map((stage) => {
          const rows = rowsForStage(data.opportunities, stage.key);
          const amount = rows.reduce((sum, row) => sum + Number(row.montant_estime ?? 0), 0);
          return (
            <div key={stage.key} className="min-w-56 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{stage.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{rows.length} affaire(s)</div>
                </div>
                <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">{eur(amount)}</div>
              </div>
              <div className="mt-3 space-y-2">
                {rows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-center text-xs text-slate-500">
                    <div className="font-medium text-slate-700">Vide</div>
                    <div className="mt-0.5">Aucune affaire.</div>
                  </div>
                ) : (
                  rows.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.02]">
                      <div className="line-clamp-2 text-sm font-medium text-slate-950">{row.nom_affaire}</div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
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
