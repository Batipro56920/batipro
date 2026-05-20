import { create } from "zustand";
import type { QuoteBuilderItemKind, QuoteBuilderNode, QuoteBuilderQuote } from "./types";
import { appendNode, cloneWithPatch, createItem, createSection, createSubsection, moveNode, removeNodeFromQuote } from "./quoteBuilderModel";
import { saveQuoteBuilder, saveQuoteBuilderDraft } from "./quoteBuilderRepository";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type QuoteBuilderStore = {
  quote: QuoteBuilderQuote | null;
  activeParentId: string | null;
  saveState: SaveState;
  error: string | null;
  hydrate: (quote: QuoteBuilderQuote) => void;
  setActiveParent: (id: string | null) => void;
  updateQuote: (patch: Partial<QuoteBuilderQuote>) => void;
  updateNode: (id: string, patch: Partial<QuoteBuilderNode>) => void;
  addSection: () => void;
  addSubsection: () => void;
  addItem: (kind?: QuoteBuilderItemKind) => void;
  removeNode: (id: string) => void;
  moveNode: (activeId: string, overId: string) => void;
  saveDraft: () => void;
  save: () => Promise<void>;
};

export const useQuoteBuilderStore = create<QuoteBuilderStore>((set, get) => ({
  quote: null,
  activeParentId: null,
  saveState: "idle",
  error: null,
  hydrate: (quote) => set({ quote, activeParentId: quote.nodes[0]?.id ?? null, saveState: "saved", error: null }),
  setActiveParent: (activeParentId) => set({ activeParentId }),
  updateQuote: (patch) => set((state) => state.quote ? { quote: { ...state.quote, ...patch }, saveState: "dirty" } : state),
  updateNode: (id, patch) => set((state) => state.quote ? { quote: cloneWithPatch(state.quote, id, patch), saveState: "dirty" } : state),
  addSection: () => set((state) => {
    if (!state.quote) return state;
    const section = createSection("Nouvelle section");
    return { quote: appendNode(state.quote, null, section), activeParentId: section.id, saveState: "dirty" };
  }),
  addSubsection: () => set((state) => {
    if (!state.quote) return state;
    const subsection = createSubsection("Nouvelle sous-section");
    return { quote: appendNode(state.quote, state.activeParentId, subsection), activeParentId: subsection.id, saveState: "dirty" };
  }),
  addItem: (kind = "fourniture") => set((state) => {
    if (!state.quote) return state;
    const item = createItem(kind === "main_oeuvre" ? "Main d'oeuvre" : "Nouvelle prestation", { kind, unit: kind === "main_oeuvre" ? "h" : "u" });
    return { quote: appendNode(state.quote, state.activeParentId, item), saveState: "dirty" };
  }),
  removeNode: (id) => set((state) => state.quote ? { quote: removeNodeFromQuote(state.quote, id), saveState: "dirty" } : state),
  moveNode: (activeId, overId) => set((state) => state.quote ? { quote: moveNode(state.quote, activeId, overId), saveState: "dirty" } : state),
  saveDraft: () => {
    const quote = get().quote;
    if (!quote) return;
    saveQuoteBuilderDraft(quote);
    set({ saveState: "saved", error: null });
  },
  save: async () => {
    const quote = get().quote;
    if (!quote) return;
    set({ saveState: "saving", error: null });
    try {
      const saved = await saveQuoteBuilder(quote);
      set({ quote: saved, saveState: "saved", error: null });
    } catch (error) {
      console.error("[QuoteBuilder] save failed", {
        quoteId: quote.id,
        quoteNumber: quote.number,
        error,
      });
      set({ saveState: "error", error: quoteBuilderErrorMessage(error) });
    }
  },
}));

function quoteBuilderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .map((value) => typeof value === "string" ? value.trim() : "")
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Sauvegarde impossible: erreur inconnue.";
}
