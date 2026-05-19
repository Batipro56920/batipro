import type { BusinessDocument, BusinessDocumentKind } from "./types";

export type DocumentTemplateConfig = {
  kind: BusinessDocumentKind;
  label: string;
  title: string;
  accentLabel: string;
  recipientLabel: string;
  showPayment: boolean;
  showSignature: boolean;
  signatureLabel: string;
  legalBlockTitle: string;
};

const TEMPLATES: Record<BusinessDocumentKind, DocumentTemplateConfig> = {
  quote: {
    kind: "quote",
    label: "Devis",
    title: "Devis travaux",
    accentLabel: "Offre commerciale",
    recipientLabel: "Client",
    showPayment: true,
    showSignature: true,
    signatureLabel: "Bon pour accord, date et signature du client",
    legalBlockTitle: "Conditions et mentions",
  },
  invoice: {
    kind: "invoice",
    label: "Facture",
    title: "Facture client",
    accentLabel: "Facturation",
    recipientLabel: "Client",
    showPayment: true,
    showSignature: false,
    signatureLabel: "",
    legalBlockTitle: "Conditions de paiement",
  },
  credit_note: {
    kind: "credit_note",
    label: "Avoir",
    title: "Avoir client",
    accentLabel: "Avoir",
    recipientLabel: "Client",
    showPayment: false,
    showSignature: false,
    signatureLabel: "",
    legalBlockTitle: "Mentions",
  },
  purchase_order: {
    kind: "purchase_order",
    label: "Bon de commande",
    title: "Bon de commande fournisseur",
    accentLabel: "Commande",
    recipientLabel: "Fournisseur",
    showPayment: false,
    showSignature: true,
    signatureLabel: "Validation entreprise",
    legalBlockTitle: "Conditions de commande",
  },
  reception_report: {
    kind: "reception_report",
    label: "PV de réception",
    title: "Procès-verbal de réception",
    accentLabel: "Réception chantier",
    recipientLabel: "Client",
    showPayment: false,
    showSignature: true,
    signatureLabel: "Signatures client et entreprise",
    legalBlockTitle: "Observations",
  },
};

export function getDocumentTemplate(document: Pick<BusinessDocument, "kind">) {
  return TEMPLATES[document.kind];
}

