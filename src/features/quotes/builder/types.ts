export type QuoteBuilderUnit = "u" | "h" | "ml" | "m2" | "m3" | "forfait";

export type QuoteBuilderItemKind = "fourniture" | "main_oeuvre" | "ouvrage" | "sous_traitance" | "materiel" | "divers" | "texte";

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
  /**
   * Modèle de tâche exécuté par l'ouvrier. La désignation reste libre côté client
   * ("réhausse d'un muret") pendant que la tâche liée porte le geste technique
   * ("blocs béton 20x20x50 montés au mortier") et alimente le chantier.
   */
  taskTemplateId?: string | null;
  taskTemplateLabel?: string | null;
  /**
   * Un meme ouvrage peut demander plusieurs gestes de la bibliotheque. La
   * liste complete suit jusqu'au chantier ; taskTemplateId en est la premiere.
   */
  taskTemplateIds?: string[] | null;
  /**
   * D'ou vient le prix de vente. "auto" : il suit le déboursé des tâches liées
   * et se recalcule tout seul. "manual" : quelqu'un l'a décidé, on n'y touche
   * plus jamais. Sans cette distinction, impossible de corriger un prix hérité
   * d'un ancien calcul sans écraser un prix voulu.
   */
  priceSource?: "auto" | "manual";
  /**
   * Ligne comptée dans le devis. Décochée, elle reste dans l'atelier avec son
   * prix et ses tâches, mais sort du document client, des totaux, de la marge
   * et des tâches du chantier : de quoi préparer une option, ou retirer une
   * prestation sans la ressaisir si le client la reprend.
   */
  included?: boolean;
  /**
   * Pièces concernées, reprises du relevé. Elles suivent jusqu'au chantier,
   * où la tâche se retrouve rattachée aux bonnes zones.
   */
  zoneLinks?: Array<{ roomId: string; roomName: string; measure: string; value: number }> | null;
  /** Quantite par tache liee ; null = la tache suit la quantite de la ligne. */
  taskTemplateQuantities?: Array<number | null> | null;
  compositeItems?: QuoteBuilderCompositeItem[];
  /**
   * Ligne sous-traitée : ce que le sous-traitant facture par unité (son devis)
   * et la marge qu'on prend dessus. Le prix de vente en découle tant que
   * personne ne l'a fixé à la main. Sans ces deux chiffres, une prestation
   * sous-traitée n'avait ni déboursé ni marge dans le devis.
   */
  subcontractorUnitCostHt?: number | null;
  subcontractorMarginRate?: number | null;
  subcontractorName?: string | null;
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
  /** Cout horaire charge d'un ouvrier, repris du cout moyen calcule sur la paie. */
  workerHourlyCost: number;
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
