export type BusinessDocumentKind = "quote" | "invoice" | "credit_note" | "purchase_order" | "reception_report";

export type BusinessDocumentStatus =
  | "draft"
  | "ready"
  | "sent"
  | "viewed"
  | "accepted"
  | "modification_requested"
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

export type DocumentCondition = {
  id: string;
  label: string;
};

export type DocumentConditionSheet = {
  enabled: boolean;
  title: string;
  signatureText: string;
  conditions: DocumentCondition[];
};

export type ElectronicInvoicingCustomerType = "b2b_fr" | "b2c_fr" | "public_fr" | "foreign";

export type ElectronicInvoicingOperationType = "services" | "goods" | "mixed" | "works";

export type ElectronicInvoicingTransmissionStatus = "not_ready" | "ready" | "pending_pdp" | "transmitted" | "rejected";

export type FacturXExternalValidationStatus = "not_checked" | "valid" | "invalid";

export type PdpConnectionMode = "manual_deposit" | "api_connector" | "chorus_pro";

export type PdpConnectorStatus = "not_configured" | "sandbox" | "production";

export type PdpSimulationStatus = "not_queued" | "queued" | "simulated" | "blocked";

export type PdpSimulationEvent = {
  id: string;
  at: string;
  status: PdpSimulationStatus;
  label: string;
  detail?: string | null;
};

export type ElectronicInvoicingMetadata = {
  customerType: ElectronicInvoicingCustomerType;
  operationType: ElectronicInvoicingOperationType;
  transmissionStatus: ElectronicInvoicingTransmissionStatus;
  buyerSiren?: string | null;
  buyerSiret?: string | null;
  sellerSiren?: string | null;
  sellerSiret?: string | null;
  buyerVatNumber?: string | null;
  sellerVatNumber?: string | null;
  vatExigibility?: "debit" | "payment" | null;
  pdpProvider?: string | null;
  pdpReference?: string | null;
  pdpConnectionMode?: PdpConnectionMode | null;
  pdpConnectorStatus?: PdpConnectorStatus | null;
  lastTransmissionAt?: string | null;
  rejectionReason?: string | null;
  lastFacturXExportAt?: string | null;
  lastFacturXExportFilename?: string | null;
  facturXExportCount?: number | null;
  facturXExternalValidationStatus?: FacturXExternalValidationStatus | null;
  facturXExternalValidationAt?: string | null;
  facturXExternalValidator?: string | null;
  pdpSimulationStatus?: PdpSimulationStatus | null;
  pdpSimulationQueuedAt?: string | null;
  pdpSimulationLastRunAt?: string | null;
  pdpSimulationEventLog?: PdpSimulationEvent[] | null;
  pdpPreTransmissionValidatedAt?: string | null;
  pdpPreTransmissionValidationNote?: string | null;
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
  electronicInvoicing?: ElectronicInvoicingMetadata | null;
  conditionSheet?: DocumentConditionSheet | null;
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