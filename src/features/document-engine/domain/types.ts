export type BusinessDocumentKind = "quote" | "invoice" | "credit_note" | "purchase_order" | "reception_report";

export type BusinessDocumentStatus =
  | "draft"
  | "ready"
  | "sent"
  | "viewed"
  | "accepted"
  | "signed"
  | "refused"
  | "expired"
  | "cancelled"
  | "paid"
  | "partially_paid"
  | "overdue";

export type DocumentPartyKind = "company" | "client" | "prospect" | "supplier" | "project" | "chantier";

export type DocumentLineKind =
  | "section"
  | "subsection"
  | "line"
  | "composite"
  | "text"
  | "pagebreak"
  | "signature";

export type DocumentItemKind = "fourniture" | "main_oeuvre" | "sous_traitance" | "materiel" | "divers" | "ouvrage" | "frais";

export type DocumentUnit = "u" | "h" | "ml" | "m2" | "m3" | "forfait" | "kg" | "l";

export type PaymentMethod = "card" | "transfer" | "cash" | "cheque" | "direct_debit";

export type DocumentParty = {
  id?: string | null;
  kind: DocumentPartyKind;
  displayName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  siret?: string | null;
};

export type DocumentAttachment = {
  id: string;
  name: string;
  url?: string | null;
  mimeType?: string | null;
  category?: string | null;
  linkedNodeId?: string | null;
};

export type DocumentSettings = {
  defaultVatRate: number;
  showUnitPrices: boolean;
  showVatColumn: boolean;
  showSectionTotals: boolean;
  showCompositeDetails: boolean;
  showInternalNotes: boolean;
  numberingMode: "automatic" | "manual";
};

export type DocumentTerms = {
  paymentTerms: string;
  legalMentions: string;
  wasteManagement?: string;
  footerNotes?: string;
  depositPercent?: number | null;
  depositAmount?: number | null;
  paymentMethods: PaymentMethod[];
};

export type DocumentBaseNode = {
  id: string;
  type: DocumentLineKind;
  parentId: string | null;
  order: number;
  title: string;
  description?: string;
  internalNotes?: string;
  clientNotes?: string;
  attachments?: DocumentAttachment[];
};

export type DocumentSectionNode = DocumentBaseNode & {
  type: "section" | "subsection";
  children: BusinessDocumentNode[];
  collapsed?: boolean;
};

export type DocumentItemComponent = {
  id: string;
  kind: DocumentItemKind;
  title: string;
  quantity: number;
  unit: DocumentUnit;
  unitPriceHt: number;
  vatRate: number;
  costPriceHt?: number;
};

export type DocumentItemNode = DocumentBaseNode & {
  type: "line" | "composite";
  kind: DocumentItemKind;
  quantity: number;
  unit: DocumentUnit;
  unitPriceHt: number;
  vatRate: number;
  discountRate?: number;
  costPriceHt?: number;
  measuredLength?: number | null;
  measuredWidth?: number | null;
  measuredHeight?: number | null;
  components?: DocumentItemComponent[];
};

export type DocumentTextNode = DocumentBaseNode & {
  type: "text";
  content: string;
};

export type DocumentPageBreakNode = DocumentBaseNode & {
  type: "pagebreak";
};

export type DocumentSignatureNode = DocumentBaseNode & {
  type: "signature";
  signerName?: string | null;
  signedAt?: string | null;
};

export type BusinessDocumentNode =
  | DocumentSectionNode
  | DocumentItemNode
  | DocumentTextNode
  | DocumentPageBreakNode
  | DocumentSignatureNode;

export type DocumentVatBreakdown = {
  rate: number;
  baseHt: number;
  vatAmount: number;
};

export type DocumentTotals = {
  subtotalHt: number;
  discountHt: number;
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  depositAmount: number;
  remainingAmount: number;
  costHt: number;
  marginHt: number;
  marginRate: number;
  vatBreakdown: DocumentVatBreakdown[];
};

export type BusinessDocument = {
  id: string | null;
  kind: BusinessDocumentKind;
  number: string;
  status: BusinessDocumentStatus;
  issueDate: string;
  dueDate?: string | null;
  validityDate?: string | null;
  projectId?: string | null;
  chantierId?: string | null;
  quoteId?: string | null;
  company: DocumentParty;
  recipient: DocumentParty;
  siteAddress?: string | null;
  title: string;
  description?: string;
  currency: "EUR";
  settings: DocumentSettings;
  terms: DocumentTerms;
  nodes: BusinessDocumentNode[];
  attachments: DocumentAttachment[];
  totals?: DocumentTotals;
  createdAt?: string;
  updatedAt?: string;
};

export type FlatDocumentNode = {
  id: string;
  number: string;
  depth: number;
  node: BusinessDocumentNode;
};
