import type { QuoteStatus } from "./QuoteEnums";
import type { QuoteSettings } from "./QuoteSettings";
import type { QuoteNode } from "./QuoteSection";
import type { QuoteTotals } from "./QuoteTotals";

export type Quote = {
  id: string | null;
  number: string;
  date: string;
  validityDate: string | null;
  workStartDate: string | null;
  estimatedDuration: string | null;
  salespersonId: string | null;
  clientId: string | null;
  prospectId: string | null;
  projectId: string | null;
  clientName: string;
  siteAddress: string;
  description: string;
  paymentTerms: string;
  legalMentions: string;
  wasteManagement: string;
  footerNotes: string;
  status: QuoteStatus;
  settings: QuoteSettings;
  nodes: QuoteNode[];
  totals: QuoteTotals;
};

export type QuoteAccountOption = {
  id: string;
  label: string;
  address: string;
  phone?: string | null;
  email?: string | null;
};

export type QuoteProjectOption = {
  id: string;
  label: string;
  clientName: string;
  address: string;
  clientId?: string | null;
  prospectId?: string | null;
};
