import { useQuoteStore, quoteSelectors } from "../store/quoteStore";

export function useQuoteCalculations() {
  return useQuoteStore(quoteSelectors.totals);
}
