import { useMemo, useState } from "react";
import type { CrmClientRow, CrmOpportunityRow, CrmProspectRow } from "../../../../services/crm.service";
import { entityLabel } from "../../components/crmFormat";
import type { OpportunityFilters, OpportunityWithParty } from "../types";

const DEFAULT_FILTERS: OpportunityFilters = {
  query: "",
  owner: "all",
  source: "all",
  budget: "all",
  date: "all",
  temperature: "all",
};

function isRecent(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date >= limit;
}

function temperatureMatch(row: CrmOpportunityRow, value: OpportunityFilters["temperature"]) {
  if (value === "all") return true;
  if (value === "won") return row.status === "gagnee" || row.stage_key === "gagne";
  if (value === "lost") return row.status === "perdue" || row.stage_key === "perdu";
  if (value === "hot") return row.probabilite >= 75;
  if (value === "warm") return row.probabilite >= 40 && row.probabilite < 75;
  if (value === "cold") return row.probabilite < 40;
  return true;
}

export function useOpportunityFilters({
  opportunities,
  prospectById,
  clientById,
}: {
  opportunities: CrmOpportunityRow[];
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
}) {
  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);

  const rowsWithParty = useMemo<OpportunityWithParty[]>(() => opportunities.map((row) => {
    const prospect = prospectById.get(row.prospect_id ?? "");
    const client = clientById.get(row.client_id ?? "");
    return {
      ...row,
      partyLabel: entityLabel(client ?? prospect),
      partySource: prospect?.source_acquisition ?? null,
    };
  }), [clientById, opportunities, prospectById]);

  const owners = useMemo(() => Array.from(new Set(opportunities.map((row) => row.responsable_id).filter(Boolean) as string[])).sort(), [opportunities]);
  const sources = useMemo(() => Array.from(new Set(rowsWithParty.map((row) => row.partySource).filter(Boolean) as string[])).sort(), [rowsWithParty]);

  const filteredRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return rowsWithParty.filter((row) => {
      const searchable = [row.nom_affaire, row.partyLabel, row.notes, row.prochaine_action, row.stage_key, row.status].join(" ").toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (filters.owner !== "all" && row.responsable_id !== filters.owner) return false;
      if (filters.source !== "all" && row.partySource !== filters.source) return false;
      if (filters.budget === "small" && row.montant_estime >= 5000) return false;
      if (filters.budget === "medium" && (row.montant_estime < 5000 || row.montant_estime >= 20000)) return false;
      if (filters.budget === "large" && row.montant_estime < 20000) return false;
      if (filters.date === "week" && !isRecent(row.created_at, 7)) return false;
      if (filters.date === "month" && !isRecent(row.created_at, 30)) return false;
      if (!temperatureMatch(row, filters.temperature)) return false;
      return true;
    });
  }, [filters, rowsWithParty]);

  return { filters, setFilters, filteredRows, owners, sources };
}
