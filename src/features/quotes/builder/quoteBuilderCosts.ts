import type { CompanyHourlyRates } from "../../../services/indirectCosts.service";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";
import type { TaskTemplateMaterialRatioRow } from "../../../services/taskTemplatePreparation.service";
import { normalizeTaskTemplateIds } from "./quoteBuilderModel";
import type { QuoteBuilderItem } from "./types";

/**
 * Marge appliquée au déboursé sec quand une ligne arrive du relevé sans prix.
 * Même valeur que le catalogue produits, pour que le chiffrage ne change pas de
 * base selon l'endroit d'où vient la ligne.
 */
export const DEFAULT_QUOTE_MARGIN_RATE = 30;

/** Heures travaillées par jour, pour traduire un temps en durée de chantier. */
export const WORKING_HOURS_PER_DAY = 7;

export type QuoteLineCost = {
  /** Déboursé sec de la ligne entière, quantités comprises. */
  costHt: number;
  /** Temps de main d'oeuvre de la ligne entière, en heures. */
  hours: number;
};

export const EMPTY_LINE_COST: QuoteLineCost = { costHt: 0, hours: 0 };

/**
 * Déboursé d'une tâche pour une unité : main d'oeuvre au coût horaire moyen,
 * matériaux majorés de leurs pertes, amortissement et frais généraux ramenés au
 * temps passé. Même méthode que la bibliothèque de tâches et que le relevé
 * terrain : un même geste doit coûter le même prix partout.
 */
export function taskTemplateUnitCost(
  template: TaskTemplateRow | null,
  materials: TaskTemplateMaterialRatioRow[],
  rates: CompanyHourlyRates | null,
): QuoteLineCost {
  if (!template) return EMPTY_LINE_COST;
  const hours = Number(template.temps_prevu_par_unite_h ?? 0);
  const labor = hours * Number(rates?.averageEmployeeHourlyCostHt ?? 0);
  const material = materials.reduce(
    (total, row) => total + Number(row.ratio_quantity ?? 0) * (1 + Number(row.loss_percent ?? 0) / 100) * Number(row.purchase_price_ht ?? 0),
    0,
  );
  const indirect = hours * (Number(rates?.amortizationRatePerHour ?? 0) + Number(rates?.overheadRatePerHour ?? 0));
  return { costHt: labor + material + indirect, hours };
}

/**
 * Déboursé d'une ligne de devis : chaque tâche liée compte avec sa propre
 * quantité quand elle en a une, sinon avec celle de la ligne.
 */
export function quoteItemCost(
  item: QuoteBuilderItem,
  templatesById: Map<string, TaskTemplateRow>,
  materialsByTemplateId: Record<string, TaskTemplateMaterialRatioRow[]>,
  rates: CompanyHourlyRates | null,
): QuoteLineCost {
  const ids = normalizeTaskTemplateIds(item.taskTemplateIds, item.taskTemplateId);
  if (!ids.length) return EMPTY_LINE_COST;
  const quantities = Array.isArray(item.taskTemplateQuantities) ? item.taskTemplateQuantities : [];
  return ids.reduce<QuoteLineCost>((total, id, index) => {
    const unitCost = taskTemplateUnitCost(templatesById.get(id) ?? null, materialsByTemplateId[id] ?? [], rates);
    const pinned = Number(quantities[index] ?? NaN);
    const count = Number.isFinite(pinned) ? pinned : Number(item.quantity ?? 0);
    return { costHt: total.costHt + unitCost.costHt * count, hours: total.hours + unitCost.hours * count };
  }, EMPTY_LINE_COST);
}

/** Prix de vente déduit d'un déboursé sec. */
export function salePriceFromCost(costHt: number, marginRate = DEFAULT_QUOTE_MARGIN_RATE): number {
  return Math.round(costHt * (1 + marginRate / 100) * 100) / 100;
}

/**
 * Taux de marge sur le prix de vente : c'est celui qui parle au chiffrage
 * ("je garde 30 % de ce que le client paye"), pas le coefficient applique au
 * deboursé.
 */
export function marginRateOnSale(costHt: number, saleHt: number): number | null {
  if (!saleHt) return null;
  return ((saleHt - costHt) / saleHt) * 100;
}

/** Durée de chantier déduite du temps des tâches liées, arrondie au jour. */
export function estimatedDaysFromHours(hours: number): number {
  if (!hours) return 0;
  return Math.max(1, Math.ceil(hours / WORKING_HOURS_PER_DAY));
}
