import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { reviewQuoteWithCoco, type QuoteReviewFinding, type QuoteReviewInput, type QuoteReviewResult } from "../../../services/quoteReview.service";

const KIND_LABEL: Record<string, string> = {
  oubli: "Oubli probable",
  designation: "Désignation à préciser",
  juridique: "Protection juridique",
  coherence: "Cohérence",
};

const SEVERITY_ORDER: Record<string, number> = { bloquant: 0, important: 1, confort: 2 };

const SEVERITY_STYLE: Record<string, string> = {
  bloquant: "border-red-200 bg-red-50 text-red-800",
  important: "border-amber-200 bg-amber-50 text-amber-900",
  confort: "border-slate-200 bg-slate-50 text-slate-700",
};

export function QuoteReviewDrawer({
  open,
  onClose,
  buildInput,
  onApplyDesignation,
}: {
  open: boolean;
  onClose: () => void;
  buildInput: () => QuoteReviewInput;
  onApplyDesignation: (lineId: string, designation: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<QuoteReviewResult | null>(null);
  const [applied, setApplied] = useState<Record<number, boolean>>({});

  const sorted = useMemo(() => {
    if (!review) return [] as QuoteReviewFinding[];
    return [...review.findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
    );
  }, [review]);

  if (!open) return null;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setReview(await reviewQuoteWithCoco(buildInput()));
      setApplied({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Relecture impossible.");
    } finally {
      setLoading(false);
    }
  }

  const blocking = sorted.filter((item) => item.severity === "bloquant").length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <aside className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Avant envoi</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Coco relit le devis</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ce qui manque, ce qui est trop vague pour être opposable, et ce qui engage l&apos;entreprise sans réserve.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!review ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-600">
                Coco lit les lignes, les quantités, les prix et les conditions du devis.
                Il ne modifie rien : tu décides de ce que tu reprends.
              </p>
              <button
                type="button"
                onClick={() => void run()}
                disabled={loading}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Coco relit..." : "Lancer la relecture"}
              </button>
            </div>
          ) : (
            <>
              <div className={`rounded-xl border px-3 py-2 text-sm ${blocking ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                {review.summary || (blocking ? "Points bloquants a traiter avant envoi." : "Devis coherent.")}
                {sorted.length ? ` — ${sorted.length} point(s), dont ${blocking} bloquant(s).` : " Aucun point releve."}
              </div>

              {sorted.map((finding, index) => (
                <article key={index} className={`rounded-2xl border p-3 ${SEVERITY_STYLE[finding.severity] ?? SEVERITY_STYLE.confort}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    {finding.severity === "bloquant" ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                    <span>{KIND_LABEL[finding.kind] ?? finding.kind}</span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5">{finding.severity}</span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-slate-950">{finding.title}</h3>
                  {finding.detail ? <p className="mt-1 text-sm leading-6">{finding.detail}</p> : null}
                  {finding.suggestion ? (
                    <div className="mt-2 rounded-xl bg-white/80 p-2 text-sm text-slate-800">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposition</div>
                      <div className="mt-1 whitespace-pre-wrap">{finding.suggestion}</div>
                      {finding.kind === "designation" && finding.lineId ? (
                        <button
                          type="button"
                          disabled={applied[index]}
                          onClick={() => {
                            onApplyDesignation(finding.lineId as string, finding.suggestion);
                            setApplied((current) => ({ ...current, [index]: true }));
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:bg-emerald-600"
                        >
                          {applied[index] ? <Check className="h-3.5 w-3.5" /> : null}
                          {applied[index] ? "Appliquee" : "Remplacer la designation"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </>
          )}

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
        </div>

        {review ? (
          <footer className="flex gap-2 border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Coco relit..." : "Relancer"}
            </button>
            <button type="button" onClick={onClose} className="ml-auto rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Fermer
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
