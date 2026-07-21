import { DEFAULT_QUOTE_TRAVEL_COST_SETTINGS } from "../features/quotes/builder/quoteBuilderTravelCosts";
import type { QuoteTravelCostSettings } from "../features/quotes/builder/types";
import { supabase } from "../lib/supabaseClient";

const TABLE = "company_settings";

export type CompanyTravelSettings = Pick<
  QuoteTravelCostSettings,
  | "companyAddress"
  | "costPerKm"
  | "vehicleHourlyCost"
  | "vehicleWearCostPerKm"
  | "averageSpeedKmh"
  | "workersCount"
  | "vehiclesCount"
> & {
  tollsEnabled: boolean;
  mapsProvider: "google_routes";
};

export const DEFAULT_COMPANY_TRAVEL_SETTINGS: CompanyTravelSettings = {
  companyAddress: "",
  costPerKm: DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.costPerKm,
  vehicleHourlyCost: DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.vehicleHourlyCost,
  vehicleWearCostPerKm: DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.vehicleWearCostPerKm,
  averageSpeedKmh: DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.averageSpeedKmh,
  workersCount: DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.workersCount,
  vehiclesCount: DEFAULT_QUOTE_TRAVEL_COST_SETTINGS.vehiclesCount,
  tollsEnabled: true,
  mapsProvider: "google_routes",
};

type CompanyTravelSettingsRow = {
  address: string | null;
  travel_settings?: unknown;
};

function isMissingTravelSettingsColumn(error: { message?: string } | null): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("travel_settings") && (message.includes("column") || message.includes("schema cache"));
}

function positiveNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeCompanyTravelSettings(value: unknown, fallbackCompanyAddress = ""): CompanyTravelSettings {
  const raw = typeof value === "object" && value ? value as Partial<CompanyTravelSettings> : {};
  return {
    companyAddress: cleanText(raw.companyAddress) || cleanText(fallbackCompanyAddress),
    costPerKm: positiveNumber(raw.costPerKm) || DEFAULT_COMPANY_TRAVEL_SETTINGS.costPerKm,
    vehicleHourlyCost: positiveNumber(raw.vehicleHourlyCost),
    vehicleWearCostPerKm: positiveNumber(raw.vehicleWearCostPerKm),
    averageSpeedKmh: positiveNumber(raw.averageSpeedKmh) || DEFAULT_COMPANY_TRAVEL_SETTINGS.averageSpeedKmh,
    workersCount: Math.max(1, positiveNumber(raw.workersCount) || DEFAULT_COMPANY_TRAVEL_SETTINGS.workersCount),
    vehiclesCount: Math.max(1, positiveNumber(raw.vehiclesCount) || DEFAULT_COMPANY_TRAVEL_SETTINGS.vehiclesCount),
    tollsEnabled: raw.tollsEnabled !== false,
    mapsProvider: "google_routes",
  };
}

export async function getCompanyTravelSettings(): Promise<CompanyTravelSettings> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  const userId = userData.user?.id;
  if (!userId) throw new Error("Utilisateur non authentifie.");

  const withTravelSettings = await supabase
    .from(TABLE)
    .select("address, travel_settings")
    .eq("organization_id", userId)
    .maybeSingle();

  if (!withTravelSettings.error) {
    const row = withTravelSettings.data as CompanyTravelSettingsRow | null;
    return normalizeCompanyTravelSettings(row?.travel_settings, row?.address ?? "");
  }

  if (!isMissingTravelSettingsColumn(withTravelSettings.error)) {
    throw new Error(withTravelSettings.error.message);
  }

  const withoutTravelSettings = await supabase
    .from(TABLE)
    .select("address")
    .eq("organization_id", userId)
    .maybeSingle();

  if (withoutTravelSettings.error) throw new Error(withoutTravelSettings.error.message);
  const row = withoutTravelSettings.data as CompanyTravelSettingsRow | null;
  return normalizeCompanyTravelSettings(null, row?.address ?? "");
}
