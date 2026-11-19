import type { IntervenantRow } from "./intervenants.service";
import { effectiveIntervenantHourlyCost } from "./intervenantCosts.service";

export type LaborTimeEntry = {
  chantier_id: string;
  task_id?: string | null;
  intervenant_id: string;
  duration_hours: number | null;
  hourly_cost_snapshot_ht?: number | null;
};
export type LaborCostValuation = {
  hours: number;
  laborCostHt: number;
  hoursUsingChantierRate: number;
  hoursUsingSnapshot: number;
};
export type LaborCostBreakdown = LaborCostValuation & { taskId: string | null };

export function configuredWorkerRates(workers: IntervenantRow[]): Map<string, number> {
  const rates = new Map<string, number>();
  for (const worker of workers) {
    const cost = effectiveIntervenantHourlyCost(worker);
    if (cost !== null) rates.set(worker.id, cost);
  }
  return rates;
}

/**
 * Shared base labor valuation. No indirect costs here: overhead and
 * amortization must be displayed and applied separately to avoid duplication.
 * Historical snapshot always takes precedence over today's worker rate.
 */
export function valueLaborEntry(
  entry: LaborTimeEntry,
  rates: Map<string, number>,
  chantierHourlyRate: number,
): LaborCostValuation {
  const hours = Number(entry.duration_hours);
  if (!Number.isFinite(hours) || hours <= 0) {
    return { hours: 0, laborCostHt: 0, hoursUsingChantierRate: 0, hoursUsingSnapshot: 0 };
  }
  const snapshot = entry.hourly_cost_snapshot_ht;
  const hasSnapshot = snapshot != null && Number.isFinite(Number(snapshot)) && Number(snapshot) >= 0;
  const individualRate = rates.get(entry.intervenant_id);
  const useChantier = !hasSnapshot && individualRate === undefined;
  const fallback = Number.isFinite(chantierHourlyRate) && chantierHourlyRate >= 0 ? chantierHourlyRate : 0;
  const appliedRate = hasSnapshot ? Number(snapshot) : individualRate ?? fallback;
  return {
    hours,
    laborCostHt: hours * appliedRate,
    hoursUsingChantierRate: useChantier ? hours : 0,
    hoursUsingSnapshot: hasSnapshot ? hours : 0,
  };
}

export function sumLaborValues(values: LaborCostValuation[]): LaborCostValuation {
  return values.reduce((sum, item) => ({
    hours: sum.hours + item.hours,
    laborCostHt: sum.laborCostHt + item.laborCostHt,
    hoursUsingChantierRate: sum.hoursUsingChantierRate + item.hoursUsingChantierRate,
    hoursUsingSnapshot: sum.hoursUsingSnapshot + item.hoursUsingSnapshot,
  }), { hours: 0, laborCostHt: 0, hoursUsingChantierRate: 0, hoursUsingSnapshot: 0 });
}
