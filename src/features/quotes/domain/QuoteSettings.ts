import type { QuoteVatRate } from "./QuoteEnums";

export type QuoteSettings = {
  defaultVatRate: QuoteVatRate;
  defaultDepositPercent: number;
  showMargins: boolean;
  showReferences: boolean;
  showVatColumn: boolean;
  showQuantityColumns: boolean;
  hideCompositeDetails: boolean;
  showVatCertificate: boolean;
  showWasteManagement: boolean;
  customNumbering: boolean;
};

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  defaultVatRate: 20,
  defaultDepositPercent: 30,
  showMargins: true,
  showReferences: false,
  showVatColumn: true,
  showQuantityColumns: true,
  hideCompositeDetails: false,
  showVatCertificate: false,
  showWasteManagement: true,
  customNumbering: false,
};

export type CompanyQuoteSettings = {
  defaultVatRate: QuoteVatRate;
  defaultDepositPercent: number;
  acceptedPaymentMethods: string[];
  defaultPaymentTerms: string;
  defaultLegalMentions: string;
  defaultWasteManagement: string;
  defaultFooterNotes: string;
  quoteNumberPrefix: string;
  quoteNumberNext: number;
  quoteNumberPadding: number;
  defaultValidityDays: number;
  defaultWorkStartDelayDays: number;
  defaultEstimatedDuration: string | null;
  defaultSalespersonId: string | null;
  defaultShowMargins: boolean;
  defaultShowReferences: boolean;
  defaultShowVatColumn: boolean;
  defaultShowQuantityColumns: boolean;
  defaultHideCompositeDetails: boolean;
  defaultShowVatCertificate: boolean;
  defaultShowWasteManagement: boolean;
  defaultCustomNumbering: boolean;
  cgv: string | null;
};

export const DEFAULT_COMPANY_QUOTE_SETTINGS: CompanyQuoteSettings = {
  defaultVatRate: 20,
  defaultDepositPercent: 30,
  acceptedPaymentMethods: ["virement"],
  defaultPaymentTerms: "30% a la signature, solde selon avancement et reception des travaux.",
  defaultLegalMentions: "Devis valable selon la date indiquee. Travaux soumis aux conditions generales de l'entreprise.",
  defaultWasteManagement: "Gestion des dechets selon la reglementation applicable.",
  defaultFooterNotes: "",
  quoteNumberPrefix: "DEV",
  quoteNumberNext: 1,
  quoteNumberPadding: 4,
  defaultValidityDays: 30,
  defaultWorkStartDelayDays: 0,
  defaultEstimatedDuration: null,
  defaultSalespersonId: null,
  defaultShowMargins: true,
  defaultShowReferences: false,
  defaultShowVatColumn: true,
  defaultShowQuantityColumns: true,
  defaultHideCompositeDetails: false,
  defaultShowVatCertificate: false,
  defaultShowWasteManagement: true,
  defaultCustomNumbering: false,
  cgv: null,
};
