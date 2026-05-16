import type { CrmProspectRow } from "../../../../services/crm.service";

export type ProspectView = "list" | "kanban" | "cards";

export type ProspectQuickFilter = "all" | "followup" | "hot" | "lost" | "converted";

export type ProspectFilters = {
  status: string;
  source: string;
  owner: string;
  budget: string;
  createdAt: string;
  due: string;
  quick: ProspectQuickFilter;
};

export type ProspectActionHandlers = {
  onCreate: () => void;
  onConvert: (row: CrmProspectRow) => void;
  onStatus: (row: CrmProspectRow, status: CrmProspectRow["statut"]) => void;
  onTask: (row: CrmProspectRow) => void;
  onCreateOpportunity: (row?: CrmProspectRow) => void;
  onCreateQuote: (row?: CrmProspectRow) => void;
};
