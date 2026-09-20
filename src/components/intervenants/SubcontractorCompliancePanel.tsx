import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DOCUMENT_KINDS,
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  documentExpiry,
  listSubcontractorCompliance,
  reviewSubcontractorDocument,
  reviewSubcontractorInvoice,
  summarizeDocuments,
  type DocumentStatusSummary,
  type SubcontractorDocument,
  type SubcontractorInvoice,
  type SubcontractorInvoiceStatus,
} from "../../services/subcontractorPortal.service";

const KIND_LABEL = new Map(DOCUMENT_KINDS.map((entry) => [entry.kind, entry.label]));

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const STATE_TEXT: Record<DocumentStatusSummary["state"], { text: string; tone: string }> = {
  manquant: { text: "Manquant", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  a_valider: { text: "À vérifier", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  valide: { text: "À jour", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  expire_bientot: { text: "Expire bientôt", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  expire: { text: "Expiré", tone: "bg-red-50 text-red-700 border-red-200" },
  refuse: { text: "Refusé", tone: "bg-red-50 text-red-700 border-red-200" },
};

const INVOICE_TONES: Record<SubcontractorInvoiceStatus, string> = {
  soumis: "bg-blue-50 text-blue-800",
  accepte: "bg-emerald-50 text-emerald-800",
  refuse: "bg-red-50 text-red-700",
  paye: "bg-slate-900 text-white",
};

/** Ce qui est en cours d'examen : la pièce visée et ce qu'on s'apprête à en faire. */
type Review =
  | { kind: "document-valide"; id: string; validUntil: string }
  | { kind: "document-refuse"; id: string; note: string }
  | { kind: "invoice-refuse"; id: string; note: string };

const buttonPrimary = "rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50";
const buttonDanger = "rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50";
const buttonQuiet = "rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50";
const fieldClass = "h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-blue-400";

/**
 * Suivi administratif d'un sous-traitant, côté bureau : ce qu'il a déposé sur
 * son portail, ce qui manque ou expire, et ce qu'il reste à payer. C'est ici
 * qu'on valide une attestation ou qu'on refuse une facture avec un motif, que
 * le sous-traitant voit ensuite sur son portail.
 *
 * La date de validité et le motif de refus se saisissent dans la ligne, pas
 * dans une boîte du navigateur : celle-ci coupe le texte, ne se relit pas, et
 * certains navigateurs la bloquent purement et simplement.
 */
export default function SubcontractorCompliancePanel({ intervenantId }: { intervenantId: string }) {
  const [documents, setDocuments] = useState<SubcontractorDocument[]>([]);
  const [invoices, setInvoices] = useState<SubcontractorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSubcontractorCompliance(intervenantId);
      setDocuments(result.documents);
      setInvoices(result.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [intervenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeDocuments(documents), [documents]);
  const unpaidHt = useMemo(
    () => invoices.filter((row) => row.kind !== "devis" && row.status === "accepte").reduce((total, row) => total + Number(row.amount_ht ?? 0), 0),
    [invoices],
  );

  async function act(id: string, task: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await task();
      setReview(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Portail sous-traitant</div>
          <div className="text-xs text-slate-500">Documents obligatoires, devis, factures et situations déposés par le sous-traitant.</div>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-xl border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          {loading ? "Chargement…" : "Actualiser"}
        </button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((entry) => {
          const state = STATE_TEXT[entry.state];
          return (
            <div key={entry.kind} className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs font-semibold text-slate-700">{entry.label}</div>
              <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${state.tone}`}>{state.text}</span>
              {entry.expiresOn ? <div className="mt-1 text-[11px] text-slate-500">Échéance : {formatDate(entry.expiresOn)}</div> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Documents déposés</div>
        <div className="mt-2 space-y-2">
          {documents.length ? (
            documents.map((document) => {
              const expiry = documentExpiry(document);
              const validating = review?.kind === "document-valide" && review.id === document.id;
              const refusing = review?.kind === "document-refuse" && review.id === document.id;
              return (
                <div key={document.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">
                        {document.kind === "autre" && document.label ? document.label : KIND_LABEL.get(document.kind)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Déposé le {formatDate(document.created_at)}
                        {expiry ? ` · échéance ${formatDate(expiry)}` : ""}
                        {document.review_note ? ` · ${document.review_note}` : ""}
                      </div>
                    </div>
                    {document.url ? (
                      <a href={document.url} target="_blank" rel="noreferrer" className="rounded-lg border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                        Ouvrir
                      </a>
                    ) : null}
                    {document.status === "soumis" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setReview({ kind: "document-valide", id: document.id, validUntil: document.valid_until ?? expiry ?? "" })}
                          className={buttonPrimary}
                        >
                          Valider
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setReview({ kind: "document-refuse", id: document.id, note: "" })}
                          className={buttonDanger}
                        >
                          Refuser
                        </button>
                      </>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${document.status === "valide" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                        {document.status === "valide" ? "Validé" : "Refusé"}
                      </span>
                    )}
                  </div>

                  {validating ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-emerald-50/60 p-2">
                      <label className="text-xs text-slate-600">
                        {/* L'échéance lue sur le document fait foi : on la corrige ici si la
                            date déduite ne correspond pas à ce qui est écrit dessus. */}
                        Fin de validité lue sur le document
                        <input
                          type="date"
                          autoFocus
                          className={`${fieldClass} mt-1 block`}
                          value={review.validUntil}
                          onChange={(event) => setReview({ ...review, validUntil: event.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void act(document.id, () => reviewSubcontractorDocument(document.id, { status: "valide", validUntil: review.validUntil || null }))}
                        className={`${buttonPrimary} h-9 px-3`}
                      >
                        {busyId === document.id ? "Validation…" : "Confirmer la validation"}
                      </button>
                      <button type="button" onClick={() => setReview(null)} className={`${buttonQuiet} h-9 px-3`}>Annuler</button>
                    </div>
                  ) : null}

                  {refusing ? (
                    <div className="mt-2 rounded-lg bg-red-50/60 p-2">
                      <label className="block text-xs text-slate-600">
                        Motif du refus — le sous-traitant le verra sur son portail
                        <textarea
                          autoFocus
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                          value={review.note}
                          onChange={(event) => setReview({ ...review, note: event.target.value })}
                          placeholder="Ex. attestation expirée, document illisible…"
                        />
                      </label>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId !== null || !review.note.trim()}
                          onClick={() => void act(document.id, () => reviewSubcontractorDocument(document.id, { status: "refuse", reviewNote: review.note.trim() }))}
                          className={`${buttonDanger} h-9 px-3`}
                        >
                          {busyId === document.id ? "Refus…" : "Confirmer le refus"}
                        </button>
                        <button type="button" onClick={() => setReview(null)} className={`${buttonQuiet} h-9 px-3`}>Annuler</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucun document déposé.</p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Devis, factures et situations</div>
          {unpaidHt > 0 ? <div className="text-xs font-semibold text-slate-700">Accepté, reste à payer : {formatMoney(unpaidHt)} HT</div> : null}
        </div>
        <div className="mt-2 space-y-2">
          {invoices.length ? (
            invoices.map((invoice) => {
              const refusing = review?.kind === "invoice-refuse" && review.id === invoice.id;
              return (
                <div key={invoice.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">
                        {INVOICE_KIND_LABELS[invoice.kind]}
                        {invoice.reference ? ` n° ${invoice.reference}` : ""} · {formatMoney(invoice.amount_ht)} HT
                      </div>
                      <div className="text-xs text-slate-500">
                        {invoice.issued_on ? `Du ${formatDate(invoice.issued_on)} · ` : ""}déposé le {formatDate(invoice.created_at)}
                        {invoice.review_note ? ` · ${invoice.review_note}` : ""}
                      </div>
                    </div>
                    {invoice.url ? (
                      <a href={invoice.url} target="_blank" rel="noreferrer" className="rounded-lg border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                        Ouvrir
                      </a>
                    ) : null}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVOICE_TONES[invoice.status]}`}>{INVOICE_STATUS_LABELS[invoice.status]}</span>
                    {invoice.status === "soumis" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void act(invoice.id, () => reviewSubcontractorInvoice(invoice.id, { status: "accepte" }))}
                          className={buttonPrimary}
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setReview({ kind: "invoice-refuse", id: invoice.id, note: "" })}
                          className={buttonDanger}
                        >
                          Refuser
                        </button>
                      </>
                    ) : null}
                    {invoice.status === "accepte" && invoice.kind !== "devis" ? (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void act(invoice.id, () => reviewSubcontractorInvoice(invoice.id, { status: "paye" }))}
                        className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Marquer payée
                      </button>
                    ) : null}
                  </div>

                  {refusing ? (
                    <div className="mt-2 rounded-lg bg-red-50/60 p-2">
                      <label className="block text-xs text-slate-600">
                        Motif du refus — le sous-traitant le verra sur son portail
                        <textarea
                          autoFocus
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                          value={review.note}
                          onChange={(event) => setReview({ ...review, note: event.target.value })}
                          placeholder="Ex. montant non conforme au devis, chantier absent…"
                        />
                      </label>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId !== null || !review.note.trim()}
                          onClick={() => void act(invoice.id, () => reviewSubcontractorInvoice(invoice.id, { status: "refuse", reviewNote: review.note.trim() }))}
                          className={`${buttonDanger} h-9 px-3`}
                        >
                          {busyId === invoice.id ? "Refus…" : "Confirmer le refus"}
                        </button>
                        <button type="button" onClick={() => setReview(null)} className={`${buttonQuiet} h-9 px-3`}>Annuler</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucune pièce déposée.</p>
          )}
        </div>
      </div>
    </section>
  );
}
