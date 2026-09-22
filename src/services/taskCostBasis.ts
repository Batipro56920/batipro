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
 * Déboursé d'une tâche pour une unité.
 *
 * La main d'oeuvre est comptée au coût horaire COMPLET : le coût du salarié,
 * plus les frais généraux et l'amortissement ramenés à l'heure. Ces frais
 * vivaient à part, ajoutés au déboursé sans jamais entrer dans le prix de
 * vente ; ils sont désormais dans la main d'oeuvre, vendus avec elle, et nulle
 * part ailleurs. indirectHt reste exposé pour dire "dont frais généraux" — il
 * est DÉJÀ compris dans laborHt et ne doit jamais être additionné à nouveau.
 */
export function taskTemplateUnitCost(
  template: TaskTemplateRow | null,
  materials: TaskTemplateMaterialRatioRow[],
  rates: CompanyHourlyRates | null,
): TaskCostBasis {
  if (!template) return EMPTY_TASK_COST;
  // Le coût horaire propre à la tâche prime : un geste confié à un compagnon
  // qualifié ne se chiffre pas au coût moyen de l'équipe.
  const baseHourlyCostHt = Number(template.labor_hourly_cost_ht ?? rates?.averageEmployeeHourlyCostHt ?? 0);
  const overheadPerHour = Number(rates?.amortizationRatePerHour ?? 0) + Number(rates?.overheadRatePerHour ?? 0);
  const hours = Number(template.temps_prevu_par_unite_h ?? 0);
  const indirectHt = hours * overheadPerHour;
  const laborHt = hours * (baseHourlyCostHt + overheadPerHour);
  const materialsHt = materials.reduce(
    (total, row) => total + Number(row.ratio_quantity ?? 0) * (1 + Number(row.loss_percent ?? 0) / 100) * Number(row.purchase_price_ht ?? 0),
    0,
  );
  // indirectHt est deja dans laborHt : ne pas l'ajouter une seconde fois.
  return { costHt: laborHt + materialsHt, hours, laborHt, materialsHt, indirectHt };
}

/** Marge retenue pour une tâche : la sienne, sinon celle de l'entreprise. */
export function taskTemplateMarginRate(template: TaskTemplateRow | null, rates?: CompanyHourlyRates | null): number {
  const value = Number(template?.target_margin_rate ?? NaN);
  if (Number.isFinite(value) && value >= 0) return value;
  const company = Number(rates?.defaultMarginRate ?? NaN);
  return Number.isFinite(company) && company >= 0 ? company : DEFAULT_QUOTE_MARGIN_RATE;
}

/**
 * Marge de la main d'œuvre : celle de la tâche si elle en a une, sinon celle
 * réglée pour la main d'œuvre dans Mon entreprise, sinon la marge générale.
 * Une heure vendue porte le risque du chantier, pas un sac de plâtre revendu.
 */
export function taskTemplateLaborMarginRate(template: TaskTemplateRow | null, rates?: CompanyHourlyRates | null): number {
  const own = Number(template?.target_margin_rate ?? NaN);
  if (Number.isFinite(own) && own >= 0) return own;
  const labor = Number(rates?.defaultLaborMarginRate ?? NaN);
  if (Number.isFinite(labor) && labor >= 0) return labor;
  return taskTemplateMarginRate(template, rates);
}

/** Prix de vente d'une unité de tâche : son déboursé majoré de sa propre marge. */
export function taskTemplateUnitSale(
  template: TaskTemplateRow | null,
  materials: TaskTemplateMaterialRatioRow[],
  rates: CompanyHourlyRates | null,
): number {
  // Deux marges, deux natures de déboursé : la main d'œuvre et les matériaux
  // ne se vendent pas au même taux.
  const cost = taskTemplateUnitCost(template, materials, rates);
  const labor = salePriceFromCost(cost.laborHt, taskTemplateLaborMarginRate(template, rates));
  const materialsSale = salePriceFromCost(cost.materialsHt, taskTemplateMarginRate(template, rates));
  return Math.round((labor + materialsSale) * 100) / 100;
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
