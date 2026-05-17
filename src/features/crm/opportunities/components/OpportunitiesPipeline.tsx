import type { CrmDataset, CrmOpportunityRow } from "../../../../services/crm.service";
import { eur } from "../../components/crmFormat";
import type { OpportunityWithParty } from "../types";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityEmptyColumn } from "./OpportunityEmptyColumn";

export function OpportunitiesPipeline({
  stages,
  rows,
  dragOpportunityId,
  setDragOpportunityId,
  onMove,
  onOpen,
}: {
  stages: CrmDataset["stages"];
  rows: OpportunityWithParty[];
  dragOpportunityId: string | null;
  setDragOpportunityId: (value: string | null) => void;
  onMove: (row: CrmOpportunityRow, stage: CrmDataset["stages"][number]) => void;
  onOpen: (row: OpportunityWithParty) => void;
}) {
  const opportunityById = new Map(rows.map((row) => [row.id, row]));
  const orderedStages = [...stages].filter((stage) => stage.is_active).sort((a, b) => a.ordre - b.ordre);

  return (
    <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="grid min-w-[1800px] gap-3 xl:grid-cols-9">
        {orderedStages.map((stage) => {
          const stageRows = rows.filter((row) => row.stage_key === stage.key);
          const amount = stageRows.reduce((sum, row) => sum + Number(row.montant_estime ?? 0), 0);
          const activeDrop = Boolean(dragOpportunityId);

          return (
            <div
              key={stage.id}
              className={["flex min-h-[420px] flex-col rounded-3xl border bg-slate-50/80 transition", activeDrop ? "border-blue-200" : "border-slate-200"].join(" ")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const row = dragOpportunityId ? opportunityById.get(dragOpportunityId) : null;
                if (row) onMove(row, stage);
                setDragOpportunityId(null);
              }}
            >
              <div className="sticky top-0 z-10 rounded-t-3xl border-b border-slate-200 bg-white/95 p-3 backdrop-blur">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{stage.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{stageRows.length} affaire(s)</div>
                  </div>
                  <div className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{eur(amount)}</div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {stageRows.length === 0 ? (
                  <OpportunityEmptyColumn />
                ) : (
                  stageRows.map((row) => (
                    <OpportunityCard
                      key={row.id}
                      row={row}
                      onDragStart={() => setDragOpportunityId(row.id)}
                      onOpen={() => onOpen(row)}
                    />
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
