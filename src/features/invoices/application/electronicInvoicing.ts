import type { BusinessDocument, DocumentParty, ElectronicInvoicingMetadata, ElectronicInvoicingTransmissionStatus, FacturXExternalValidationStatus, PdpSimulationEvent, PdpSimulationStatus } from "../../document-engine";

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
const MAX_PDP_SIMULATION_EVENTS = 8;

export const ELECTRONIC_INVOICING_TRANSMISSION_STATUS_LABELS: Record<ElectronicInvoicingTransmissionStatus, string> = {
  not_ready: "À compléter",
  ready: INVOICE_ELECTRONIC_INVOICING_STRATEGY.readyBadgeLabel,
  pending_pdp: "En attente PDP",
  transmitted: "Transmise",
  rejected: "Rejetée",
};

export const FACTURX_EXTERNAL_VALIDATION_STATUS_LABELS: Record<FacturXExternalValidationStatus, string> = {
  not_checked: "Validation officielle à faire",
  valid: "Validation officielle OK",
  invalid: "Validation officielle rejetée",
};

export const PDP_SIMULATION_STATUS_LABELS: Record<PdpSimulationStatus, string> = {
  not_queued: "Non simulée",
  queued: "En file simulation PDP",
  simulated: "Simulation PDP OK",
  blocked: "Simulation bloquée",
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
    pdpSimulationStatus: normalizePdpSimulationStatus(value?.pdpSimulationStatus),
    pdpSimulationQueuedAt: value?.pdpSimulationQueuedAt ?? null,
    pdpSimulationLastRunAt: value?.pdpSimulationLastRunAt ?? null,
    pdpSimulationEventLog: normalizePdpSimulationEventLog(value?.pdpSimulationEventLog),
    pdpPreTransmissionValidatedAt: value?.pdpPreTransmissionValidatedAt ?? null,
    pdpPreTransmissionValidationNote: cleanText(value?.pdpPreTransmissionValidationNote),
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
  const hasOfficialFacturXValidation = metadata.facturXExternalValidationStatus === "valid" && Boolean(metadata.facturXExternalValidator);
  const missingFields = [
    ...minimumMissingFields,
    ...requiredField(!metadata.lastFacturXExportAt, "export Factur-X généré"),
    ...requiredField(!hasOfficialFacturXValidation, "validation officielle Factur-X avec validateur renseigné"),
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

export function buildPdpSimulationEvent(status: PdpSimulationStatus, label: string, detail?: string | null): PdpSimulationEvent {
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  return {
    id: randomId ?? `pdp-simulation-${Date.now()}`,
    at: new Date().toISOString(),
    status,
    label,
    detail: cleanText(detail),
  };
}

export function appendPdpSimulationEvent(metadata: ElectronicInvoicingMetadata, event: PdpSimulationEvent): PdpSimulationEvent[] {
  return [...(metadata.pdpSimulationEventLog ?? []), event].slice(-MAX_PDP_SIMULATION_EVENTS);
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

function normalizePdpSimulationStatus(value?: PdpSimulationStatus | null): PdpSimulationStatus {
  return value === "queued" || value === "simulated" || value === "blocked" ? value : "not_queued";
}

function normalizePdpSimulationEventLog(value?: PdpSimulationEvent[] | null): PdpSimulationEvent[] {
  return Array.isArray(value)
    ? value.map(normalizePdpSimulationEvent).filter((event): event is PdpSimulationEvent => Boolean(event)).slice(-MAX_PDP_SIMULATION_EVENTS)
    : [];
}

function normalizePdpSimulationEvent(value: PdpSimulationEvent | null | undefined): PdpSimulationEvent | null {
  if (!value?.id || !value.at || !value.label) return null;
  return {
    id: String(value.id),
    at: String(value.at),
    status: normalizePdpSimulationStatus(value.status),
    label: String(value.label),
    detail: cleanText(value.detail),
  };
}

function requiredField(condition: boolean, label: string) {
  return condition ? [label] : [];
}
