import { create } from "zustand";
import { calculateDocumentTotals } from "../application/documentCalculations";
import type { BusinessDocument, BusinessDocumentNode } from "../domain/types";

type DocumentDraftState = {
  document: BusinessDocument | null;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  error: string | null;
  loadDocument: (document: BusinessDocument) => void;
  updateDocument: (patch: Partial<BusinessDocument>) => void;
  updateNode: (nodeId: string, patch: Partial<BusinessDocumentNode>) => void;
  saveDraft: () => void;
  clear: () => void;
};

export const useDocumentDraftStore = create<DocumentDraftState>((set, get) => ({
  document: null,
  saveState: "idle",
  error: null,
  loadDocument: (document) => set({ document: withTotals(document), saveState: "saved", error: null }),
  updateDocument: (patch) => {
    const document = get().document;
    if (!document) return;
    set({ document: withTotals({ ...document, ...patch }), saveState: "dirty" });
  },
  updateNode: (nodeId, patch) => {
    const document = get().document;
    if (!document) return;
    const nodes = updateNodeTree(document.nodes, nodeId, patch);
    set({ document: withTotals({ ...document, nodes }), saveState: "dirty" });
  },
  saveDraft: () => {
    const document = get().document;
    if (!document) return;
    try {
      set({ saveState: "saving", error: null });
      window.localStorage.setItem(`batipro-document-draft:${document.kind}:${document.number}`, JSON.stringify(document));
      set({ saveState: "saved" });
    } catch (error) {
      set({ saveState: "error", error: error instanceof Error ? error.message : "Impossible d'enregistrer le document" });
    }
  },
  clear: () => set({ document: null, saveState: "idle", error: null }),
}));

function withTotals(document: BusinessDocument): BusinessDocument {
  return { ...document, totals: calculateDocumentTotals(document) };
}

function updateNodeTree(nodes: BusinessDocumentNode[], nodeId: string, patch: Partial<BusinessDocumentNode>): BusinessDocumentNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return { ...node, ...patch } as BusinessDocumentNode;
    if (node.type === "section" || node.type === "subsection") {
      return { ...node, children: updateNodeTree(node.children, nodeId, patch) };
    }
    return node;
  });
}
