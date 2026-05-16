import type { CrmProspectRow } from "../../../../services/crm.service";
import type { ProspectActionHandlers } from "../types";

export function useProspectActions(handlers: ProspectActionHandlers) {
  return {
    ...handlers,
    call: (row: CrmProspectRow) => row.mobile || row.telephone,
    email: (row: CrmProspectRow) => row.email,
    createTask: handlers.onTask,
    convert: handlers.onConvert,
    createOpportunity: handlers.onCreateOpportunity,
    createQuote: handlers.onCreateQuote,
    markQuoteInProgress: (row: CrmProspectRow) => handlers.onStatus(row, "devis_en_cours"),
    archive: (row: CrmProspectRow) => handlers.onStatus(row, "archive"),
  };
}
