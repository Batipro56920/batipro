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

/**
 * Suivi administratif d'un sous-traitant, côté bureau : ce qu'il a déposé sur
 * son portail, ce qui manque ou expire, et ce qu'il reste à payer. C'est ici
 * qu'on valide une attestation ou qu'on refuse une facture avec un motif, que
 * le sous-traitant voit ensuite sur son portail.
 */
export default function SubcontractorCompliancePanel({ intervenantId }: { intervenantId: string }) {
  const [documents, setDocuments] = useState<SubcontractorDocument[]>([]);
  const [invoices, setInvoices] = useState<SubcontractorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setBusyId(null);
    }
  }

  function askReason(label: string): string | null {
    const reason = window.prompt(`Motif du refus (${label}) — le sous-traitant le verra sur son portail :`);
    if (reason === null) return null;
    return reason.trim();
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
              return (
                <div key={document.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
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
                        onClick={() => {
                          // L'échéance lue sur le document fait foi : on la corrige si besoin
                          // au moment de valider, plutôt que de laisser une date déduite.
                          const answer = window.prompt(
                            "Date de fin de validité lue sur le document (AAAA-MM-JJ), vide si aucune :",
                            document.valid_until ?? expiry ?? "",
                          );
                          if (answer === null) return;
                          const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(answer.trim()) ? answer.trim() : null;
                          void act(document.id, () => reviewSubcontractorDocument(document.id, { status: "valide", validUntil }));
                        }}
                        className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => {
                          const reason = askReason(KIND_LABEL.get(document.kind) ?? "document");
                          if (reason === null) return;
                          void act(document.id, () => reviewSubcontractorDocument(document.id, { status: "refuse", reviewNote: reason }));
                        }}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
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
            invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
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
                      className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => {
                        const reason = askReason(INVOICE_KIND_LABELS[invoice.kind].toLowerCase());
                        if (reason === null) return;
                        void act(invoice.id, () => reviewSubcontractorInvoice(invoice.id, { status: "refuse", reviewNote: reason }));
                      }}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
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
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucune pièce déposée.</p>
          )}
        </div>
      </div>
    </section>
  );
}
