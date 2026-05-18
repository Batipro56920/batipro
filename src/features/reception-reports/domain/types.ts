import type { BusinessDocument } from "../../document-engine";

export type ReceptionReportDecision = "without_reserves" | "with_reserves" | "refused";
export type ReceptionReserveStatus = "open" | "lifted";

export type ReceptionReportReserve = {
  id: string;
  description: string;
  lot: string | null;
  responsible: string | null;
  dueDate: string | null;
  status: ReceptionReserveStatus;
  chantierReserveId?: string | null;
};

export type ReceptionReportRecord = {
  id: string;
  chantierId: string;
  status: "draft" | "sent" | "signed" | "refused";
  decision: ReceptionReportDecision;
  receptionDate: string;
  projectReference: string | null;
  observations: string;
  clientSignerName: string | null;
  companySignerName: string | null;
  reserves: ReceptionReportReserve[];
  document: BusinessDocument;
  createdAt: string;
  updatedAt: string;
};
