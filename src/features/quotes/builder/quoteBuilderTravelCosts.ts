import type { QuoteBuilderQuote, QuoteTravelCostSettings } from "./types";

export const DEFAULT_QUOTE_TRAVEL_COST_SETTINGS: QuoteTravelCostSettings = {
  companyAddress: "",
  siteAddress: "",
  oneWayDistanceKm: 0,
  oneWayDurationMinutes: 0,
  tollsPerRoundTripHt: 0,
  worksiteDays: null,
  workersCount: 1,
  vehiclesCount: 1,
  costPerKm: 0.35,
  vehicleHourlyCost: 0,
  vehicleWearCostPerKm: 0,
  averageSpeedKmh: 50,
  billingMode: "hidden",
  lineVatRate: 20,
};

export type QuoteTravelCostSummary = {
  worksiteDays: number;
  oneWayDistanceKm: number;
  roundTripDistanceKm: number;
  oneWayDurationMinutes: number;
  totalKm: number;
  travelHours: number;
  fuelCostHt: number;
  travelTimeCostHt: number;
  vehicleWearCostHt: number;
  tollsCostHt: number;
  totalCostHt: number;
};

export function normalizeQuoteTravelCostSettings(
  value: unknown,
  siteAddress = "",
): QuoteTravelCostSettings {
  const raw = typeof value === "object" && value ? value as Partial<QuoteTravelCostSettings> : {};
  const normalized = {
    ...DEFAULT_QUOTE_TRAVEL_COST_SETTINGS,
    ...raw,
    companyAddress: cleanText(raw.companyAddress),
    siteAddress: cleanText(raw.siteAddress) || siteAddress,
    oneWayDistanceKm: positiveNumber(raw.oneWayDistanceKm),
    oneWayDurationMinutes: positiveNumber(raw.oneWayDurationMinutes),
    tollsPerRoundTripHt: positiveNumber(raw.tollsPerRoundTripHt),
    worksiteDays: raw.worksiteDays === null || raw.worksiteDays === undefined ? null : positiveNumber(raw.worksiteDays),
    workersCount: Math.max(1, positiveNumber(raw.workersCount) || 1),
    vehiclesCount: Math.max(1, positiveNumber(raw.vehiclesCount) || 1),
    costPerKm: positiveNumber(raw.costPerKm) || DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.costPerKm,
    vehicleHourlyCost: positiveNumber(raw.vehicleHourlyCost),
    vehicleWearCostPerKm: positiveNumber(raw.vehicleWearCostPerKm),
    averageSpeedKmh: positiveNumber(raw.averageSpeedKmh) || DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.averageSpeedKmh,
    billingMode: raw.billingMode === "absorb" || raw.billingMode === "line" ? raw.billingMode : "hidden",
    lineVatRate: positiveNumber(raw.lineVatRate) || DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.lineVatRate,
  };
  return normalized;
}

export function estimateQuoteWorksiteDays(quote: QuoteBuilderQuote): number {
  const value = positiveNumber(quote.estimatedDurationValue);
  if (!value) return 0;
  if (quote.estimatedDurationUnit === "jours") return Math.ceil(value);
  if (quote.estimatedDurationUnit === "mois") return Math.ceil(value * 22);
  return Math.ceil(value * 5);
}

export function calculateQuoteTravelCosts(quote: QuoteBuilderQuote): QuoteTravelCostSummary {
  const settings = normalizeQuoteTravelCostSettings(quote.settings.travelCosts, quote.siteAddress);
  const worksiteDays = positiveNumber(settings.worksiteDays) || estimateQuoteWorksiteDays(quote);
  const oneWayDistanceKm = positiveNumber(settings.oneWayDistanceKm);
  const roundTripDistanceKm = oneWayDistanceKm * 2;
  const averageSpeedKmh = positiveNumber(settings.averageSpeedKmh);
  const oneWayDurationMinutes =
    positiveNumber(settings.oneWayDurationMinutes) ||
    (oneWayDistanceKm > 0 && averageSpeedKmh > 0 ? (oneWayDistanceKm / averageSpeedKmh) * 60 : 0);
  const vehiclesCount = Math.max(1, positiveNumber(settings.vehiclesCount) || 1);
  const totalKm = worksiteDays * roundTripDistanceKm * vehiclesCount;
  const travelHours = worksiteDays * (oneWayDurationMinutes * 2 / 60) * vehiclesCount;
  const fuelCostHt = totalKm * positiveNumber(settings.costPerKm);
  const travelTimeCostHt = travelHours * positiveNumber(settings.vehicleHourlyCost);
  const vehicleWearCostHt = totalKm * positiveNumber(settings.vehicleWearCostPerKm);
  const tollsCostHt = worksiteDays * positiveNumber(settings.tollsPerRoundTripHt) * vehiclesCount;

  return {
    worksiteDays,
    oneWayDistanceKm,
    roundTripDistanceKm,
    oneWayDurationMinutes,
    totalKm,
    travelHours,
    fuelCostHt: money(fuelCostHt),
    travelTimeCostHt: money(travelTimeCostHt),
    vehicleWearCostHt: money(vehicleWearCostHt),
    tollsCostHt: money(tollsCostHt),
    totalCostHt: money(fuelCostHt + travelTimeCostHt + vehicleWearCostHt + tollsCostHt),
  };
}

export function buildTravelCostInternalNote(summary: QuoteTravelCostSummary) {
  return [
    `Deplacement aller: ${formatNumber(summary.oneWayDistanceKm)} km`,
    `Aller-retour: ${formatNumber(summary.roundTripDistanceKm)} km`,
    `Jours chantier: ${formatNumber(summary.worksiteDays)}`,
    `Kilometres totaux: ${formatNumber(summary.totalKm)} km`,
    `Temps trajet total: ${formatNumber(summary.travelHours)} h`,
    `Carburant: ${formatCurrency(summary.fuelCostHt)}`,
    `Temps trajet: ${formatCurrency(summary.travelTimeCostHt)}`,
    `Usure vehicule: ${formatCurrency(summary.vehicleWearCostHt)}`,
    `Peages: ${formatCurrency(summary.tollsCostHt)}`,
  ].join("\n");
}

function positiveNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function money(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
