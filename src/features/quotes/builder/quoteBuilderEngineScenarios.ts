import { calculateQuoteBuilderTotals, flattenQuoteBuilder } from "./quoteBuilderCalculations";
import { validateQuoteBuilderForDocumentEngine } from "./quoteBuilderDocumentAdapter";
import type { QuoteBuilderQuote } from "./types";

export type QuoteBuilderEngineScenario = {
  name: string;
  quote: QuoteBuilderQuote;
  expected: {
    totalHt: number;
    totalVat: number;
    totalTtc: number;
    depositTtc: number;
    remainingTtc: number;
    rows: string[];
    vatRates: number[];
  };
};

export const QUOTE_BUILDER_ENGINE_SCENARIOS: QuoteBuilderEngineScenario[] = [
  {
    name: "sections sous-sections lignes TVA multiples et acompte",
    quote: createScenarioQuote([
      {
        id: "section-1",
        type: "section",
        title: "Salle de bain",
        children: [
          {
            id: "sub-1",
            type: "subsection",
            title: "Demolition",
            children: [
              { id: "line-1", type: "item", kind: "fourniture", title: "Depose faience", quantity: 6, unit: "m2", unitPriceHt: 45, vatRate: 10 },
              { id: "line-2", type: "item", kind: "main_oeuvre", title: "Main d'oeuvre preparation", quantity: 4, unit: "h", unitPriceHt: 48, vatRate: 20 },
            ],
          },
        ],
      },
    ]),
    expected: { totalHt: 462, totalVat: 65.4, totalTtc: 527.4, depositTtc: 158.22, remainingTtc: 369.18, rows: ["1", "1.1", "1.1.1", "1.1.2"], vatRates: [10, 20] },
  },
  {
    name: "option a zero euro conservee dans la numerotation",
    quote: createScenarioQuote([
      {
        id: "section-1",
        type: "section",
        title: "Options",
        children: [
          { id: "line-1", type: "item", kind: "divers", title: "Option gratuite", quantity: 1, unit: "forfait", unitPriceHt: 0, vatRate: 20 },
        ],
      },
    ]),
    expected: { totalHt: 0, totalVat: 0, totalTtc: 0, depositTtc: 0, remainingTtc: 0, rows: ["1", "1.1"], vatRates: [20] },
  },
  {
    name: "devis long paginable",
    quote: createScenarioQuote([
      {
        id: "section-1",
        type: "section",
        title: "Renovation complete",
        children: Array.from({ length: 42 }, (_, index) => ({
          id: `line-${index}`,
          type: "item" as const,
          kind: "fourniture" as const,
          title: `Ligne travaux ${index + 1}`,
          quantity: 1,
          unit: "u" as const,
          unitPriceHt: 10,
          vatRate: index % 2 === 0 ? 10 : 20,
        })),
      },
    ]),
    expected: { totalHt: 420, totalVat: 63, totalTtc: 483, depositTtc: 144.9, remainingTtc: 338.1, rows: ["1", "1.1", "1.42"], vatRates: [10, 20] },
  },
];

export function runQuoteBuilderEngineScenarios() {
  return QUOTE_BUILDER_ENGINE_SCENARIOS.map((scenario) => {
    validateQuoteBuilderForDocumentEngine(scenario.quote);
    const totals = calculateQuoteBuilderTotals(scenario.quote);
    const rows = flattenQuoteBuilder(scenario.quote.nodes);
    return {
      name: scenario.name,
      pass:
        totals.totalHt === scenario.expected.totalHt &&
        totals.totalVat === scenario.expected.totalVat &&
        totals.totalTtc === scenario.expected.totalTtc &&
        totals.depositTtc === scenario.expected.depositTtc &&
        totals.remainingTtc === scenario.expected.remainingTtc &&
        scenario.expected.rows.every((number) => rows.some((row) => row.number === number)) &&
        scenario.expected.vatRates.every((rate) => totals.vatBreakdown.some((entry) => entry.rate === rate)),
    };
  });
}

function createScenarioQuote(nodes: QuoteBuilderQuote["nodes"]): QuoteBuilderQuote {
  return {
    id: null,
    projectId: "project-test",
    clientId: "client-test",
    prospectId: null,
    opportunityId: null,
    number: "DEV-TEST",
    status: "draft",
    date: "2026-05-18",
    validUntil: "2026-06-18",
    workStartDate: null,
    estimatedDurationValue: null,
    estimatedDurationUnit: "semaines",
    clientName: "Client test",
    siteAddress: "1 rue du Test",
    description: "Scenario de test",
    paymentTerms: "Acompte 30%, solde a reception.",
    legalMentions: "Mentions legales.",
    footerNotes: "",
    settings: {
      defaultVatRate: 20,
      depositPercent: 30,
      showVatColumn: true,
      showQuantityColumns: true,
      hideSectionTotals: false,
      showMargins: false,
      showDiscounts: false,
      showReferences: false,
      showTypes: false,
      hideCompositeDetails: false,
    },
    nodes,
  };
}
