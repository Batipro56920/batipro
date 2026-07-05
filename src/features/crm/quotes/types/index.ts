import type { CrmQuoteRow } from "../../../../services/crm.service";

export type QuoteFilters = {
  query: string;
  status: string;
  signatureStatus: string;
  salesperson: string;
  client: string;
  period: string;
  amount: string;
};

export type QuoteFilterOption = {
  key: string;
  label: string;
};

export type QuoteWithParty = CrmQuoteRow & {
  partyLabel: string;
  projectPath: string;
  quoteEditPath: string;
  chantierPath?: string;
  salespersonKey: string;
  salespersonLabel: string;
};

export type QuoteActionHandlers = {
  onCreate: () => void;
  onStatus: (row: CrmQuoteRow, status: CrmQuoteRow["statut"]) => void;
  onTransform: (row: CrmQuoteRow) => void;
  onPdf: (row: CrmQuoteRow) => void;
};