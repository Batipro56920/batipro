import type { CrmClientRow, CrmDataset, CrmOpportunityRow, CrmProspectRow } from "../../../services/crm.service";
import { entityLabel, eur, statusPill } from "../components/crmFormat";

export default function CrmOpportunitiesSection({
  data,
  prospectById,
  clientById,
  dragOpportunityId,
  setDragOpportunityId,
  onMove,
  onCreate,
}: {
  data: CrmDataset;
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  dragOpportunityId: string | null;
  setDragOpportunityId: (value: string | null) => void;
  onMove: (row: CrmOpportunityRow, stage: CrmDataset["stages"][number]) => void;
  onCreate: () => void;
}) {
  const opportunityById = new Map(data.opportunities.map((row) => [row.id, row]));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Pipeline commercial</h2>
        <button onClick={onCreate} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Ajouter opportunité</button>
      </div>
      <div className="grid min-h-[34rem] gap-3 overflow-x-auto xl:grid-cols-9">
        {data.stages.map((stage) => {
          const rows = data.opportunities.filter((row) => row.stage_key === stage.key);
          return (
            <div
              key={stage.id}
              className="min-w-[16rem] rounded-3xl border bg-slate-100 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const row = dragOpportunityId ? opportunityById.get(dragOpportunityId) : null;
                if (row) onMove(row, stage);
                setDragOpportunityId(null);
              }}
            >
              <div className="font-semibold">{stage.label}</div>
              <div className="mt-1 text-xs text-slate-500">{rows.length} · {eur(rows.reduce((sum, row) => sum + row.montant_estime, 0))}</div>
              <div className="mt-3 space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    draggable
                    onDragStart={() => setDragOpportunityId(row.id)}
                    className="cursor-grab rounded-2xl border bg-white p-3 shadow-sm"
                  >
                    <div className="font-medium">{row.nom_affaire}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {entityLabel(clientById.get(row.client_id ?? "") ?? prospectById.get(row.prospect_id ?? ""))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-semibold">{eur(row.montant_estime)}</span>
                      <span className={statusPill(row.probabilite >= 75 ? "gagne" : "ouverte")}>{row.probabilite}%</span>
                    </div>
                    {row.prochaine_action ? <div className="mt-2 text-xs text-slate-500">Action : {row.prochaine_action}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
