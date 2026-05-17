export type QuoteBuilderUnit = "u" | "h" | "ml" | "m2" | "m3" | "forfait";

export type QuoteBuilderItemKind = "fourniture" | "main_oeuvre" | "ouvrage" | "sous_traitance" | "materiel" | "divers";

export type QuoteBuilderStatus = "draft" | "saved" | "ready" | "sent" | "accepted" | "refused";

export type QuoteBuilderItem = {
  id: string;
  persistedId?: string | null;
  type: "item";
  kind: QuoteBuilderItemKind;
  title: string;
  description?: string;
  quantity: number;
  unit: QuoteBuilderUnit;
  unitPriceHt: number;
  vatRate: number;
  internalNote?: string;
  clientNote?: string;
  sourceLibraryId?: string | null;
};

export type QuoteBuilderSubsection = {
  id: string;
  persistedId?: string | null;
  type: "subsection";
  title: string;
  collapsed?: boolean;
  children: QuoteBuilderItem[];
};

export type QuoteBuilderSection = {
  id: string;
  persistedId?: string | null;
  type: "section";
  title: string;
  collapsed?: boolean;
  children: Array<QuoteBuilderSubsection | QuoteBuilderItem>;
};

export type QuoteBuilderNode = QuoteBuilderSection | QuoteBuilderSubsection | QuoteBuilderItem;

export type QuoteBuilderSettings = {
  defaultVatRate: number;
  depositPercent: number;
  showVatColumn: boolean;
  showQuantityColumns: boolean;
  hideSectionTotals: boolean;
  showMargins: boolean;
  showDiscounts: boolean;
  showReferences: boolean;
  showTypes: boolean;
  hideCompositeDetails: boolean;
};

export type QuoteBuilderQuote = {
  id: string | null;
  projectId: string;
  clientId: string | null;
  prospectId: string | null;
  opportunityId: string | null;
  number: string;
  status: QuoteBuilderStatus;
  date: string;
  validUntil: string | null;
  clientName: string;
  siteAddress: string;
  description: string;
  paymentTerms: string;
  legalMentions: string;
  footerNotes: string;
  settings: QuoteBuilderSettings;
  nodes: QuoteBuilderSection[];
};

export type QuoteBuilderFlatRow = {
  id: string;
  number: string;
  depth: number;
  parentId: string | null;
  node: QuoteBuilderNode;
  totalHt: number;
  vatAmount: number;
  totalTtc: number;
};

export type QuoteBuilderTotals = {
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  depositTtc: number;
  remainingTtc: number;
  vatBreakdown: Array<{ rate: number; baseHt: number; vat: number }>;
};

export type QuoteLibraryItem = {
  id: string;
  title: string;
  family: string;
  kind: QuoteBuilderItemKind;
  unit: QuoteBuilderUnit;
  unitPriceHt: number;
  vatRate: number;
  description?: string;
};
