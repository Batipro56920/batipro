import { createItem, createSection } from "./quoteBuilderModel";
import type { QuoteBuilderItem, QuoteBuilderQuote, QuoteBuilderSection } from "./types";

export const DAILY_CLEANING_FLAT_RATE_SOURCE_ID = "batipro_daily_cleaning_flat_rate";
const DAILY_CLEANING_SECTION_TITLE = "Organisation chantier";
const DAILY_CLEANING_TITLE = "Forfait nettoyage journalier";
const DAILY_CLEANING_NOTE_MARKER = "[BATIPRO_FORFAIT_NETTOYAGE_JOURNALIER]";

export function getDailyCleaningFlatRateDays(quote: Pick<QuoteBuilderQuote, "estimatedDurationValue" | "estimatedDurationUnit">): number {
  const value = Number(quote.estimatedDurationValue ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (quote.estimatedDurationUnit === "jours") return Math.ceil(value);
  if (quote.estimatedDurationUnit === "mois") return Math.ceil(value * 20);
  return Math.ceil(value * 5);
}

export function normalizeDailyCleaningFlatRate(quote: QuoteBuilderQuote): QuoteBuilderQuote {
  const enabled = Boolean(quote.settings.dailyCleaningFlatRateEnabled) || hasDailyCleaningFlatRateItem(quote.nodes);
  return syncDailyCleaningFlatRate({
    ...quote,
    settings: { ...quote.settings, dailyCleaningFlatRateEnabled: enabled },
  });
}

export function syncDailyCleaningFlatRate(quote: QuoteBuilderQuote): QuoteBuilderQuote {
  if (!quote.settings.dailyCleaningFlatRateEnabled) {
    return { ...quote, nodes: removeDailyCleaningFlatRateItem(quote.nodes) };
  }

  const quantity = getDailyCleaningFlatRateDays(quote);
  const note = [
    DAILY_CLEANING_NOTE_MARKER,
    "Quantite calculee automatiquement depuis la duree chantier estimee du devis.",
    `Base: ${quote.estimatedDurationValue ?? 0} ${quote.estimatedDurationUnit}.`,
  ].join("\n");

  const existing = findDailyCleaningFlatRateItem(quote.nodes);
  const item = existing
    ? { ...existing, quantity, unit: "forfait" as const, internalNote: note, sourceLibraryId: DAILY_CLEANING_FLAT_RATE_SOURCE_ID }
    : createItem(DAILY_CLEANING_TITLE, {
        kind: "ouvrage",
        quantity,
        unit: "forfait",
        unitPriceHt: 0,
        vatRate: quote.settings.defaultVatRate,
        internalNote: note,
        sourceLibraryId: DAILY_CLEANING_FLAT_RATE_SOURCE_ID,
      });

  return { ...quote, nodes: upsertDailyCleaningFlatRateItem(quote.nodes, item) };
}

function hasDailyCleaningFlatRateItem(nodes: QuoteBuilderSection[]) {
  return Boolean(findDailyCleaningFlatRateItem(nodes));
}

function findDailyCleaningFlatRateItem(nodes: QuoteBuilderSection[]): QuoteBuilderItem | null {
  for (const section of nodes) {
    for (const child of section.children) {
      if (child.type === "item" && isDailyCleaningFlatRateItem(child)) return child;
      if (child.type === "subsection") {
        const found = child.children.find(isDailyCleaningFlatRateItem);
        if (found) return found;
      }
    }
  }
  return null;
}

function isDailyCleaningFlatRateItem(item: QuoteBuilderItem) {
  return item.sourceLibraryId === DAILY_CLEANING_FLAT_RATE_SOURCE_ID ||
    item.internalNote?.includes(DAILY_CLEANING_NOTE_MARKER) ||
    item.title.trim().toLowerCase() === DAILY_CLEANING_TITLE.toLowerCase();
}

function removeDailyCleaningFlatRateItem(nodes: QuoteBuilderSection[]): QuoteBuilderSection[] {
  return nodes.map((section) => ({
    ...section,
    children: section.children
      .filter((child) => child.type !== "item" || !isDailyCleaningFlatRateItem(child))
      .map((child) => child.type === "subsection"
        ? { ...child, children: child.children.filter((item) => !isDailyCleaningFlatRateItem(item)) }
        : child),
  }));
}

function upsertDailyCleaningFlatRateItem(nodes: QuoteBuilderSection[], item: QuoteBuilderItem): QuoteBuilderSection[] {
  let updated = false;
  const next = nodes.map((section) => ({
    ...section,
    children: section.children.map((child) => {
      if (child.type === "item" && isDailyCleaningFlatRateItem(child)) {
        updated = true;
        return item;
      }
      if (child.type !== "subsection") return child;
      return {
        ...child,
        children: child.children.map((entry) => {
          if (!isDailyCleaningFlatRateItem(entry)) return entry;
          updated = true;
          return item;
        }),
      };
    }),
  }));

  if (updated) return next;

  const targetIndex = next.findIndex((section) => section.title.trim().toLowerCase() === DAILY_CLEANING_SECTION_TITLE.toLowerCase());
  if (targetIndex >= 0) {
    return next.map((section, index) => index === targetIndex ? { ...section, children: [...section.children, item] } : section);
  }

  const section = createSection(DAILY_CLEANING_SECTION_TITLE);
  section.children.push(item);
  return [...next, section];
}
