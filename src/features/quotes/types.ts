export type QuoteLineKind =
  | "simple"
  | "section"
  | "subsection"
  | "text"
  | "page_break"
  | "material"
  | "labor"
  | "subcontracting"
  | "equipment"
  | "misc"
  | "composite";

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
  clientName: string;
  projectAddress: string;
  projectDescription: string;
  validUntil: string;
  lines: QuoteLine[];
};
