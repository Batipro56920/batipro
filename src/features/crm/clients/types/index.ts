import type { CrmClientRow, CrmDataset } from "../../../../services/crm.service";

export type ClientView = "list" | "cards" | "activity";

export type ClientFilters = {
  query: string;
  type: string;
  owner: string;
  status: string;
  chantier: string;
  sav: string;
  date: string;
};

export type ClientMetrics = {
  chantiers: CrmDataset["chantiers"];
  quotes: CrmDataset["quotes"];
  invoices: CrmDataset["invoices"];
  sav: CrmDataset["sav"];
  documents: CrmDataset["documents"];
};

export type ClientWithMetrics = CrmClientRow & {
  label: string;
  activeChantiers: number;
  totalChantiers: number;
  quotesCount: number;
  totalRevenue: number;
  pendingInvoices: number;
  openSav: number;
  documentsCount: number;
};
