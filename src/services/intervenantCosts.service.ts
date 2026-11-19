import type { IntervenantRow } from "./intervenants.service";

/**
 * Tarif de référence pour le suivi du temps passé.
 * Pour les intervenants externes : taux horaire explicite, ou tarif journée / 7 h.
 * Ce taux est un coût d'achat, hors frais généraux et hors marge.
 */
export const EXTERNAL_WORKING_HOURS_PER_DAY = 7;

export function effectiveIntervenantHourlyCost(
  row: Pick<IntervenantRow, "status" | "hourly_cost_ht" | "daily_rate_ht">,
): number | null {
  const hourly = Number(row.hourly_cost_ht);
  if (row.hourly_cost_ht != null && Number.isFinite(hourly) && hourly > 0) return hourly;
  if (row.status === "subcontractor" || row.status === "temporary_worker") {
    const daily = Number(row.daily_rate_ht);
    if (row.daily_rate_ht != null && Number.isFinite(daily) && daily > 0) {
      return daily / EXTERNAL_WORKING_HOURS_PER_DAY;
    }
  }
  return null;
}
