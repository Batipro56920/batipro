import type { CompanyHourlyRates } from "../../../services/indirectCosts.service";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";
import type { TaskTemplateMaterialRatioRow } from "../../../services/taskTemplatePreparation.service";
import { taskTemplateUnitCost, taskTemplateUnitSale } from "../../../services/taskCostBasis";
import { normalizeTaskTemplateIds } from "./quoteBuilderModel";
import type { QuoteBuilderItem } from "./types";

export {
  DEFAULT_QUOTE_MARGIN_RATE,
  estimatedDaysFromHours,
  taskTemplateMarginRate,
  marginRateOnSale,
  salePriceFromCost,
  taskTemplateUnitCost,
  taskTemplateUnitSale,
} from "../../../services/taskCostBasis";

export type QuoteLineCost = {
  /** Déboursé sec de la ligne entière, quantités comprises. */
  costHt: number;
  /** Temps de main d'oeuvre de la ligne entière, en heures. */
  hours: number;
  /**
   * Prix de vente de la ligne entière : chaque tâche liée est majorée de sa
   * propre marge, pas d'un taux unique pour tout le devis.
   */
  saleHt: number;
};

export const EMPTY_LINE_COST: QuoteLineCost = { costHt: 0, hours: 0, saleHt: 0 };

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
    const template = templatesById.get(id) ?? null;
    const materials = materialsByTemplateId[id] ?? [];
    const unitCost = taskTemplateUnitCost(template, materials, rates);
    const unitSale = taskTemplateUnitSale(template, materials, rates);
    const pinned = Number(quantities[index] ?? NaN);
    const count = Number.isFinite(pinned) ? pinned : Number(item.quantity ?? 0);
    return {
      costHt: total.costHt + unitCost.costHt * count,
      hours: total.hours + unitCost.hours * count,
      saleHt: total.saleHt + unitSale * count,
    };
  }, EMPTY_LINE_COST);
}
