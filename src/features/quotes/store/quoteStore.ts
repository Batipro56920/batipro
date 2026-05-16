import { useMemo } from "react";
import { create } from "zustand";
import type { QuoteDraft, QuoteLine } from "../types";
import { calculateQuoteTotals } from "../utils/quoteCalculations";

type QuoteState = {
  draft: QuoteDraft;
  dirty: boolean;
  setDraft: (draft: Partial<QuoteDraft>) => void;
  replaceDraft: (draft: QuoteDraft) => void;
  addLine: (line: QuoteLine) => void;
  updateLine: (id: string, patch: Partial<QuoteLine>) => void;
  deleteLine: (id: string) => void;
  reorderLines: (activeId: string, overId: string) => void;
  markSaved: () => void;
};

const initialDraft: QuoteDraft = {
  id: null,
  quoteNumber: "DEV-BROUILLON",
  status: "draft",
  clientId: null,
  prospectId: null,
  chantierId: null,
  clientName: "",
  projectAddress: "",
  projectDescription: "",
  validUntil: "",
  defaultVatRate: 20,
  depositPercent: 30,
  paymentTerms: "30% a la signature, solde selon avancement et reception des travaux.",
  legalMentions: "Devis valable selon la date indiquee. Travaux soumis aux conditions generales de l'entreprise.",
  wasteManagement: "Gestion des dechets selon la reglementation applicable.",
  footerNotes: "",
  lines: [],
};

export const useQuoteStore = create<QuoteState>((set) => ({
  draft: initialDraft,
  dirty: false,
  setDraft: (draft) => set((state) => ({ draft: { ...state.draft, ...draft }, dirty: true })),
  replaceDraft: (draft) => set({ draft, dirty: false }),
  addLine: (line) => set((state) => ({ draft: { ...state.draft, lines: [...state.draft.lines, line] }, dirty: true })),
  updateLine: (id, patch) =>
    set((state) => ({
      draft: {
        ...state.draft,
        lines: state.draft.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
      },
      dirty: true,
    })),
  deleteLine: (id) =>
    set((state) => ({
      draft: { ...state.draft, lines: state.draft.lines.filter((line) => line.id !== id) },
      dirty: true,
    })),
  reorderLines: (activeId, overId) =>
    set((state) => {
      const lines = [...state.draft.lines];
      const from = lines.findIndex((line) => line.id === activeId);
      const to = lines.findIndex((line) => line.id === overId);
      if (from < 0 || to < 0) return state;
      const [moved] = lines.splice(from, 1);
      lines.splice(to, 0, moved);
      return {
        draft: { ...state.draft, lines: lines.map((line, index) => ({ ...line, order: index + 1 })) },
        dirty: true,
      };
    }),
  markSaved: () => set({ dirty: false }),
}));

export function useQuoteTotals() {
  const lines = useQuoteStore((state) => state.draft.lines);
  return useMemo(() => calculateQuoteTotals(lines), [lines]);
}
