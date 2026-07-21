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
  compositeItems?: QuoteBuilderCompositeItem[];
};

export type QuoteBuilderCompositeItem = {
  id: string;
  kind: QuoteBuilderItemKind;
  title: string;
  quantity: number;
  unit: QuoteBuilderUnit;
  unitPriceHt: number;
  vatRate: number;
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

export type QuoteTravelCostBillingMode = "hidden" | "absorb" | "line";

export type QuoteTravelCostSettings = {
  companyAddress: string;
  siteAddress: string;
  oneWayDistanceKm: number;
  oneWayDurationMinutes: number;
  tollsPerRoundTripHt: number;
  worksiteDays: number | null;
  workersCount: number;
  vehiclesCount: number;
  costPerKm: number;
  vehicleHourlyCost: number;
  vehicleWearCostPerKm: number;
  averageSpeedKmh: number;
  billingMode: QuoteTravelCostBillingMode;
  lineVatRate: number;
};

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
  dailyCleaningFlatRateEnabled?: boolean;
  travelCosts?: QuoteTravelCostSettings;
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
  workStartDate: string | null;
  estimatedDurationValue: number | null;
  estimatedDurationUnit: "jours" | "semaines" | "mois";
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
