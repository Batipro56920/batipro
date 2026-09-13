import type { CompanyHourlyRates } from "../../../services/indirectCosts.service";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";
import type { TaskTemplateMaterialRatioRow } from "../../../services/taskTemplatePreparation.service";
import { taskTemplateUnitCost } from "../../../services/taskCostBasis";
import { normalizeTaskTemplateIds } from "./quoteBuilderModel";
import type { QuoteBuilderItem } from "./types";

export {
  DEFAULT_QUOTE_MARGIN_RATE,
  estimatedDaysFromHours,
  marginRateOnSale,
  salePriceFromCost,
  taskTemplateUnitCost,
} from "../../../services/taskCostBasis";

export type QuoteLineCost = {
  /** Déboursé sec de la ligne entière, quantités comprises. */
  costHt: number;
  /** Temps de main d'oeuvre de la ligne entière, en heures. */
  hours: number;
};

export const EMPTY_LINE_COST: QuoteLineCost = { costHt: 0, hours: 0 };

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
