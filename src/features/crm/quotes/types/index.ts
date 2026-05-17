import type { CrmQuoteRow } from "../../../../services/crm.service";

export type QuoteFilters = {
  query: string;
  status: string;
  salesperson: string;
  client: string;
  period: string;
  amount: string;
};

export type QuoteWithParty = CrmQuoteRow & {
  partyLabel: string;
};

export type QuoteActionHandlers = {
  onCreate: () => void;
  onStatus: (row: CrmQuoteRow, status: CrmQuoteRow["statut"]) => void;
  onTransform: (row: CrmQuoteRow) => void;
  onOpen: (row: CrmQuoteRow) => void;
  onPdf: (row: CrmQuoteRow) => void;
};
