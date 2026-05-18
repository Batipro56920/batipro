import type { BusinessDocument, BusinessDocumentKind, DocumentSettings, DocumentTerms } from "./types";

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  defaultVatRate: 20,
  showUnitPrices: true,
  showVatColumn: true,
  showSectionTotals: true,
  showCompositeDetails: false,
  showInternalNotes: false,
  numberingMode: "automatic",
};

export const DEFAULT_DOCUMENT_TERMS: DocumentTerms = {
  paymentTerms: "Acompte a la signature, solde selon avancement et reception.",
  legalMentions: "Document soumis aux conditions generales de l'entreprise.",
  wasteManagement: "Gestion des dechets selon les modalites prevues au document.",
  footerNotes: "",
  depositPercent: 30,
  depositAmount: null,
  paymentMethods: ["transfer"],
};

export function createEmptyBusinessDocument(kind: BusinessDocumentKind): BusinessDocument {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: null,
    kind,
    number: createTemporaryNumber(kind),
    status: "draft",
    issueDate: today,
    company: { kind: "company", displayName: "Batipro" },
    recipient: { kind: kind === "purchase_order" ? "supplier" : "client", displayName: "" },
    title: documentKindLabel(kind),
    currency: "EUR",
    settings: DEFAULT_DOCUMENT_SETTINGS,
    terms: DEFAULT_DOCUMENT_TERMS,
    nodes: [],
    attachments: [],
  };
}

export function documentKindLabel(kind: BusinessDocumentKind) {
  if (kind === "quote") return "Devis";
  if (kind === "invoice") return "Facture";
  if (kind === "credit_note") return "Avoir";
  if (kind === "purchase_order") return "Bon de commande";
  return "PV de reception";
}

function createTemporaryNumber(kind: BusinessDocumentKind) {
  const prefix = kind === "quote" ? "DEV" : kind === "invoice" ? "FAC" : kind === "credit_note" ? "AV" : kind === "purchase_order" ? "BC" : "PV";
  return `${prefix}-${new Date().getFullYear()}-BROUILLON`;
}
