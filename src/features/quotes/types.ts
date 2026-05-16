export type QuoteLineKind =
  | "section"
  | "sous_section"
  | "ouvrage"
  | "fourniture"
  | "main_oeuvre"
  | "sous_traitance"
  | "materiel"
  | "divers"
  | "texte"
  | "saut_page";

export type QuoteVatRate = 0 | 5.5 | 10 | 20;

export type QuoteLine = {
  id: string;
  persisted?: boolean;
  parentId: string | null;
  kind: QuoteLineKind;
  designation: string;
  quantity: number;
  unit: string;
  unitPriceHt: number;
  vatRate: QuoteVatRate;
  purchaseCostHt: number;
  order: number;
  reference?: string | null;
};

export type QuoteTotals = {
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  marginHt: number;
  marginRate: number;
  vatBreakdown: Array<{ rate: QuoteVatRate; baseHt: number; vatAmount: number }>;
};

export type QuoteDraft = {
  id: string | null;
  quoteNumber: string;
  status: "draft" | "saved" | "sent" | "signed" | "refused";
  clientId: string | null;
  prospectId: string | null;
  chantierId: string | null;
  clientName: string;
  projectAddress: string;
  projectDescription: string;
  validUntil: string;
  defaultVatRate: QuoteVatRate;
  depositPercent: number;
  paymentTerms: string;
  legalMentions: string;
  wasteManagement: string;
  footerNotes: string;
  lines: QuoteLine[];
};

export type QuoteAccountOption = {
  id: string;
  label: string;
  address: string;
  phone?: string | null;
  email?: string | null;
};

export type QuoteChantierOption = {
  id: string;
  label: string;
  clientName: string;
  address: string;
  clientId?: string | null;
  prospectId?: string | null;
};
