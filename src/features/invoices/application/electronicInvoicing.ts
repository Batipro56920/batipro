import type { BusinessDocument, DocumentParty, ElectronicInvoicingMetadata, ElectronicInvoicingTransmissionStatus, FacturXExternalValidationStatus } from "../../document-engine";

export type ElectronicInvoicingReadiness = {
  canMarkReady: boolean;
  missingFields: string[];
  label: "Données minimales OK" | "À compléter e-facturation";
  badgeClassName: string;
};

export type PdpTransmissionReadiness = {
  canTransmit: boolean;
  missingFields: string[];
  label: "Transmission PDP possible" | "Transmission PDP bloquée";
  badgeClassName: string;
};

export type InvoiceElectronicInvoicingStrategy = {
  mode: "facturx_export_first";
  label: string;
  shortLabel: string;
  description: string;
  readyActionLabel: string;
  readyBadgeLabel: string;
  nextStepLabel: string;
};

export const INVOICE_ELECTRONIC_INVOICING_STRATEGY: InvoiceElectronicInvoicingStrategy = {
  mode: "facturx_export_first",
  label: "Export Factur-X d'abord",
  shortLabel: "Factur-X first",
  description: "Batipro prépare les factures au format exportable Factur-X avant transmission via la PDP choisie. Le connecteur PDP direct reste un lot séparé.",
  readyActionLabel: "Marquer prête Factur-X",
  readyBadgeLabel: "Prête Factur-X",
  nextStepLabel: "Prochain lot : générer le fichier Factur-X conforme.",
};

const READY_TRANSMISSION_STATUSES = new Set<ElectronicInvoicingTransmissionStatus>(["ready"]);
const PDP_TRANSMISSION_STATUSES = new Set<ElectronicInvoicingTransmissionStatus>(["pending_pdp", "transmitted"]);

export const ELECTRONIC_INVOICING_TRANSMISSION_STATUS_LABELS: Record<ElectronicInvoicingTransmissionStatus, string> = {
  not_ready: "À compléter",
  ready: INVOICE_ELECTRONIC_INVOICING_STRATEGY.readyBadgeLabel,
  pending_pdp: "En attente PDP",
  transmitted: "Transmise",
  rejected: "Rejetée",
};

export const FACTURX_EXTERNAL_VALIDATION_STATUS_LABELS: Record<FacturXExternalValidationStatus, string> = {
  not_checked: "Validation externe à faire",
  valid: "Validation externe OK",
  invalid: "Validation externe rejetée",
};

export function normalizeInvoiceElectronicInvoicing(value?: ElectronicInvoicingMetadata | null, document?: BusinessDocument): ElectronicInvoicingMetadata {
  const buyerIdentifiers = inferPartyIdentifiers(document?.recipient);
  const sellerIdentifiers = inferPartyIdentifiers(document?.company);
  const buyerSiret = cleanIdentifier(value?.buyerSiret) ?? buyerIdentifiers.siret;
  const sellerSiret = cleanIdentifier(value?.sellerSiret) ?? sellerIdentifiers.siret;
  return {
    customerType: value?.customerType ?? "b2b_fr",
    operationType: value?.operationType ?? "works",
    transmissionStatus: value?.transmissionStatus ?? "not_ready",
    buyerSiren: cleanIdentifier(value?.buyerSiren) ?? sirenFromSiret(buyerSiret) ?? buyerIdentifiers.siren,
    buyerSiret,
    sellerSiren: cleanIdentifier(value?.sellerSiren) ?? sirenFromSiret(sellerSiret) ?? sellerIdentifiers.siren,
    sellerSiret,
    buyerVatNumber: cleanText(value?.buyerVatNumber),
    sellerVatNumber: cleanText(value?.sellerVatNumber),
    vatExigibility: value?.vatExigibility ?? "payment",
    pdpProvider: cleanText(value?.pdpProvider),
    pdpReference: cleanText(value?.pdpReference),
    lastTransmissionAt: value?.lastTransmissionAt ?? null,
    rejectionReason: cleanText(value?.rejectionReason),
    lastFacturXExportAt: value?.lastFacturXExportAt ?? null,
    lastFacturXExportFilename: cleanText(value?.lastFacturXExportFilename),
    facturXExportCount: normalizeExportCount(value?.facturXExportCount),
    facturXExternalValidationStatus: normalizeFacturXExternalValidationStatus(value?.facturXExternalValidationStatus),
    facturXExternalValidationAt: value?.facturXExternalValidationAt ?? null,
    facturXExternalValidator: cleanText(value?.facturXExternalValidator),
  };
}

export function getInvoiceElectronicInvoicingMissingFields(metadata: ElectronicInvoicingMetadata) {
  const missing: string[] = [];
  if (!metadata.sellerSiren && !metadata.sellerSiret) missing.push("SIREN ou SIRET entreprise");
  if ((metadata.customerType === "b2b_fr" || metadata.customerType === "public_fr") && !metadata.buyerSiren && !metadata.buyerSiret) missing.push("SIREN ou SIRET client");
  if (!metadata.operationType) missing.push("type d'opération");
  if (!metadata.vatExigibility) missing.push("exigibilité TVA");
  return missing;
}

export function getInvoiceElectronicInvoicingReadiness(metadata: ElectronicInvoicingMetadata): ElectronicInvoicingReadiness {
  const missingFields = getInvoiceElectronicInvoicingMissingFields(metadata);
  const canMarkReady = missingFields.length === 0;
  return {
    canMarkReady,
    missingFields,
    label: canMarkReady ? "Données minimales OK" : "À compléter e-facturation",
    badgeClassName: canMarkReady
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-amber-200 bg-amber-50 text-amber-900",
  };
}

export function getInvoicePdpTransmissionReadiness(metadata: ElectronicInvoicingMetadata): PdpTransmissionReadiness {
  const minimumMissingFields = getInvoiceElectronicInvoicingMissingFields(metadata);
  const missingFields = [
    ...minimumMissingFields,
    ...requiredField(!metadata.lastFacturXExportAt, "export Factur-X généré"),
    ...requiredField(metadata.facturXExternalValidationStatus !== "valid", "validation externe Factur-X OK"),
    ...requiredField(!metadata.pdpProvider, "PDP choisie"),
  ];
  const canTransmit = missingFields.length === 0;
  return {
    canTransmit,
    missingFields,
    label: canTransmit ? "Transmission PDP possible" : "Transmission PDP bloquée",
    badgeClassName: canTransmit
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800",
  };
}

export function canUseInvoiceElectronicInvoicingStatus(metadata: ElectronicInvoicingMetadata, status: ElectronicInvoicingTransmissionStatus) {
  if (READY_TRANSMISSION_STATUSES.has(status)) return getInvoiceElectronicInvoicingReadiness(metadata).canMarkReady;
  if (PDP_TRANSMISSION_STATUSES.has(status)) return getInvoicePdpTransmissionReadiness(metadata).canTransmit;
  return true;
}

export function normalizeInvoiceElectronicInvoicingPatch(
  current: ElectronicInvoicingMetadata,
  patch: Partial<ElectronicInvoicingMetadata>,
  document?: BusinessDocument,
): ElectronicInvoicingMetadata {
  const next = normalizeInvoiceElectronicInvoicing({ ...current, ...patch }, document);
  if (!canUseInvoiceElectronicInvoicingStatus(next, next.transmissionStatus)) {
    return { ...next, transmissionStatus: "not_ready" };
  }
  return next;
}

export function cleanInvoiceElectronicInvoicingIdentifier(value?: string | null) {
  return cleanIdentifier(value);
}

export function cleanInvoiceElectronicInvoicingText(value?: string | null) {
  return cleanText(value);
}

function inferPartyIdentifiers(party?: DocumentParty | null) {
  const siret = cleanIdentifier(party?.siret);
  return {
    siret,
    siren: sirenFromSiret(siret),
  };
}

function sirenFromSiret(value?: string | null) {
  return value && value.length >= 9 ? value.slice(0, 9) : null;
}

function cleanIdentifier(value?: string | null) {
  return cleanText(value)?.replace(/\s/g, "") ?? null;
}

function cleanText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeExportCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeFacturXExternalValidationStatus(value?: FacturXExternalValidationStatus | null): FacturXExternalValidationStatus {
  return value === "valid" || value === "invalid" ? value : "not_checked";
}

function requiredField(condition: boolean, label: string) {
  return condition ? [label] : [];
}
