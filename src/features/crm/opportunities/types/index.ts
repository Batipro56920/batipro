import type { CrmOpportunityRow } from "../../../../services/crm.service";

export type OpportunityTemperature = "all" | "hot" | "warm" | "cold" | "won" | "lost";

export type OpportunityFilters = {
  query: string;
  owner: string;
  source: string;
  budget: string;
  date: string;
  temperature: OpportunityTemperature;
};

export type OpportunityWithParty = CrmOpportunityRow & {
  partyLabel: string;
  partySource: string | null;
};
