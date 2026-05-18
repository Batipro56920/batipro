import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { QuoteActionHandlers, QuoteWithParty } from "../types";
import { dateOnly, eur } from "../../components/crmFormat";
import { QuoteStatusChip } from "./QuoteStatusChip";

export function QuoteDetailDrawer({
  quote,
  actions,
  onClose,
}: {
  quote: QuoteWithParty | null;
  actions: QuoteActionHandlers;
  onClose: () => void;
}) {
  if (!quote) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20" role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Aperçu devis</div>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{quote.quote_number}</h3>
              <div className="mt-2"><QuoteStatusChip status={quote.statut} /></div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">HT</div>
              <div className="mt-1 font-semibold text-slate-950">{eur(quote.montant_ht)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">TTC</div>
              <div className="mt-1 font-semibold text-slate-950">{eur(quote.montant_ttc)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">Validité</div>
              <div className="mt-1 font-semibold text-slate-950">{dateOnly(quote.valid_until)}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Client</h4>
            <div className="mt-3 text-sm text-slate-600">{quote.partyLabel}</div>
            <div className="mt-1 text-sm text-slate-600">Projet : {quote.description ?? quote.lot ?? "—"}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Signature</h4>
            <div className="mt-3 text-sm text-slate-600">Statut : {quote.signature_status}</div>
            <div className="mt-1 text-sm text-slate-600">Accepté : {dateOnly(quote.accepted_at)}</div>
            <div className="mt-1 text-sm text-slate-600">Refusé : {dateOnly(quote.refused_at)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">Historique et notes</h4>
            <div className="mt-3 text-sm text-slate-600">Créé le {dateOnly(quote.created_at)} · Mis à jour le {dateOnly(quote.updated_at)}</div>
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Historique détaillé d'envoi, consultation et relance à connecter.</div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link to="/projets" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-medium text-blue-800 hover:bg-blue-100" title="Les devis s'éditent depuis le dossier projet avec le Quote Builder.">Ouvrir projet</Link>
            <button type="button" onClick={() => actions.onStatus(quote, "envoye")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Envoyer</button>
            <button type="button" onClick={() => actions.onStatus(quote, "relance_1")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">Relancer</button>
            <button type="button" onClick={() => actions.onPdf(quote)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">PDF</button>
            <button type="button" onClick={() => actions.onStatus(quote, "accepte")} className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">Accepter</button>
            <button type="button" onClick={() => actions.onStatus(quote, "refuse")} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Refuser</button>
            <button type="button" onClick={() => actions.onTransform(quote)} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Transformer chantier</button>
            <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400" title="Duplication à finaliser dans le Quote Builder">Dupliquer</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
