import type { QuoteAccountOption, QuoteProjectOption } from "../domain/Quote";
import type { QuoteLineKind, QuoteNodeType } from "../domain/QuoteEnums";
import type { QuoteNode } from "../domain/QuoteSection";
import { useQuoteStore } from "../store/quoteStore";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";

export function useQuoteActions() {
  return {
    updateQuote: useQuoteStore((state) => state.updateQuote),
    addNode: useQuoteStore((state) => state.addNode) as (type: QuoteNodeType, parentId?: string | null, lineKind?: QuoteLineKind) => void,
    addTemplate: useQuoteStore((state) => state.addTemplate) as (template: TaskTemplateRow) => void,
    updateNode: useQuoteStore((state) => state.updateNode) as (nodeId: string, patch: Partial<QuoteNode>) => void,
    removeNode: useQuoteStore((state) => state.removeNode),
    moveNode: useQuoteStore((state) => state.moveNode),
    moveNodeBefore: useQuoteStore((state) => state.moveNodeBefore),
    duplicateNode: useQuoteStore((state) => state.duplicateNode),
    selectClient: useQuoteStore((state) => state.selectClient) as (client: QuoteAccountOption | null) => void,
    selectProspect: useQuoteStore((state) => state.selectProspect) as (prospect: QuoteAccountOption | null) => void,
    selectProject: useQuoteStore((state) => state.selectProject) as (project: QuoteProjectOption | null) => void,
  };
}
