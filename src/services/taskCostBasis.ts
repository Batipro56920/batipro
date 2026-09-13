import type { CompanyHourlyRates } from "./indirectCosts.service";
import type { TaskTemplateRow } from "./taskLibrary.service";
import type { TaskTemplateMaterialRatioRow } from "./taskTemplatePreparation.service";

/**
 * Base de chiffrage commune au relevé terrain, au devis et à la bibliothèque de
 * tâches. Un même geste doit coûter le même prix partout : dès que chaque écran
 * refait son calcul dans son coin, les prix divergent sans que personne ne voie
 * lequel est le bon.
 */

/** Marge appliquée au déboursé sec quand aucun prix n'a encore été décidé. */
export const DEFAULT_QUOTE_MARGIN_RATE = 30;

/** Heures travaillées par jour, pour traduire un temps en durée de chantier. */
export const WORKING_HOURS_PER_DAY = 7;

export type TaskCostBasis = {
  /** Déboursé sec pour une unité de la tâche. */
  costHt: number;
  /** Temps de main d'oeuvre pour une unité, en heures. */
  hours: number;
  laborHt: number;
  materialsHt: number;
  indirectHt: number;
};

export const EMPTY_TASK_COST: TaskCostBasis = { costHt: 0, hours: 0, laborHt: 0, materialsHt: 0, indirectHt: 0 };

/**
 * Déboursé d'une tâche pour une unité : main d'oeuvre au coût horaire moyen des
 * employés, matériaux majorés de leurs pertes, amortissement et frais généraux
 * ramenés au temps passé.
 */
export function taskTemplateUnitCost(
  template: TaskTemplateRow | null,
  materials: TaskTemplateMaterialRatioRow[],
  rates: CompanyHourlyRates | null,
): TaskCostBasis {
  if (!template) return EMPTY_TASK_COST;
  const hours = Number(template.temps_prevu_par_unite_h ?? 0);
  const laborHt = hours * Number(rates?.averageEmployeeHourlyCostHt ?? 0);
  const materialsHt = materials.reduce(
    (total, row) => total + Number(row.ratio_quantity ?? 0) * (1 + Number(row.loss_percent ?? 0) / 100) * Number(row.purchase_price_ht ?? 0),
    0,
  );
  const indirectHt = hours * (Number(rates?.amortizationRatePerHour ?? 0) + Number(rates?.overheadRatePerHour ?? 0));
  return { costHt: laborHt + materialsHt + indirectHt, hours, laborHt, materialsHt, indirectHt };
}

/** Prix de vente déduit d'un déboursé sec. */
export function salePriceFromCost(costHt: number, marginRate = DEFAULT_QUOTE_MARGIN_RATE): number {
  return Math.round(costHt * (1 + marginRate / 100) * 100) / 100;
}

/**
 * Taux de marge sur le prix de vente : celui qui parle au chiffrage ("je garde
 * tant de ce que le client paye"), pas le coefficient appliqué au déboursé.
 */
export function marginRateOnSale(costHt: number, saleHt: number): number | null {
  if (!saleHt) return null;
  return ((saleHt - costHt) / saleHt) * 100;
}

/** Durée de chantier déduite du temps des tâches, arrondie au jour entier. */
export function estimatedDaysFromHours(hours: number): number {
  if (!hours) return 0;
  return Math.max(1, Math.ceil(hours / WORKING_HOURS_PER_DAY));
}
