import type { CrmDataset, CrmSavRow } from "../../../../services/crm.service";

export type SavView = "list" | "kanban" | "planning";

export type SavFilters = {
  query: string;
  client: string;
  chantier: string;
  priority: string;
  status: string;
  assignee: string;
  date: string;
};

export type SavWithContext = CrmSavRow & {
  clientLabel: string;
  chantierLabel: string;
};

export type SavContext = {
  clients: Map<string, CrmDataset["clients"][number]>;
  chantiers: CrmDataset["chantiers"];
};
