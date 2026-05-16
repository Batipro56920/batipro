import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  addQuoteNode,
  addTemplateQuoteNode,
  applyQuoteClient,
  applyQuoteProject,
  applyQuoteProspect,
  createEmptyQuote,
  duplicateQuoteNode,
  moveQuoteNode,
  moveQuoteNodeBefore,
  removeQuoteNode,
  updateQuoteNode,
  withTotals,
} from "../application/quoteEngine";
import type { Quote, QuoteAccountOption, QuoteProjectOption } from "../domain/Quote";
import type { QuoteLineKind, QuoteNodeType } from "../domain/QuoteEnums";
import type { QuoteNode } from "../domain/QuoteSection";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type QuoteStore = {
  quote: Quote;
  saveState: SaveState;
  error: string | null;
  hydrate: (quote: Quote) => void;
  setSaveState: (state: SaveState, error?: string | null) => void;
  updateQuote: (patch: Partial<Quote>) => void;
  addNode: (type: QuoteNodeType, parentId?: string | null, lineKind?: QuoteLineKind) => void;
  addTemplate: (template: TaskTemplateRow) => void;
  updateNode: (nodeId: string, patch: Partial<QuoteNode>) => void;
  removeNode: (nodeId: string) => void;
  moveNode: (nodeId: string, direction: -1 | 1) => void;
  moveNodeBefore: (nodeId: string, targetId: string) => void;
  duplicateNode: (nodeId: string) => void;
  selectClient: (client: QuoteAccountOption | null) => void;
  selectProspect: (prospect: QuoteAccountOption | null) => void;
  selectProject: (project: QuoteProjectOption | null) => void;
};

export const useQuoteStore = create<QuoteStore>()(
  subscribeWithSelector((set) => ({
    quote: createEmptyQuote(null),
    saveState: "idle",
    error: null,
    hydrate: (quote) => set({ quote: withTotals(quote), saveState: "saved", error: null }),
    setSaveState: (saveState, error = null) => set({ saveState, error }),
    updateQuote: (patch) => set((state) => ({ quote: withTotals({ ...state.quote, ...patch }), saveState: "dirty" })),
    addNode: (type, parentId = null, lineKind = "fourniture") => set((state) => ({ quote: addQuoteNode(state.quote, type, parentId, lineKind), saveState: "dirty" })),
    addTemplate: (template) => set((state) => ({ quote: addTemplateQuoteNode(state.quote, template), saveState: "dirty" })),
    updateNode: (nodeId, patch) => set((state) => ({ quote: updateQuoteNode(state.quote, nodeId, patch), saveState: "dirty" })),
    removeNode: (nodeId) => set((state) => ({ quote: removeQuoteNode(state.quote, nodeId), saveState: "dirty" })),
    moveNode: (nodeId, direction) => set((state) => ({ quote: moveQuoteNode(state.quote, nodeId, direction), saveState: "dirty" })),
    moveNodeBefore: (nodeId, targetId) => set((state) => ({ quote: moveQuoteNodeBefore(state.quote, nodeId, targetId), saveState: "dirty" })),
    duplicateNode: (nodeId) => set((state) => ({ quote: duplicateQuoteNode(state.quote, nodeId), saveState: "dirty" })),
    selectClient: (client) => set((state) => ({ quote: applyQuoteClient(state.quote, client), saveState: "dirty" })),
    selectProspect: (prospect) => set((state) => ({ quote: applyQuoteProspect(state.quote, prospect), saveState: "dirty" })),
    selectProject: (project) => set((state) => ({ quote: applyQuoteProject(state.quote, project), saveState: "dirty" })),
  })),
);

export const quoteSelectors = {
  quoteId: (state: QuoteStore) => state.quote.id,
  quoteMeta: (state: QuoteStore) => ({
    number: state.quote.number,
    date: state.quote.date,
    validityDate: state.quote.validityDate,
    workStartDate: state.quote.workStartDate,
    estimatedDuration: state.quote.estimatedDuration,
    clientId: state.quote.clientId,
    prospectId: state.quote.prospectId,
    projectId: state.quote.projectId,
    clientName: state.quote.clientName,
    siteAddress: state.quote.siteAddress,
    description: state.quote.description,
  }),
  nodes: (state: QuoteStore) => state.quote.nodes,
  totals: (state: QuoteStore) => state.quote.totals,
  texts: (state: QuoteStore) => ({
    paymentTerms: state.quote.paymentTerms,
    legalMentions: state.quote.legalMentions,
    wasteManagement: state.quote.wasteManagement,
    footerNotes: state.quote.footerNotes,
  }),
  header: (state: QuoteStore) => ({
    number: state.quote.number,
    status: state.quote.status,
    saveState: state.saveState,
  }),
  error: (state: QuoteStore) => state.error,
};
