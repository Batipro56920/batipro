import type {
  CrmAppointmentRow,
  CrmClientRow,
  CrmCommunicationRow,
  CrmDocumentRow,
  CrmOpportunityRow,
  CrmProspectRow,
  CrmQuoteRow,
  CrmSavRow,
  CrmTaskRow,
} from "../../services/crm.service";
import type { ChantierRow } from "../../services/chantiers.service";

export type ProjectStatus =
  | "nouveau"
  | "qualification"
  | "rdv_planifie"
  | "visite_effectuee"
  | "chiffrage"
  | "devis_envoye"
  | "negociation"
  | "accepte"
  | "preparation_chantier"
  | "en_chantier"
  | "cloture"
  | "sav"
  | "perdu";

export type ProjectSourceType = "opportunity" | "prospect";

export type ProjectRecord = {
  id: string;
  sourceType: ProjectSourceType;
  sourceId: string;
  name: string;
  clientName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  salesperson: string | null;
  status: ProjectStatus;
  nextAction: string | null;
  nextActionDate: string | null;
  quoteAmount: number;
  createdAt: string | null;
  desiredDeadline: string | null;
  projectType: string | null;
  sourceLabel: string | null;
  budgetEstimate: number | null;
  needDescription: string | null;
  notes: string | null;
  prospect: CrmProspectRow | null;
  client: CrmClientRow | null;
  opportunity: CrmOpportunityRow | null;
  quotes: CrmQuoteRow[];
  chantiers: ChantierRow[];
  tasks: CrmTaskRow[];
  appointments: CrmAppointmentRow[];
  documents: CrmDocumentRow[];
  communications: CrmCommunicationRow[];
  sav: CrmSavRow[];
};

export type ProjectMetrics = {
  activeProjects: number;
  pendingQuotes: number;
  followUpsDue: number;
  acceptedProjects: number;
  lostProjects: number;
  pipelineAmount: number;
};

export type ProjectFilters = {
  query: string;
  status: "all" | ProjectStatus;
  type: "all" | string;
};
