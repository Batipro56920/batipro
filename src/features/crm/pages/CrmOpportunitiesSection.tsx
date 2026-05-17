import { useState } from "react";
import type { CrmClientRow, CrmDataset, CrmOpportunityRow, CrmProspectRow } from "../../../services/crm.service";
import { OpportunitiesHeader } from "../opportunities/components/OpportunitiesHeader";
import { OpportunitiesKpiGrid } from "../opportunities/components/OpportunitiesKpiGrid";
import { OpportunitiesPipeline } from "../opportunities/components/OpportunitiesPipeline";
import { OpportunitiesToolbar } from "../opportunities/components/OpportunitiesToolbar";
import { OpportunityDetailDrawer } from "../opportunities/components/OpportunityDetailDrawer";
import { useOpportunityFilters } from "../opportunities/hooks/useOpportunityFilters";
import type { OpportunityWithParty } from "../opportunities/types";

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
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityWithParty | null>(null);
  const { filters, setFilters, filteredRows, owners, sources } = useOpportunityFilters({
    opportunities: data.opportunities,
    prospectById,
    clientById,
  });

  return (
    <div className="space-y-5">
      <OpportunitiesHeader onCreate={onCreate} />
      <OpportunitiesKpiGrid rows={data.opportunities} />
      <OpportunitiesToolbar filters={filters} setFilters={setFilters} owners={owners} sources={sources} />
      <OpportunitiesPipeline
        stages={data.stages}
        rows={filteredRows}
        dragOpportunityId={dragOpportunityId}
        setDragOpportunityId={setDragOpportunityId}
        onMove={onMove}
        onOpen={setSelectedOpportunity}
      />
      <OpportunityDetailDrawer row={selectedOpportunity} onClose={() => setSelectedOpportunity(null)} />
    </div>
  );
}
