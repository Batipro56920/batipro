import type { BusinessDocument, DocumentParty, ElectronicInvoicingMetadata, ElectronicInvoicingTransmissionStatus } from "../../document-engine";

export type ElectronicInvoicingReadiness = {
  canMarkReady: boolean;
  missingFields: string[];
  label: "Données minimales OK" | "À compléter e-facturation";
  badgeClassName: string;
};

const BLOCKED_TRANSMISSION_STATUSES = new Set<ElectronicInvoicingTransmissionStatus>([
  "ready",
  "pending_pdp",
  "transmitted",
]);

export const ELECTRONIC_INVOICING_TRANSMISSION_STATUS_LABELS: Record<ElectronicInvoicingTransmissionStatus, string> = {
  not_ready: "À compléter",
  ready: "Prête PDP",
  pending_pdp: "En attente PDP",
  transmitted: "Transmise",
  rejected: "Rejetée",
};

export function normalizeInvoiceElectronicInvoicing(value?: ElectronicInvoicingMetadata | null, document?: BusinessDocument): ElectronicInvoicingMetadata {
  const buyerIdentifiers = inferPartyIdentifiers(document?.recipient);
  const sellerIdentifiers = inferPartyIdentifiers(document?.company);
  return {
    customerType: value?.customerType ?? "b2b_fr",
    operationType: value?.operationType ?? "works",
    transmissionStatus: value?.transmissionStatus ?? "not_ready",
    buyerSiren: cleanIdentifier(value?.buyerSiren) ?? buyerIdentifiers.siren,
    buyerSiret: cleanIdentifier(value?.buyerSiret) ?? buyerIdentifiers.siret,
    sellerSiren: cleanIdentifier(value?.sellerSiren) ?? sellerIdentifiers.siren,
    sellerSiret: cleanIdentifier(value?.sellerSiret) ?? sellerIdentifiers.siret,
    buyerVatNumber: cleanText(value?.buyerVatNumber),
    sellerVatNumber: cleanText(value?.sellerVatNumber),
    vatExigibility: value?.vatExigibility ?? "payment",
    pdpProvider: cleanText(value?.pdpProvider),
    pdpReference: cleanText(value?.pdpReference),
    lastTransmissionAt: value?.lastTransmissionAt ?? null,
    rejectionReason: cleanText(value?.rejectionReason),
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

export function canUseInvoiceElectronicInvoicingStatus(metadata: ElectronicInvoicingMetadata, status: ElectronicInvoicingTransmissionStatus) {
  if (!BLOCKED_TRANSMISSION_STATUSES.has(status)) return true;
  return getInvoiceElectronicInvoicingReadiness(metadata).canMarkReady;
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
    siren: siret && siret.length >= 9 ? siret.slice(0, 9) : null,
  };
}

function cleanIdentifier(value?: string | null) {
  return cleanText(value)?.replace(/\s/g, "") ?? null;
}

function cleanText(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}
