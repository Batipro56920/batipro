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
import type { QuoteCompositeNode } from "../domain/QuoteLine";
import type { QuoteLibraryItem } from "../domain/QuoteLibrary";
import { quoteLibraryItemToNode } from "../application/quoteLibraryMapper";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type QuoteStore = {
  quote: Quote;
  saveState: SaveState;
  error: string | null;
  activeNodeId: string | null;
  hydrate: (quote: Quote) => void;
  setSaveState: (state: SaveState, error?: string | null) => void;
  setActiveNode: (nodeId: string | null) => void;
  updateQuote: (patch: Partial<Quote>) => void;
  addNode: (type: QuoteNodeType, parentId?: string | null, lineKind?: QuoteLineKind) => void;
  addTemplate: (template: TaskTemplateRow) => void;
  addLibraryItem: (item: QuoteLibraryItem) => void;
  updateNode: (nodeId: string, patch: Partial<QuoteNode>) => void;
  updateComposite: (nodeId: string, updater: (node: QuoteCompositeNode) => QuoteCompositeNode) => void;
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
    activeNodeId: null,
    hydrate: (quote) => set({ quote: withTotals(quote), saveState: "saved", error: null, activeNodeId: null }),
    setSaveState: (saveState, error = null) => set({ saveState, error }),
    setActiveNode: (activeNodeId) => set({ activeNodeId }),
    updateQuote: (patch) => set((state) => ({ quote: withTotals({ ...state.quote, ...patch }), saveState: "dirty" })),
    addNode: (type, parentId, lineKind = "fourniture") =>
      set((state) => {
        const resolvedParentId = parentId === undefined ? resolveSmartParentId(state.quote.nodes, state.activeNodeId, type) : parentId;
        const quote = addQuoteNode(state.quote, type, resolvedParentId, lineKind);
        const added = findLastAddedNode(state.quote.nodes, quote.nodes);
        return { quote, activeNodeId: added?.id ?? state.activeNodeId, saveState: "dirty" };
      }),
    addTemplate: (template) => set((state) => ({ quote: addTemplateQuoteNode(state.quote, template), saveState: "dirty" })),
    addLibraryItem: (item) =>
      set((state) => {
        const nodeType = item.type === "ouvrage" ? "composite" : item.type === "texte" ? "text" : item.type === "section_modele" ? "section" : "line";
        const parentId = resolveSmartParentId(state.quote.nodes, state.activeNodeId, nodeType);
        const node = quoteLibraryItemToNode(item, siblingCount(state.quote.nodes, parentId) + 1);
        const normalizedNode = { ...node, parentId } as QuoteNode;
        const nodes = parentId ? appendChildNode(state.quote.nodes, parentId, normalizedNode) : [...state.quote.nodes, normalizedNode];
        return {
          quote: withTotals({ ...state.quote, nodes }),
          activeNodeId: normalizedNode.id,
          saveState: "dirty",
        };
      }),
    updateNode: (nodeId, patch) => set((state) => ({ quote: updateQuoteNode(state.quote, nodeId, patch), saveState: "dirty" })),
    updateComposite: (nodeId, updater) =>
      set((state) => ({
        quote: updateQuoteNode(state.quote, nodeId, updater(findCompositeNode(state.quote.nodes, nodeId))),
        saveState: "dirty",
      })),
    removeNode: (nodeId) =>
      set((state) => ({
        quote: removeQuoteNode(state.quote, nodeId),
        activeNodeId: state.activeNodeId === nodeId ? null : state.activeNodeId,
        saveState: "dirty",
      })),
    moveNode: (nodeId, direction) => set((state) => ({ quote: moveQuoteNode(state.quote, nodeId, direction), saveState: "dirty" })),
    moveNodeBefore: (nodeId, targetId) => set((state) => ({ quote: moveQuoteNodeBefore(state.quote, nodeId, targetId), saveState: "dirty" })),
    duplicateNode: (nodeId) => set((state) => ({ quote: duplicateQuoteNode(state.quote, nodeId), saveState: "dirty" })),
    selectClient: (client) => set((state) => ({ quote: applyQuoteClient(state.quote, client), saveState: "dirty" })),
    selectProspect: (prospect) => set((state) => ({ quote: applyQuoteProspect(state.quote, prospect), saveState: "dirty" })),
    selectProject: (project) => set((state) => ({ quote: applyQuoteProject(state.quote, project), saveState: "dirty" })),
  })),
);

function findCompositeNode(nodes: QuoteNode[], nodeId: string): QuoteCompositeNode {
  for (const node of nodes) {
    if (node.id === nodeId && node.type === "composite") return node;
    if (node.type === "section" || node.type === "subsection") {
      const found = findCompositeNodeOrNull(node.children, nodeId);
      if (found) return found;
    }
  }
  throw new Error("Ouvrage introuvable.");
}

function findCompositeNodeOrNull(nodes: QuoteNode[], nodeId: string): QuoteCompositeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId && node.type === "composite") return node;
    if (node.type === "section" || node.type === "subsection") {
      const found = findCompositeNodeOrNull(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

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
  activeNodeId: (state: QuoteStore) => state.activeNodeId,
  error: (state: QuoteStore) => state.error,
};

type NodeHit = {
  node: QuoteNode;
  parent: QuoteNode | null;
};

function resolveSmartParentId(nodes: QuoteNode[], activeNodeId: string | null, type: QuoteNodeType): string | null {
  if (type === "section") return null;

  const active = activeNodeId ? findNodeWithParent(nodes, activeNodeId) : null;
  if (type === "subsection") {
    if (active?.node.type === "section") return active.node.id;
    if (active?.node.type === "subsection" && active.parent?.type === "section") return active.parent.id;
    if (active?.parent?.type === "section") return active.parent.id;
    return lastRootSectionId(nodes);
  }

  if (active?.node.type === "subsection" || active?.node.type === "section") return active.node.id;
  if (active?.parent?.type === "subsection" || active?.parent?.type === "section") return active.parent.id;
  return lastRootSectionId(nodes);
}

function findNodeWithParent(nodes: QuoteNode[], nodeId: string, parent: QuoteNode | null = null): NodeHit | null {
  for (const node of nodes) {
    if (node.id === nodeId) return { node, parent };
    if (node.type === "section" || node.type === "subsection") {
      const found = findNodeWithParent(node.children, nodeId, node);
      if (found) return found;
    }
  }
  return null;
}

function lastRootSectionId(nodes: QuoteNode[]): string | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (nodes[index].type === "section") return nodes[index].id;
  }
  return null;
}

function siblingCount(nodes: QuoteNode[], parentId: string | null): number {
  if (!parentId) return nodes.length;
  const parent = findNodeWithParent(nodes, parentId)?.node;
  return parent && (parent.type === "section" || parent.type === "subsection") ? parent.children.length : nodes.length;
}

function appendChildNode(nodes: QuoteNode[], parentId: string, child: QuoteNode): QuoteNode[] {
  return nodes.map((node) => {
    if ((node.type === "section" || node.type === "subsection") && node.id === parentId) {
      return { ...node, children: [...node.children, child] };
    }
    if (node.type === "section" || node.type === "subsection") return { ...node, children: appendChildNode(node.children, parentId, child) };
    return node;
  });
}

function findLastAddedNode(previous: QuoteNode[], next: QuoteNode[]): QuoteNode | null {
  const previousIds = new Set(flattenIds(previous));
  const flattened = flattenNodes(next);
  for (let index = flattened.length - 1; index >= 0; index -= 1) {
    if (!previousIds.has(flattened[index].id)) return flattened[index];
  }
  return null;
}

function flattenIds(nodes: QuoteNode[]): string[] {
  return flattenNodes(nodes).map((node) => node.id);
}

function flattenNodes(nodes: QuoteNode[]): QuoteNode[] {
  return nodes.flatMap((node) => (node.type === "section" || node.type === "subsection" ? [node, ...flattenNodes(node.children)] : [node]));
}
