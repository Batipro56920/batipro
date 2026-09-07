import { supabase } from "../lib/supabaseClient";
import {
  getCompanySettings,
  normalizeIndirectCosts,
  type CompanyChargeEntry,
  type CompanyEquipmentAsset,
} from "./companySettings.service";

/**
 * Taux horaires d'entreprise servant au prix de revient d'une tâche.
 * L'amortissement matériel et les frais généraux sont des coûts annuels : on les
 * ramène à un coût horaire en les divisant par les heures productives annuelles,
 * pour pouvoir ensuite les imputer au temps de main d'oeuvre de la tâche.
 */
export type CompanyHourlyRates = {
  activeEmployeeCount: number;
  averageEmployeeHourlyCostHt: number;
  productiveHoursPerEmployeeYear: number;
  productiveHoursPerYear: number;
  amortizationAnnualHt: number;
  amortizationRatePerHour: number;
  overheadAnnualHt: number;
  overheadRatePerHour: number;
  equipmentAssets: CompanyEquipmentAsset[];
};

export function chargeMonthlyEquivalent(entry: CompanyChargeEntry): number {
  switch (entry.frequency) {
    case "monthly":
      return entry.amount;
    case "quarterly":
      return entry.amount / 3;
    case "annual":
      return entry.amount / 12;
    case "one_time":
    default:
      return 0;
  }
}

export function chargeAnnualEquivalent(entry: CompanyChargeEntry): number {
  if (entry.frequency === "annual") return entry.amount;
  return chargeMonthlyEquivalent(entry) * 12;
}

/** Total annuel des charges d'exploitation actives (fixes + variables). */
export function computeExploitationAnnual(entries: CompanyChargeEntry[]): number {
  const active = entries.filter((entry) => entry.active);
  const fixedAnnual = active
    .filter((entry) => entry.type === "fixed")
    .reduce((sum, entry) => sum + chargeAnnualEquivalent(entry), 0);
  const variableMonthly = active
    .filter((entry) => entry.type === "variable")
    .reduce((sum, entry) => sum + chargeMonthlyEquivalent(entry), 0);
  return fixedAnnual + variableMonthly * 12;
}

/** Dotation annuelle d'amortissement : valeur d'achat / durée, en linéaire. */
export function computeAmortizationAnnual(assets: CompanyEquipmentAsset[]): number {
  return assets
    .filter((asset) => asset.active && asset.amortizationYears > 0)
    .reduce((sum, asset) => sum + asset.purchaseValueHt / asset.amortizationYears, 0);
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * Coût horaire moyen des ouvriers CB Rénovation uniquement : on ne retient que
 * les intervenants de statut "employee" encore actifs, jamais les sous-traitants
 * ni les intérimaires, dont le coût ne reflète pas notre masse salariale.
 */
async function loadEmployeeHourlyCosts(): Promise<{ count: number; average: number }> {
  const { data, error } = await (supabase as any)
    .from("intervenants")
    .select("hourly_cost_ht")
    .eq("status", "employee")
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const costs = (data ?? [])
    .map((row: { hourly_cost_ht: unknown }) => Number(row?.hourly_cost_ht))
    .filter((value: number) => Number.isFinite(value) && value > 0);

  const count = (data ?? []).length;
  if (!costs.length) return { count, average: 0 };
  return { count, average: costs.reduce((sum: number, value: number) => sum + value, 0) / costs.length };
}

export async function getCompanyHourlyRates(): Promise<CompanyHourlyRates> {
  const [settings, employees] = await Promise.all([getCompanySettings(), loadEmployeeHourlyCosts()]);

  const indirect = normalizeIndirectCosts(settings.indirect_costs);
  const overheadAnnualHt = computeExploitationAnnual(settings.charges_exploitation?.entries ?? []);
  const amortizationAnnualHt = computeAmortizationAnnual(indirect.equipmentAssets);
  const productiveHoursPerYear = employees.count * indirect.productiveHoursPerEmployeeYear;

  return {
    activeEmployeeCount: employees.count,
    averageEmployeeHourlyCostHt: round2(employees.average),
    productiveHoursPerEmployeeYear: indirect.productiveHoursPerEmployeeYear,
    productiveHoursPerYear,
    amortizationAnnualHt: round2(amortizationAnnualHt),
    amortizationRatePerHour: productiveHoursPerYear > 0 ? round2(amortizationAnnualHt / productiveHoursPerYear) : 0,
    overheadAnnualHt: round2(overheadAnnualHt),
    overheadRatePerHour: productiveHoursPerYear > 0 ? round2(overheadAnnualHt / productiveHoursPerYear) : 0,
    equipmentAssets: indirect.equipmentAssets,
  };
}
