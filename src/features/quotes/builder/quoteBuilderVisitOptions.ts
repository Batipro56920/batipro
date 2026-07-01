import { syncDailyCleaningFlatRate } from "./quoteBuilderDailyCleaning";
import type { QuoteBuilderQuote } from "./types";

type VisitQuoteOptions = {
  dailyCleaningFlatRateEnabled: boolean;
};

function visitQuoteOptionsKey(projectId: string) {
  return `batipro.visit-quote-options.${projectId}`;
}

export function readVisitQuoteOptions(projectId: string): VisitQuoteOptions {
  if (typeof localStorage === "undefined") return { dailyCleaningFlatRateEnabled: false };
  const raw = localStorage.getItem(visitQuoteOptionsKey(projectId));
  if (!raw) return { dailyCleaningFlatRateEnabled: false };
  try {
    const parsed = JSON.parse(raw) as Partial<VisitQuoteOptions>;
    return { dailyCleaningFlatRateEnabled: Boolean(parsed.dailyCleaningFlatRateEnabled) };
  } catch {
    return { dailyCleaningFlatRateEnabled: false };
  }
}

export function writeVisitQuoteOptions(projectId: string, options: VisitQuoteOptions) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(visitQuoteOptionsKey(projectId), JSON.stringify(options));
}

export function applyVisitQuoteOptions(quote: QuoteBuilderQuote): QuoteBuilderQuote {
  const options = readVisitQuoteOptions(quote.projectId);
  if (!options.dailyCleaningFlatRateEnabled) return quote;
  return syncDailyCleaningFlatRate({
    ...quote,
    settings: { ...quote.settings, dailyCleaningFlatRateEnabled: true },
  });
}
