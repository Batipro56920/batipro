import { supabase } from "../lib/supabaseClient";

export type QuoteReviewKind = "oubli" | "designation" | "juridique" | "coherence";
export type QuoteReviewSeverity = "bloquant" | "important" | "confort";

export type QuoteReviewFinding = {
  kind: QuoteReviewKind;
  severity: QuoteReviewSeverity;
  lineId: string | null;
  title: string;
  detail: string;
  suggestion: string;
};

export type QuoteReviewResult = {
  findings: QuoteReviewFinding[];
  summary: string;
  confidence: "high" | "medium" | "low";
};

export type QuoteReviewInput = {
  project: { name: string; clientName: string; siteAddress: string } | null;
  totals: { totalHt: number; totalTtc: number } | null;
  settings: Record<string, unknown> | null;
  terms: { paymentTerms: string; legalMentions: string; footerNotes: string } | null;
  lines: Array<{
    id: string;
    number: string;
    type: string;
    kind?: string;
    title: string;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPriceHt?: number;
    vatRate?: number;
    taskTemplateLabel?: string | null;
  }>;
};

/** Relecture du devis par Coco avant envoi. Aucune modification n'est appliquée ici. */
export async function reviewQuoteWithCoco(input: QuoteReviewInput): Promise<QuoteReviewResult> {
  const { data, error } = await supabase.functions.invoke("review-quote", { body: input });
  if (error) {
    const detail = (error as { message?: string }).message ?? "";
    throw new Error(detail || "Relecture impossible.");
  }
  const result = (data as { result?: QuoteReviewResult; error?: string } | null)?.result;
  if (!result) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || "Coco n'a rien pu relire sur ce devis.");
  }
  return result;
}
